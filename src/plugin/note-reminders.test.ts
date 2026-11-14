import { PropertyNoteReminderFormat } from "model/note/property-format";
import { NoteReminderReader } from "model/note/reader";
import type { Frontmatter, NoteReminderAction } from "model/note/format";
import { parseTimeValue } from "model/note/value";
import { Reminder } from "model/reminder";
import { NoteReminderService } from "./note-reminders";
import type { NoteReminderServiceDeps } from "./note-reminders";

const ORIGIN = {
  kind: "note" as const,
  format: "property",
  key: "follow-up",
  label: "follow-up",
};

function done(expected: string): NoteReminderAction {
  return {
    type: "done",
    expected: parseTimeValue(expected)!,
    now: parseTimeValue("2026-11-20T10:00")!,
  };
}

/**
 * A fake vault of one note whose frontmatter is a plain object. `parseYaml`
 * reads JSON, which is enough to exercise the service: the YAML dialect is
 * Obsidian's business.
 */
function setup(initial: Frontmatter | null) {
  const state = {
    fm: initial,
    parseCalls: 0,
    processCalls: 0,
    writes: 0,
    // Runs once, right before `processFrontMatter` hands over the object.
    beforeProcess: undefined as (() => void) | undefined,
    failRead: false,
    failProcess: false,
  };
  const content = (): string =>
    state.fm == null ? "body" : `---\n${JSON.stringify(state.fm)}\n---\nbody`;
  const deps: NoteReminderServiceDeps = {
    parseYaml: (yaml) => {
      state.parseCalls++;
      return JSON.parse(yaml) as unknown;
    },
    readFile: async () => {
      if (state.failRead) {
        throw new Error("missing");
      }
      return content();
    },
    processFrontMatter: async (_path, fn) => {
      state.processCalls++;
      if (state.failProcess) {
        throw new Error("cannot write");
      }
      state.beforeProcess?.();
      state.beforeProcess = undefined;
      const copy = JSON.parse(JSON.stringify(state.fm ?? {})) as Frontmatter;
      fn(copy); // a throw leaves `state.fm` as it was
      state.fm = copy;
      state.writes++;
    },
  };
  const reader = new NoteReminderReader([
    new PropertyNoteReminderFormat(() => [
      { property: "follow-up", managed: false, since: "" },
    ]),
  ]);
  return { state, content, service: new NoteReminderService(reader, deps) };
}

describe("NoteReminderService#read()", (): void => {
  test("reads the pending reminders of a note", (): void => {
    const { service, content } = setup({ "follow-up": "2026-11-20" });
    const reminders = service.read("Call Alice.md", content());
    expect(reminders.map((r) => [r.title, r.time.toString()])).toStrictEqual([
      ["Call Alice", "2026-11-20"],
    ]);
  });

  test("does not parse YAML when no source name is in the block", (): void => {
    const { service, state, content } = setup({ due: "2026-11-20" });
    expect(service.read("a.md", content())).toStrictEqual([]);
    expect(service.read("a.md", "no frontmatter")).toStrictEqual([]);
    expect(state.parseCalls).toBe(0);
  });

  test("invalid YAML gives no reminders", (): void => {
    const { service } = setup(null);
    expect(
      service.read("a.md", "---\nfollow-up: {broken\n---\n"),
    ).toStrictEqual([]);
  });

  test("frontmatter that is not a mapping gives no reminders", (): void => {
    const { service } = setup(null);
    expect(service.read("a.md", '---\n["follow-up"]\n---\n')).toStrictEqual([]);
  });
});

describe("NoteReminderService#apply()", (): void => {
  test("writes Done to the note", async (): Promise<void> => {
    const { service, state } = setup({ "follow-up": "2026-11-20" });
    const reminder = Reminder.ofNote(
      "a.md",
      "a",
      parseTimeValue("2026-11-20")!,
      ORIGIN,
    );

    await expect(service.apply(reminder, done("2026-11-20"))).resolves.toBe(
      "applied",
    );

    expect(state.fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-20",
    });
    expect(state.writes).toBe(1);
  });

  test("a line reminder is not a note reminder", async (): Promise<void> => {
    const { service, state } = setup({ "follow-up": "2026-11-20" });
    const line = Reminder.ofLine(
      "a.md",
      "a",
      parseTimeValue("2026-11-20")!,
      0,
      false,
    );
    await expect(service.apply(line, done("2026-11-20"))).resolves.toBe(
      "missing",
    );
    expect(state.processCalls).toBe(0);
  });

  test("does not enter the frontmatter API when there is nothing to write", async (): Promise<void> => {
    const cases: Array<[Frontmatter | null, string]> = [
      [{ "follow-up": "2026-11-27" }, "stale"],
      [{}, "missing"],
      [null, "missing"],
      [{ "follow-up": "2026-11-20", "follow-up-done": true }, "blocked"],
    ];
    for (const [fm, outcome] of cases) {
      const { service, state } = setup(fm);
      await expect(
        service.applyAt("a.md", ORIGIN, done("2026-11-20")),
      ).resolves.toBe(outcome);
      expect(state.processCalls).toBe(0);
    }
  });

  test("a note that changes before the write is left alone", async (): Promise<void> => {
    const { service, state } = setup({ "follow-up": "2026-11-20" });
    state.beforeProcess = () => {
      // Another plugin moves the date between the first run and the write.
      state.fm = { "follow-up": "2026-11-27" };
    };

    await expect(
      service.applyAt("a.md", ORIGIN, done("2026-11-20")),
    ).resolves.toBe("stale");

    expect(state.processCalls).toBe(1);
    expect(state.writes).toBe(0);
    expect(state.fm).toStrictEqual({ "follow-up": "2026-11-27" });
  });

  test("a note that cannot be read or written fails", async (): Promise<void> => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const unreadable = setup({ "follow-up": "2026-11-20" });
      unreadable.state.failRead = true;
      await expect(
        unreadable.service.applyAt("a.md", ORIGIN, done("2026-11-20")),
      ).resolves.toBe("failed");

      const unwritable = setup({ "follow-up": "2026-11-20" });
      unwritable.state.failProcess = true;
      await expect(
        unwritable.service.applyAt("a.md", ORIGIN, done("2026-11-20")),
      ).resolves.toBe("failed");
      expect(unwritable.state.writes).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("NoteReminderService#readFrontmatter() and write()", (): void => {
  test("a note without frontmatter reads as empty", async (): Promise<void> => {
    const { service } = setup(null);
    await expect(service.readFrontmatter("a.md")).resolves.toStrictEqual({});
  });

  test("write() applies a caller's change", async (): Promise<void> => {
    const { service, state } = setup({ other: 1 });
    await expect(
      service.write("a.md", (fm) => {
        fm["reminder"] = "2026-11-21";
        return "applied";
      }),
    ).resolves.toBe("applied");
    expect(state.fm).toStrictEqual({ other: 1, reminder: "2026-11-21" });
  });
});
