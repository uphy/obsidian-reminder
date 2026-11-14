import type { DateTime } from "model/time";
import type { Frontmatter, NoteReminderAction } from "./format";
import { TaskNotesNoteReminderFormat, effectiveTime } from "./tasknotes-format";
import type { TaskNotesOptions } from "./tasknotes-format";
import { formatTimeValue, parseTimeValue } from "./value";

const time = (text: string): DateTime => parseTimeValue(text)!;

function formatOf(options: Partial<TaskNotesOptions> = {}) {
  return new TaskNotesNoteReminderFormat(() => ({
    enabled: true,
    taskTag: "task",
    completedStatuses: ["done"],
    since: "",
    ...options,
  }));
}

function done(expected: string): NoteReminderAction {
  return {
    type: "done",
    expected: time(expected),
    now: time("2026-11-20T09:50"),
  };
}

function snooze(expected: string, to: string): NoteReminderAction {
  return { type: "snooze", expected: time(expected), time: time(to) };
}

function read(format: TaskNotesNoteReminderFormat, fm: Frontmatter) {
  return format.read(fm).map((e) => ({
    key: e.key,
    time: formatTimeValue(e.time),
    title: e.title,
    label: e.label,
  }));
}

/** A task due on 2026-11-20 10:00 with a "15 minutes before" reminder. */
function task(extra: Frontmatter = {}): Frontmatter {
  return {
    tags: ["task"],
    status: "open",
    due: "2026-11-20T10:00",
    reminders: [
      {
        id: "rem_1",
        type: "relative",
        relatedTo: "due",
        offset: "-PT15M",
        description: "15 min before",
      },
    ],
    ...extra,
  };
}

describe("effectiveTime()", (): void => {
  const at = (entry: Record<string, unknown>, fm: Frontmatter = {}) => {
    const t = effectiveTime(entry, fm);
    return t == null ? null : formatTimeValue(t);
  };

  test("an absolute entry fires at its time", (): void => {
    expect(at({ type: "absolute", absoluteTime: "2026-11-18T09:00:59" })).toBe(
      "2026-11-18T09:00:00",
    );
  });

  test("a relative entry fires at the base date plus the offset", (): void => {
    const fm = { due: "2026-11-20T10:00", scheduled: "2026-11-19" };
    const relative = (relatedTo: string, offset: string) =>
      at({ type: "relative", relatedTo, offset }, fm);
    expect(relative("due", "-PT15M")).toBe("2026-11-20T09:45:00");
    expect(relative("due", "PT1H30M")).toBe("2026-11-20T11:30:00");
    expect(relative("due", "-P1D")).toBe("2026-11-19T10:00:00");
    expect(relative("due", "-P1W")).toBe("2026-11-13T10:00:00");
    expect(relative("due", "PT0M")).toBe("2026-11-20T10:00:00");
    // A date without a time counts from midnight.
    expect(relative("scheduled", "PT9H")).toBe("2026-11-19T09:00:00");
    expect(relative("scheduled", "-P1D")).toBe("2026-11-18T00:00:00");
  });

  test("what can't be computed has no time", (): void => {
    const fm = { due: "2026-11-20T10:00" };
    expect(at({ type: "absolute", absoluteTime: "2026-11-18T09:00:00Z" })).toBe(
      null,
    );
    expect(at({ type: "absolute" })).toBe(null);
    expect(at({ type: "other", absoluteTime: "2026-11-18T09:00" })).toBe(null);
    expect(
      at({ type: "relative", relatedTo: "scheduled", offset: "-PT15M" }, fm),
    ).toBe(null);
    expect(
      at({ type: "relative", relatedTo: "created", offset: "-PT15M" }, fm),
    ).toBe(null);
    expect(
      at({ type: "relative", relatedTo: "due", offset: "15 minutes" }, fm),
    ).toBe(null);
    expect(at({ type: "relative", relatedTo: "due", offset: "-P1M" }, fm)).toBe(
      null,
    );
  });
});

describe("TaskNotesNoteReminderFormat#read()", (): void => {
  test("reads the entries of an open task", (): void => {
    const fm = task({
      title: "Send the report",
      reminders: [
        {
          id: "rem_1",
          type: "relative",
          relatedTo: "due",
          offset: "-PT15M",
          description: "15 min before",
        },
        { id: "rem_2", type: "absolute", absoluteTime: "2026-11-18T09:00:00" },
      ],
    });
    expect(read(formatOf(), fm)).toStrictEqual([
      {
        key: "rem_1",
        time: "2026-11-20T09:45:00",
        title: "Send the report",
        label: "15 min before",
      },
      {
        key: "rem_2",
        time: "2026-11-18T09:00:00",
        title: "Send the report",
        label: "TaskNotes",
      },
    ]);
  });

  test("reads nothing while it is turned off, and asks for no key", (): void => {
    const format = formatOf({ enabled: false });
    expect(format.keys()).toStrictEqual([]);
    expect(read(format, task())).toStrictEqual([]);
    expect(formatOf().keys()).toStrictEqual(["reminders"]);
  });

  test("a note that is not an open, non-recurring task is skipped", (): void => {
    const format = formatOf();
    expect(read(format, task({ tags: ["project"] }))).toStrictEqual([]);
    expect(read(format, task({ tags: undefined }))).toStrictEqual([]);
    expect(read(format, task({ status: "Done" }))).toStrictEqual([]);
    expect(read(format, task({ tags: ["task", "archived"] }))).toStrictEqual(
      [],
    );
    expect(
      read(format, task({ recurrence: "FREQ=WEEKLY;BYDAY=MO" })),
    ).toStrictEqual([]);
  });

  test("the task tag and statuses come from the settings", (): void => {
    const format = formatOf({
      taskTag: "#todo",
      completedStatuses: ["finished", "cancelled"],
    });
    expect(read(format, task())).toStrictEqual([]);
    expect(read(format, task({ tags: "todo, work" }))).toHaveLength(1);
    expect(
      read(format, task({ tags: ["#Todo"], status: "done" })),
    ).toHaveLength(1);
    expect(
      read(format, task({ tags: ["todo"], status: "cancelled" })),
    ).toStrictEqual([]);
  });

  test("a reminders value that is not a list of mappings yields nothing", (): void => {
    const format = formatOf();
    expect(read(format, task({ reminders: "soon" }))).toStrictEqual([]);
    expect(
      read(
        format,
        task({
          reminders: [
            "soon",
            { id: "a", type: "absolute", absoluteTime: "2026-11-18T09:00" },
          ],
        }),
      ),
    ).toStrictEqual([]);
  });

  test("entries without an id or a time, and repeated ids, are skipped", (): void => {
    const fm = task({
      reminders: [
        { type: "absolute", absoluteTime: "2026-11-18T09:00" },
        { id: "a", type: "absolute", absoluteTime: "soon" },
        { id: "b", type: "absolute", absoluteTime: "2026-11-18T09:00" },
        { id: "b", type: "absolute", absoluteTime: "2026-11-19T09:00" },
      ],
    });
    expect(read(formatOf(), fm).map((e) => [e.key, e.time])).toStrictEqual([
      ["b", "2026-11-18T09:00:00"],
    ]);
  });

  test("times before the cut-off are not read", (): void => {
    expect(read(formatOf({ since: "2026-11-21" }), task())).toStrictEqual([]);
    expect(read(formatOf({ since: "2026-11-20" }), task())).toHaveLength(1);
  });

  test("an entry recorded as done at its time is not pending", (): void => {
    const format = formatOf();
    expect(
      read(format, task({ "reminders-done": ["rem_1@2026-11-20T09:45:00"] })),
    ).toStrictEqual([]);
    // The due date moved: the record is for another time.
    expect(
      read(
        format,
        task({
          due: "2026-11-27T10:00",
          "reminders-done": ["rem_1@2026-11-20T09:45:00"],
        }),
      ).map((e) => e.time),
    ).toStrictEqual(["2026-11-27T09:45:00"]);
  });
});

describe("TaskNotesNoteReminderFormat#apply() done", (): void => {
  const format = formatOf();

  test("records the entry and leaves it alone (CUJ 9)", (): void => {
    const fm = task();
    const before = JSON.stringify(fm["reminders"]);
    expect(format.apply(fm, "rem_1", done("2026-11-20T09:45"))).toBe("applied");
    expect(JSON.stringify(fm["reminders"])).toBe(before);
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-20T09:45:00"]);
    expect(read(format, fm)).toStrictEqual([]);

    // TaskNotes moves the due date: the same entry reminds again.
    fm["due"] = "2026-11-27T10:00";
    expect(read(format, fm).map((e) => e.time)).toStrictEqual([
      "2026-11-27T09:45:00",
    ]);
    expect(format.apply(fm, "rem_1", done("2026-11-27T09:45"))).toBe("applied");
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-27T09:45:00"]);
  });

  test("writes nothing when the time is no longer the one shown", (): void => {
    const fm = task({ due: "2026-11-27T10:00" });
    const before = JSON.stringify(fm);
    expect(format.apply(fm, "rem_1", done("2026-11-20T09:45"))).toBe("stale");
    expect(JSON.stringify(fm)).toBe(before);
  });

  test("an entry that is already done is stale, a missing one is missing", (): void => {
    const fm = task({ "reminders-done": ["rem_1@2026-11-20T09:45:00"] });
    expect(format.apply(fm, "rem_1", done("2026-11-20T09:45"))).toBe("stale");
    expect(format.apply(fm, "rem_9", done("2026-11-20T09:45"))).toBe("missing");
    expect(
      format.apply(task({ status: "done" }), "rem_1", done("2026-11-20T09:45")),
    ).toBe("missing");
  });

  test("a reminders-done the plugin did not write blocks Done", (): void => {
    for (const foreign of [true, "yes", ["note"], [1]]) {
      const fm = task({ "reminders-done": foreign });
      const before = JSON.stringify(fm);
      // Read as if there were no records.
      expect(read(format, fm)).toHaveLength(1);
      expect(format.apply(fm, "rem_1", done("2026-11-20T09:45"))).toBe(
        "blocked",
      );
      expect(JSON.stringify(fm)).toBe(before);
    }
  });

  test("records of entries that are gone are dropped in the same write", (): void => {
    const fm = task({
      "reminders-done": [
        "old@2026-11-01T09:00:00",
        "rem_1@2026-11-13T09:45:00",
      ],
    });
    format.apply(fm, "rem_1", done("2026-11-20T09:45"));
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-20T09:45:00"]);
  });
});

describe("TaskNotesNoteReminderFormat#apply() snooze", (): void => {
  const format = formatOf();
  const SNOOZE_ID = "obsidian-reminder-snooze-rem_1";

  test("records the entry and adds one absolute entry of its own", (): void => {
    const fm = task();
    expect(
      format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-20T10:15")),
    ).toBe("applied");
    expect(fm["reminders"]).toStrictEqual([
      {
        id: "rem_1",
        type: "relative",
        relatedTo: "due",
        offset: "-PT15M",
        description: "15 min before",
      },
      {
        id: SNOOZE_ID,
        type: "absolute",
        absoluteTime: "2026-11-20T10:15:00",
        description: "15 min before",
      },
    ]);
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-20T09:45:00"]);
    expect(read(format, fm)).toStrictEqual([
      {
        key: SNOOZE_ID,
        time: "2026-11-20T10:15:00",
        title: undefined,
        label: "15 min before",
      },
    ]);
  });

  test("a second snooze moves the added entry; Done removes it", (): void => {
    const fm = task();
    format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-20T10:15"));
    expect(
      format.apply(
        fm,
        SNOOZE_ID,
        snooze("2026-11-20T10:15", "2026-11-21T09:00"),
      ),
    ).toBe("applied");
    expect(read(format, fm).map((e) => [e.key, e.time])).toStrictEqual([
      [SNOOZE_ID, "2026-11-21T09:00:00"],
    ]);
    expect(format.apply(fm, SNOOZE_ID, done("2026-11-21T09:00"))).toBe(
      "applied",
    );
    expect(fm["reminders"]).toHaveLength(1);
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-20T09:45:00"]);
    expect(read(format, fm)).toStrictEqual([]);
  });

  test("a snooze onto the time the entry already has changes nothing", (): void => {
    const fm = task();
    const before = JSON.stringify(fm);
    expect(
      format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-20T09:45")),
    ).toBe("unchanged");
    expect(JSON.stringify(fm)).toBe(before);
  });

  test("a whole-day choice is written as a time", (): void => {
    const fm = task();
    format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-21"));
    expect(read(format, fm)[0]?.time).toBe("2026-11-21T00:00:00");
  });

  test("the added entry stops counting when the base date moves", (): void => {
    const fm = task();
    format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-20T10:15"));
    fm["due"] = "2026-11-27T10:00";
    // Only the original reminds, at its new time.
    expect(read(format, fm).map((e) => [e.key, e.time])).toStrictEqual([
      ["rem_1", "2026-11-27T09:45:00"],
    ]);
    expect(format.apply(fm, SNOOZE_ID, done("2026-11-20T10:15"))).toBe("stale");
    // The next write removes the leftover.
    format.apply(fm, "rem_1", done("2026-11-27T09:45"));
    expect(fm["reminders"]).toHaveLength(1);
    expect(fm["reminders-done"]).toStrictEqual(["rem_1@2026-11-27T09:45:00"]);
  });

  test("a snooze replaces a leftover entry instead of adding a second", (): void => {
    const fm = task();
    format.apply(fm, "rem_1", snooze("2026-11-20T09:45", "2026-11-20T10:15"));
    fm["due"] = "2026-11-27T10:00";
    format.apply(fm, "rem_1", snooze("2026-11-27T09:45", "2026-11-27T12:00"));
    expect(
      (fm["reminders"] as Array<Record<string, unknown>>).map((e) => [
        e["id"],
        e["absoluteTime"],
      ]),
    ).toStrictEqual([
      ["rem_1", undefined],
      [SNOOZE_ID, "2026-11-27T12:00:00"],
    ]);
    expect(read(format, fm).map((e) => e.key)).toStrictEqual([SNOOZE_ID]);
  });

  test("an added entry whose original was deleted is ignored and removed", (): void => {
    const fm = task({
      reminders: [
        { id: SNOOZE_ID, type: "absolute", absoluteTime: "2026-11-20T10:15" },
        { id: "rem_2", type: "absolute", absoluteTime: "2026-11-20T09:00" },
      ],
      "reminders-done": ["rem_1@2026-11-20T09:45:00"],
    });
    expect(read(format, fm).map((e) => e.key)).toStrictEqual(["rem_2"]);
    format.apply(fm, "rem_2", done("2026-11-20T09:00"));
    expect(fm["reminders"]).toStrictEqual([
      { id: "rem_2", type: "absolute", absoluteTime: "2026-11-20T09:00" },
    ]);
    expect(fm["reminders-done"]).toStrictEqual(["rem_2@2026-11-20T09:00:00"]);
  });

  test("an entry with the prefix that is not absolute is TaskNotes' own", (): void => {
    const fm = task({
      reminders: [
        {
          id: SNOOZE_ID,
          type: "relative",
          relatedTo: "due",
          offset: "-PT5M",
        },
      ],
    });
    expect(read(format, fm).map((e) => e.time)).toStrictEqual([
      "2026-11-20T09:55:00",
    ]);
    format.apply(fm, SNOOZE_ID, done("2026-11-20T09:55"));
    expect(fm["reminders"]).toHaveLength(1);
  });
});
