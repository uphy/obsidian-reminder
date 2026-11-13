import { t } from "i18n";
import { NTFY_SEQUENCE_ID_PREFIX, isValidNtfyTopic } from "model/ntfy";
import type { NtfyRequestFn } from "./http";
import {
  authHeaders,
  describeFailure,
  isAuthFailure,
  normalizeServerUrl,
  pollUrl,
  scheduleUrl,
} from "./http";

export const CONNECTION_TEST_SEQUENCE_ID = `${NTFY_SEQUENCE_ID_PREFIX}selftest`;
export const CONNECTION_TEST_DELAY_SECONDS = 24 * 60 * 60;

export interface NtfyConnectionTestConfig {
  serverUrl: string;
  topic: string;
  accessToken: string;
}

export interface NtfyConnectionTestResult {
  ok: boolean;
  message: string;
}

/**
 * Turns a failed step of the connection test into a sentence that names the
 * likeliest cause, since ntfy reuses the same status for unrelated problems
 * (see `describeFailure`).
 */
function describeTestFailure(
  step: string,
  response: { status: number; text: string },
): string {
  const detail = describeFailure(response);
  if (isAuthFailure(response.status)) {
    return t(
      "{step} was refused ({detail}). Check the access token, and that it has read-write access to this topic.",
      { step, detail },
    );
  }
  if (response.status === 404) {
    return t("{step} failed ({detail}). Check the server URL.", {
      step,
      detail,
    });
  }
  return t("{step} failed ({detail}).", { step, detail });
}

/**
 * Checks a set of ntfy settings by making the same three requests a real sync
 * round makes: read the topic's schedules, publish one, delete it again.
 *
 * Deliberately not a method on `NtfyController`: what the user wants to test
 * is the values currently typed into the settings tab, which is exactly what
 * the caller passes in â€” not the controller's own view of the world, and not
 * something that should require a controller instance to reach.
 *
 * Publishing (rather than only polling) is the point of doing three requests:
 * ntfy's per-topic ACLs can grant read without write, so a read-only token
 * passes a poll-only check and then silently fails to publish a single
 * reminder. Nothing is delivered by the test itself â€” the message is
 * scheduled a day out and deleted immediately (see
 * `CONNECTION_TEST_SEQUENCE_ID`).
 */
export async function testNtfyConnection(
  request: NtfyRequestFn,
  config: NtfyConnectionTestConfig,
): Promise<NtfyConnectionTestResult> {
  const serverUrl = normalizeServerUrl(config.serverUrl);
  const topic = config.topic.trim();
  if (serverUrl.length === 0) {
    return { ok: false, message: t("Set the ntfy server URL first.") };
  }
  if (topic.length === 0) {
    return { ok: false, message: t("Set the ntfy topic first.") };
  }
  if (!isValidNtfyTopic(topic)) {
    return {
      ok: false,
      message: t(
        "The ntfy topic is not a valid topic name: use only letters, digits, dashes and underscores (1-64 characters).",
      ),
    };
  }
  const headers = authHeaders(config.accessToken);

  try {
    const read = await request({
      url: pollUrl(serverUrl, topic),
      method: "GET",
      headers,
    });
    if (read.status >= 400) {
      return {
        ok: false,
        message: describeTestFailure(t("Reading the topic"), read),
      };
    }

    const published = await request({
      url: `${serverUrl}/`,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Sequence-ID": CONNECTION_TEST_SEQUENCE_ID,
      },
      body: JSON.stringify({
        topic,
        title: "Reminder connection test",
        message:
          "Published by the Obsidian Reminder plugin to check the ntfy settings, and deleted again right away.",
        delay: String(
          Math.floor(Date.now() / 1000) + CONNECTION_TEST_DELAY_SECONDS,
        ),
      }),
    });
    if (published.status >= 400) {
      return {
        ok: false,
        message: describeTestFailure(t("Publishing a test message"), published),
      };
    }

    const deleted = await request({
      url: scheduleUrl(serverUrl, topic, CONNECTION_TEST_SEQUENCE_ID),
      method: "DELETE",
      headers,
    });
    if (deleted.status >= 400) {
      return {
        ok: false,
        message: t(
          "{step} It stays scheduled until the next sync removes it.",
          {
            step: describeTestFailure(t("Deleting the test message"), deleted),
          },
        ),
      };
    }

    return {
      ok: true,
      message: t("Connected. Reading, publishing and deleting all succeeded."),
    };
  } catch (e) {
    // A thrown error here means the request never got an HTTP response at
    // all: DNS failure, refused connection, TLS problem, offline.
    return {
      ok: false,
      message: t("Could not reach {serverUrl}: {error}", {
        serverUrl,
        error: e instanceof Error ? e.message : String(e),
      }),
    };
  }
}
