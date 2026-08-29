import { Reminder } from "model/reminder";
import { DateTime, Time } from "model/time";
import { NtfyController, testNtfyConnection } from "./ntfy";
import type { NtfyControllerDeps, NtfyRequest, NtfyResponse } from "./ntfy";

/**
 * Records every request made and answers each one from a queue of canned
 * responses, falling back to 200 with an empty body (what ntfy returns for a
 * topic with nothing scheduled).
 */
class FakeServer {
  readonly requests: Array<NtfyRequest> = [];
  private queued: Array<NtfyResponse> = [];

  constructor(...responses: Array<NtfyResponse>) {
    this.queued = [...responses];
  }

  readonly request = async (request: NtfyRequest): Promise<NtfyResponse> => {
    this.requests.push(request);
    return this.queued.shift() ?? { status: 200, text: "" };
  };

  authHeadersOf(index: number): string | undefined {
    return this.requests[index]?.headers?.["Authorization"];
  }
}

function createDeps(
  overrides: Partial<NtfyControllerDeps> = {},
): NtfyControllerDeps {
  return {
    isEnabled: () => true,
    serverUrl: () => "https://ntfy.example.com",
    topic: () => "reminders",
    accessToken: () => "",
    reminders: () => [],
    defaultTime: () => Time.parse("08:00"),
    vaultName: () => "vault",
    registerInterval: () => {},
    request: async () => ({ status: 200, text: "" }),
    notify: () => {},
    ...overrides,
  };
}

// `doSync` is private; the public entry points either schedule the sync on a
// timer or debounce it, neither of which these tests want to wait for.
function callDoSync(controller: NtfyController): Promise<void> {
  return (controller as unknown as { doSync(): Promise<void> }).doSync();
}

/** A reminder due `minutes` from now, i.e. inside the 24h publish horizon. */
function reminderInMinutes(title: string, minutes: number): Reminder {
  return new Reminder(
    "notes/Todo.md",
    title,
    DateTime.ofEpochMillis(Date.now() + minutes * 60 * 1000),
    0,
    false,
  );
}

describe("NtfyController authentication", (): void => {
  test("sends a Bearer header on every request when a token is set", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({
        accessToken: () => "tk_secret",
        request: server.request,
        // A reminder due soon so the round makes a publish request too.
        reminders: () => [reminderInMinutes("Buy milk", 60)],
      }),
    );

    await callDoSync(controller);

    expect(server.requests.length).toBeGreaterThanOrEqual(2);
    for (const request of server.requests) {
      expect(request.headers?.["Authorization"]).toBe("Bearer tk_secret");
    }
  });

  test("sends no Authorization header when the token is blank", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({ accessToken: () => "   ", request: server.request }),
    );

    await callDoSync(controller);

    expect(server.requests).toHaveLength(1);
    expect(server.authHeadersOf(0)).toBeUndefined();
  });

  test("trims surrounding whitespace from the token", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({
        accessToken: () => " tk_secret\n",
        request: server.request,
      }),
    );

    await callDoSync(controller);

    expect(server.authHeadersOf(0)).toBe("Bearer tk_secret");
  });

  test("keeps publish's own headers alongside the auth header", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({
        accessToken: () => "tk_secret",
        request: server.request,
        reminders: () => [reminderInMinutes("Buy milk", 60)],
      }),
    );

    await callDoSync(controller);

    const publish = server.requests.find((r) => r.method === "POST");
    expect(publish?.headers).toMatchObject({
      Authorization: "Bearer tk_secret",
      "Content-Type": "application/json",
    });
    expect(publish?.headers?.["X-Sequence-ID"]).toMatch(/^obr-/);
  });
});

describe("NtfyController authentication failures", (): void => {
  test("notifies the user once for repeated auth failures", async (): Promise<void> => {
    const notices: Array<string> = [];
    const controller = new NtfyController(
      createDeps({
        request: async () => ({ status: 403, text: '{"error":"forbidden"}' }),
        notify: (message) => notices.push(message),
      }),
    );

    await callDoSync(controller);
    await callDoSync(controller);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("403");
  });

  test("notifies again after the ntfy settings change", async (): Promise<void> => {
    const notices: Array<string> = [];
    const controller = new NtfyController(
      createDeps({
        request: async () => ({ status: 401, text: "" }),
        notify: (message) => notices.push(message),
      }),
    );

    await callDoSync(controller);
    controller.notifySettingsChanged();
    await callDoSync(controller);

    expect(notices).toHaveLength(2);
    controller.stop();
  });

  test("stays silent for a server error", async (): Promise<void> => {
    const notices: Array<string> = [];
    const controller = new NtfyController(
      createDeps({
        request: async () => ({ status: 500, text: "" }),
        notify: (message) => notices.push(message),
      }),
    );

    await callDoSync(controller);

    expect(notices).toHaveLength(0);
  });
});

describe("NtfyController topic validation", (): void => {
  test("sends nothing when the topic is not a valid ntfy topic", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({
        topic: () => "reminders?auth=abc",
        request: server.request,
      }),
    );

    await callDoSync(controller);

    expect(server.requests).toHaveLength(0);
  });

  test("sends nothing when the topic is blank", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({ topic: () => "  ", request: server.request }),
    );

    await callDoSync(controller);

    expect(server.requests).toHaveLength(0);
  });

  test("strips trailing slashes from the server URL", async (): Promise<void> => {
    const server = new FakeServer();
    const controller = new NtfyController(
      createDeps({
        serverUrl: () => "https://ntfy.example.com//",
        request: server.request,
      }),
    );

    await callDoSync(controller);

    expect(server.requests[0]?.url).toBe(
      "https://ntfy.example.com/reminders/json?poll=1&sched=1",
    );
  });
});

describe("testNtfyConnection()", (): void => {
  test("reads, publishes and deletes, then reports success", async (): Promise<void> => {
    const server = new FakeServer();

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com/",
      topic: "reminders",
      accessToken: "tk_secret",
    });

    expect(result.ok).toBe(true);
    expect(server.requests.map((r) => r.method)).toStrictEqual([
      "GET",
      "POST",
      "DELETE",
    ]);
    for (const request of server.requests) {
      expect(request.headers?.["Authorization"]).toBe("Bearer tk_secret");
    }
  });

  test("schedules the test message under a sequence ID the sync can clean up", async (): Promise<void> => {
    const server = new FakeServer();

    await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "reminders",
      accessToken: "",
    });

    const publish = server.requests[1]!;
    expect(publish.headers?.["X-Sequence-ID"]).toBe("obr-selftest");
    // Scheduled, not delivered: a `delay` in the future is what keeps the
    // test from pushing a notification to the user's devices.
    const body = JSON.parse(publish.body!) as { delay: string };
    expect(Number(body.delay)).toBeGreaterThan(Date.now() / 1000);
    expect(server.requests[2]!.url).toBe(
      "https://ntfy.example.com/reminders/obr-selftest",
    );
  });

  test("blames the token when reading is refused", async (): Promise<void> => {
    const server = new FakeServer({
      status: 403,
      text: '{"code":40301,"error":"forbidden"}',
    });

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "reminders",
      accessToken: "tk_wrong",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("access token");
    expect(result.message).toContain("forbidden");
    expect(server.requests).toHaveLength(1);
  });

  test("reports a read-only token at the publish step", async (): Promise<void> => {
    const server = new FakeServer(
      { status: 200, text: "" },
      { status: 403, text: '{"error":"forbidden"}' },
    );

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "reminders",
      accessToken: "tk_readonly",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Publishing a test message");
    expect(server.requests).toHaveLength(2);
  });

  test("points at the server URL for a 404", async (): Promise<void> => {
    const server = new FakeServer({ status: 404, text: "page not found" });

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "reminders",
      accessToken: "",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("server URL");
  });

  test("rejects an invalid topic without making a request", async (): Promise<void> => {
    const server = new FakeServer();

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "reminders?auth=abc",
      accessToken: "",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("not a valid topic name");
    expect(server.requests).toHaveLength(0);
  });

  test("asks for a topic rather than reporting it as malformed when blank", async (): Promise<void> => {
    const server = new FakeServer();

    const result = await testNtfyConnection(server.request, {
      serverUrl: "https://ntfy.example.com",
      topic: "  ",
      accessToken: "",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Set the ntfy topic first.");
    expect(server.requests).toHaveLength(0);
  });

  test("rejects a blank server URL without making a request", async (): Promise<void> => {
    const server = new FakeServer();

    const result = await testNtfyConnection(server.request, {
      serverUrl: "  ",
      topic: "reminders",
      accessToken: "",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("server URL");
    expect(server.requests).toHaveLength(0);
  });

  test("reports an unreachable server", async (): Promise<void> => {
    const result = await testNtfyConnection(
      async () => {
        throw new Error("net::ERR_NAME_NOT_RESOLVED");
      },
      {
        serverUrl: "https://ntfy.invalid",
        topic: "reminders",
        accessToken: "",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Could not reach https://ntfy.invalid");
    expect(result.message).toContain("ERR_NAME_NOT_RESOLVED");
  });
});
