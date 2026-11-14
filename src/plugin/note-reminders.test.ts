import { PropertyNoteReminderFormat } from "model/note/property-format";
import { NoteReminderReader } from "model/note/reader";
import { TaskNotesNoteReminderFormat } from "model/note/tasknotes-format";
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
type Offer = { format: string; property: string; value: unknown };

function setup(
  initial: Frontmatter | null,
  // What the other plugin does with an offered property; absent when the
  // plugin layer has no such plugin to offer to.
  onOffer?: (offer: Offer, state: { fm: Frontmatter | null }) => boolean,
) {
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
  const offers: Array<Offer> = [];
  if (onOffer != null) {
    deps.writeExternalProperty = async (format, _path, property, value) => {
      const offer = { format, property, value };
      offers.push(offer);
      return onOffer(offer, state);
    };
  }
  const reader = new NoteReminderReader([
    new PropertyNoteReminderFormat(() => [
      { property: "follow-up", managed: false, since: "" },
    ]),
    new TaskNotesNoteReminderFormat(() => ({
      enabled: true,
      identification: "tag",
      taskTag: "task",
      taskProperty: "",
      taskPropertyValue: "",
      completedStatuses: ["done"],
      archiveTag: "archived",
      properties: {},
      since: "",
    })),
  ]);
  return {
    state,
    content,
    offers,
    service: new NoteReminderService(reader, deps),
  };
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

describe("NoteReminderService#applyAt() with a property of another plugin", (): void => {
  const TASK_ORIGIN = {
    kind: "note",
    format: "tasknotes",
    key: "rem_1",
    label: "TaskNotes",
  } as const;
  const SNOOZE_ID = "obsidian-reminder-snooze-rem_1";
  const task = (): Frontmatter => ({
    tags: ["task"],
    reminders: [
      { id: "rem_1", type: "absolute", absoluteTime: "2026-11-20T09:45:00" },
    ],
  });
  const time = (text: string) => parseTimeValue(text)!;
  const snooze: NoteReminderAction = {
    type: "snooze",
    expected: time("2026-11-20T09:45"),
    time: time("2026-11-20T10:15"),
  };
  const idsOf = (value: unknown): Array<unknown> =>
    (value as Array<Record<string, unknown>>).map((e) => e["id"]);

  // The other plugin writes the property into the note itself.
  const taking = (offer: Offer, state: { fm: Frontmatter | null }): boolean => {
    state.fm = { ...state.fm, [offer.property]: offer.value };
    return true;
  };

  test("a changed list is offered first; the note ends the same either way", async (): Promise<void> => {
    const taken = setup(task(), taking);
    const refused = setup(task(), () => false);
    const direct = setup(task());
    for (const { service } of [taken, refused, direct]) {
      expect(await service.applyAt("task.md", TASK_ORIGIN, snooze)).toBe(
        "applied",
      );
    }

    expect(taken.offers).toHaveLength(1);
    expect(taken.offers[0]!.format).toBe("tasknotes");
    expect(taken.offers[0]!.property).toBe("reminders");
    expect(idsOf(taken.offers[0]!.value)).toStrictEqual(["rem_1", SNOOZE_ID]);
    expect(refused.offers).toHaveLength(1);
    expect(direct.offers).toHaveLength(0);

    expect(direct.state.fm!["reminders-done"]).toStrictEqual([
      "rem_1@2026-11-20T09:45:00",
    ]);
    expect(taken.state.fm).toStrictEqual(direct.state.fm);
    expect(refused.state.fm).toStrictEqual(direct.state.fm);
  });

  test("Done leaves the list alone, so nothing is offered", async (): Promise<void> => {
    const { service, offers, state } = setup(task(), taking);
    const action: NoteReminderAction = {
      type: "done",
      expected: time("2026-11-20T09:45"),
      now: time("2026-11-20T09:50"),
    };
    expect(await service.applyAt("task.md", TASK_ORIGIN, action)).toBe(
      "applied",
    );
    expect(offers).toHaveLength(0);
    expect(state.fm!["reminders-done"]).toStrictEqual([
      "rem_1@2026-11-20T09:45:00",
    ]);
  });

  test("nothing is offered when there is nothing to write", async (): Promise<void> => {
    const { service, offers, state } = setup(task(), taking);
    const stale: NoteReminderAction = {
      ...snooze,
      expected: time("2026-11-20T08:00"),
    };
    expect(await service.applyAt("task.md", TASK_ORIGIN, stale)).toBe("stale");
    expect(offers).toHaveLength(0);
    expect(state.writes).toBe(0);
  });

  test("a format without such properties is never offered", async (): Promise<void> => {
    const { service, offers } = setup({ "follow-up": "2026-11-20" }, taking);
    expect(await service.applyAt("note.md", ORIGIN, done("2026-11-20"))).toBe(
      "applied",
    );
    expect(offers).toHaveLength(0);
  });

  test("an offer that throws does not fail the action", async (): Promise<void> => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => {});
    try {
      const { service, state } = setup(task(), () => {
        throw new Error("boom");
      });
      expect(await service.applyAt("task.md", TASK_ORIGIN, snooze)).toBe(
        "applied",
      );
      expect(idsOf(state.fm!["reminders"])).toStrictEqual(["rem_1", SNOOZE_ID]);
    } finally {
      debug.mockRestore();
    }
  });
});
