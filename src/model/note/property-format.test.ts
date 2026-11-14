import { DateTime } from "model/time";
import {
  PropertyNoteReminderFormat,
  pickInitialProperty,
  readPropertyReminderState,
  rearmPropertyReminder,
  removePropertyReminder,
  setPropertyReminder,
} from "./property-format";
import type { NoteReminderSource } from "./sources";
import type { Frontmatter, NoteReminderAction } from "./format";
import { formatTimeValue, parseTimeValue } from "./value";

const time = (text: string): DateTime => parseTimeValue(text)!;
const NOW = time("2026-11-20T09:40");

function done(expected: string): NoteReminderAction {
  return { type: "done", expected: time(expected), now: NOW };
}

function snooze(expected: string, to: string): NoteReminderAction {
  return { type: "snooze", expected: time(expected), time: time(to) };
}

function formatOf(
  ...sources: Array<Partial<NoteReminderSource> & { property: string }>
): PropertyNoteReminderFormat {
  const rows = sources.map((s) => ({ managed: false, since: "", ...s }));
  return new PropertyNoteReminderFormat(() => rows);
}

function read(
  format: PropertyNoteReminderFormat,
  fm: Frontmatter,
): Array<{ key: string; time: string; title?: string; label: string }> {
  return format.read(fm).map((e) => ({
    key: e.key,
    time: formatTimeValue(e.time),
    title: e.title,
    label: e.label,
  }));
}

describe("PropertyNoteReminderFormat#read()", (): void => {
  const format = formatOf({ property: "follow-up" });

  test("a date and a date-time are reminders", (): void => {
    expect(read(format, { "follow-up": "2026-11-20" })).toStrictEqual([
      {
        key: "follow-up",
        time: "2026-11-20",
        title: undefined,
        label: "follow-up",
      },
    ]);
    expect(read(format, { "follow-up": "2026-11-20T09:00:00" })[0]?.time).toBe(
      "2026-11-20T09:00:00",
    );
  });

  test("a value that is not a time, or a property that is not listed, is ignored", (): void => {
    expect(read(format, { "follow-up": "soon" })).toStrictEqual([]);
    expect(read(format, { "follow-up": null })).toStrictEqual([]);
    expect(read(format, { other: "2026-11-20" })).toStrictEqual([]);
    expect(read(format, {})).toStrictEqual([]);
  });

  test("a value recorded as done is not pending; a newer value is", (): void => {
    expect(
      read(format, {
        "follow-up": "2026-11-20",
        "follow-up-done": "2026-11-20",
      }),
    ).toStrictEqual([]);
    expect(
      read(format, {
        "follow-up": "2026-12-05",
        "follow-up-done": "2026-11-20",
      }).length,
    ).toBe(1);
  });

  test("a done record that is not a time does not hide the reminder", (): void => {
    expect(
      read(format, { "follow-up": "2026-11-20", "follow-up-done": true })
        .length,
    ).toBe(1);
  });

  test("a value before the cut-off is not read; one on the cut-off day is", (): void => {
    const cut = formatOf({ property: "follow-up", since: "2026-11-20" });
    expect(read(cut, { "follow-up": "2026-11-19" })).toStrictEqual([]);
    expect(read(cut, { "follow-up": "2026-11-20" }).length).toBe(1);
  });

  test("the title property is used on a managed row only", (): void => {
    const fm = { reminder: "2026-11-20", "reminder-title": " Send it " };
    expect(
      read(formatOf({ property: "reminder", managed: true }), fm)[0]?.title,
    ).toBe("Send it");
    expect(read(formatOf({ property: "reminder" }), fm)[0]?.title).toBe(
      undefined,
    );
  });

  test("a title that is not text is treated as absent", (): void => {
    const managed = formatOf({ property: "reminder", managed: true });
    expect(
      read(managed, { reminder: "2026-11-20", "reminder-title": 3 })[0]?.title,
    ).toBe(undefined);
  });

  test("keys() lists the configured properties", (): void => {
    expect(formatOf({ property: "a" }, { property: "b" }).keys()).toStrictEqual(
      ["a", "b"],
    );
  });
});

describe("PropertyNoteReminderFormat#apply() done", (): void => {
  const format = formatOf({ property: "follow-up" });

  test("records the time and leaves the value", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    expect(format.apply(fm, "follow-up", done("2026-11-20"))).toBe("applied");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-20",
    });
    expect(read(format, fm)).toStrictEqual([]);
  });

  test("a new value is pending again and can be completed again", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-12-05",
      "follow-up-done": "2026-11-20",
    };
    expect(read(format, fm).length).toBe(1);
    expect(format.apply(fm, "follow-up", done("2026-12-05"))).toBe("applied");
    expect(fm["follow-up-done"]).toBe("2026-12-05");
  });

  test("an outdated notification writes nothing", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-27" };
    expect(format.apply(fm, "follow-up", done("2026-11-20"))).toBe("stale");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-27" });
  });

  test("a second Done is stale", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    format.apply(fm, "follow-up", done("2026-11-20"));
    expect(format.apply(fm, "follow-up", done("2026-11-20"))).toBe("stale");
  });

  test("a removed value and an unlisted property are missing", (): void => {
    expect(format.apply({}, "follow-up", done("2026-11-20"))).toBe("missing");
    expect(
      format.apply({ "follow-up": "later" }, "follow-up", done("2026-11-20")),
    ).toBe("missing");
    expect(
      format.apply({ other: "2026-11-20" }, "other", done("2026-11-20")),
    ).toBe("missing");
  });

  test("a done property that is not a time blocks and is left alone", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    };
    expect(format.apply(fm, "follow-up", done("2026-11-20"))).toBe("blocked");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    });
  });

  test("an empty done property does not block", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20", "follow-up-done": "" };
    expect(format.apply(fm, "follow-up", done("2026-11-20"))).toBe("applied");
    expect(fm["follow-up-done"]).toBe("2026-11-20");
  });
});

describe("PropertyNoteReminderFormat#apply() snooze", (): void => {
  const format = formatOf({ property: "follow-up" });

  test("a date stays a date", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    expect(
      format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21T10:30")),
    ).toBe("applied");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21" });
  });

  test("a date-time stays a date-time", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20T09:00:00" };
    format.apply(
      fm,
      "follow-up",
      snooze("2026-11-20T09:00", "2026-11-20T09:30"),
    );
    expect(fm).toStrictEqual({ "follow-up": "2026-11-20T09:30:00" });
    format.apply(fm, "follow-up", snooze("2026-11-20T09:30", "2026-11-21"));
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21T00:00:00" });
  });

  test("an outdated notification writes nothing", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-27" };
    expect(
      format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21")),
    ).toBe("stale");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-27" });
  });

  test("snoozing onto the time it already has writes nothing", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    // A whole-day choice that is today ("Next Saturday" on a Saturday), and
    // a time of day on the same day, which a date drops.
    expect(
      format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-20")),
    ).toBe("unchanged");
    expect(
      format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-20T10:30")),
    ).toBe("unchanged");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-20" });

    const timed: Frontmatter = { "follow-up": "2026-11-20T09:00:00" };
    expect(
      format.apply(
        timed,
        "follow-up",
        snooze("2026-11-20T09:00", "2026-11-20T09:00"),
      ),
    ).toBe("unchanged");
    expect(timed).toStrictEqual({ "follow-up": "2026-11-20T09:00:00" });
  });

  test("snoozing onto the recorded time removes the record", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-21",
    };
    format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21"));
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21" });
    expect(read(format, fm).length).toBe(1);
  });

  test("a done property that is not a time is left alone", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    };
    expect(
      format.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21")),
    ).toBe("applied");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-21",
      "follow-up-done": true,
    });
  });
});

describe("the dialog's functions", (): void => {
  const edit = (to: string, title: string = "") => ({ time: time(to), title });

  test("readPropertyReminderState()", (): void => {
    expect(readPropertyReminderState({}, "reminder")).toStrictEqual({
      time: null,
      foreignValue: null,
      title: "",
      done: false,
      pending: false,
    });
    const pending = readPropertyReminderState(
      { reminder: "2026-11-20", "reminder-title": "Send" },
      "reminder",
    );
    expect(pending.time && formatTimeValue(pending.time)).toBe("2026-11-20");
    expect(pending.title).toBe("Send");
    expect(pending.done).toBe(false);
    expect(pending.pending).toBe(true);

    const finished = readPropertyReminderState(
      { reminder: "2026-11-20", "reminder-done": "2026-11-20" },
      "reminder",
    );
    expect(finished.done).toBe(true);
    expect(finished.pending).toBe(false);

    expect(
      readPropertyReminderState({ reminder: "next week" }, "reminder")
        .foreignValue,
    ).toBe("next week");
    expect(
      readPropertyReminderState({ reminder: ["a"] }, "reminder").foreignValue,
    ).toBe('["a"]');
  });

  test("a value before the cut-off is neither done nor pending", (): void => {
    const state = readPropertyReminderState(
      { reminder: "2026-11-19" },
      "reminder",
      "2026-11-20",
    );
    expect(state.done).toBe(false);
    expect(state.pending).toBe(false);
    expect(
      readPropertyReminderState(
        { reminder: "2026-11-20" },
        "reminder",
        "2026-11-20",
      ).pending,
    ).toBe(true);
  });

  test("a multi-line title is read as one line", (): void => {
    expect(
      readPropertyReminderState(
        { "reminder-title": "Send\n  the report" },
        "reminder",
      ).title,
    ).toBe("Send the report");
  });

  test("pickInitialProperty() prefers a pending reminder, then any time", (): void => {
    const state = (fm: Frontmatter) => readPropertyReminderState(fm, "p");
    const empty = state({});
    const finished = state({ p: "2026-11-20", "p-done": "2026-11-20" });
    const pending = state({ p: "2026-11-20" });

    expect(
      pickInitialProperty(["a", "b", "c"], {
        a: empty,
        b: finished,
        c: pending,
      }),
    ).toBe("c");
    expect(pickInitialProperty(["a", "b"], { a: empty, b: finished })).toBe(
      "b",
    );
    expect(pickInitialProperty(["a", "b"], { a: empty, b: empty })).toBe("a");
    expect(pickInitialProperty([], {})).toBeUndefined();
  });

  test("setPropertyReminder() writes the time and the title", (): void => {
    const fm: Frontmatter = {};
    expect(
      setPropertyReminder(
        fm,
        "reminder",
        edit("2026-11-21T09:00", " Send the report "),
      ),
    ).toBe("applied");
    expect(fm).toStrictEqual({
      reminder: "2026-11-21T09:00:00",
      "reminder-title": "Send the report",
    });
  });

  test("setPropertyReminder() removes an empty title", (): void => {
    const fm: Frontmatter = { reminder: "2026-11-20", "reminder-title": "Old" };
    setPropertyReminder(fm, "reminder", edit("2026-11-20"));
    expect(fm).toStrictEqual({ reminder: "2026-11-20" });
  });

  test("setPropertyReminder() onto a time recorded as done clears the record", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-27",
      "reminder-done": "2026-11-20",
    };
    setPropertyReminder(fm, "reminder", edit("2026-11-20"));
    expect(fm).toStrictEqual({ reminder: "2026-11-20" });
  });

  test("setPropertyReminder() with an unchanged time keeps a finished reminder finished", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-done": "2026-11-20",
    };
    setPropertyReminder(fm, "reminder", edit("2026-11-20", "New title"));
    expect(fm).toStrictEqual({
      reminder: "2026-11-20",
      "reminder-done": "2026-11-20",
      "reminder-title": "New title",
    });
  });

  test("setPropertyReminder() keeps a done record for another time", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-done": "2026-11-20",
    };
    setPropertyReminder(fm, "reminder", edit("2026-11-27"));
    expect(fm).toStrictEqual({
      reminder: "2026-11-27",
      "reminder-done": "2026-11-20",
    });
  });

  test("setPropertyReminder() refuses a value that is not a time", (): void => {
    const fm: Frontmatter = { reminder: "next week" };
    expect(setPropertyReminder(fm, "reminder", edit("2026-11-27", "x"))).toBe(
      "blocked",
    );
    expect(fm).toStrictEqual({ reminder: "next week" });
  });

  test("setPropertyReminder() leaves a title that is not text", (): void => {
    const fm: Frontmatter = { "reminder-title": ["a"] };
    setPropertyReminder(fm, "reminder", edit("2026-11-27", "x"));
    expect(fm).toStrictEqual({
      "reminder-title": ["a"],
      reminder: "2026-11-27",
    });
  });

  test("rearmPropertyReminder() removes the record of the current time", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-done": "2026-11-20",
    };
    expect(rearmPropertyReminder(fm, "reminder")).toBe("applied");
    expect(fm).toStrictEqual({ reminder: "2026-11-20" });
    expect(rearmPropertyReminder(fm, "reminder")).toBe("stale");
    expect(rearmPropertyReminder({}, "reminder")).toBe("missing");
    const other: Frontmatter = {
      reminder: "2026-11-27",
      "reminder-done": "2026-11-20",
    };
    expect(rearmPropertyReminder(other, "reminder")).toBe("stale");
    expect(other["reminder-done"]).toBe("2026-11-20");
  });

  test("removePropertyReminder() removes what the plugin wrote", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-title": "Send",
      "reminder-done": "2026-11-13",
      other: 1,
    };
    expect(removePropertyReminder(fm, "reminder")).toBe("applied");
    expect(fm).toStrictEqual({ other: 1 });
  });

  test("removePropertyReminder() keeps a done property that is not a time", (): void => {
    const fm: Frontmatter = { reminder: "2026-11-20", "reminder-done": true };
    removePropertyReminder(fm, "reminder");
    expect(fm).toStrictEqual({ "reminder-done": true });
  });

  test("removePropertyReminder() refuses a value that is not a time", (): void => {
    const fm: Frontmatter = { reminder: "next week" };
    expect(removePropertyReminder(fm, "reminder")).toBe("blocked");
    expect(fm).toStrictEqual({ reminder: "next week" });
    expect(removePropertyReminder({}, "reminder")).toBe("missing");
  });
});
