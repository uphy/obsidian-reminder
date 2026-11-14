import { DateTime } from "model/time";
import {
  PropertyNoteReminderStore,
  readPropertyReminderState,
  removePropertyReminder,
  setPropertyReminder,
} from "./property-store";
import type { NoteReminderSource } from "./sources";
import type { Frontmatter, NoteReminderAction } from "./store";
import { formatTimeValue, parseTimeValue } from "./value";

const time = (text: string): DateTime => parseTimeValue(text)!;
const NOW = time("2026-11-20T09:40");

function done(expected: string): NoteReminderAction {
  return { type: "done", expected: time(expected), now: NOW };
}

function snooze(expected: string, to: string): NoteReminderAction {
  return { type: "snooze", expected: time(expected), time: time(to) };
}

function storeOf(
  ...sources: Array<Partial<NoteReminderSource> & { property: string }>
): PropertyNoteReminderStore {
  const rows = sources.map((s) => ({ managed: false, since: "", ...s }));
  return new PropertyNoteReminderStore(() => rows);
}

function read(
  store: PropertyNoteReminderStore,
  fm: Frontmatter,
): Array<{ key: string; time: string; title?: string; label: string }> {
  return store.read(fm).map((e) => ({
    key: e.key,
    time: formatTimeValue(e.time),
    title: e.title,
    label: e.label,
  }));
}

describe("PropertyNoteReminderStore#read()", (): void => {
  const store = storeOf({ property: "follow-up" });

  test("a date and a date-time are reminders", (): void => {
    expect(read(store, { "follow-up": "2026-11-20" })).toStrictEqual([
      {
        key: "follow-up",
        time: "2026-11-20",
        title: undefined,
        label: "follow-up",
      },
    ]);
    expect(read(store, { "follow-up": "2026-11-20T09:00:00" })[0]?.time).toBe(
      "2026-11-20T09:00:00",
    );
  });

  test("a value that is not a time, or a property that is not listed, is ignored", (): void => {
    expect(read(store, { "follow-up": "soon" })).toStrictEqual([]);
    expect(read(store, { "follow-up": null })).toStrictEqual([]);
    expect(read(store, { other: "2026-11-20" })).toStrictEqual([]);
    expect(read(store, {})).toStrictEqual([]);
  });

  test("a value recorded as done is not pending; a newer value is", (): void => {
    expect(
      read(store, {
        "follow-up": "2026-11-20",
        "follow-up-done": "2026-11-20",
      }),
    ).toStrictEqual([]);
    expect(
      read(store, {
        "follow-up": "2026-12-05",
        "follow-up-done": "2026-11-20",
      }).length,
    ).toBe(1);
  });

  test("a done record that is not a time does not hide the reminder", (): void => {
    expect(
      read(store, { "follow-up": "2026-11-20", "follow-up-done": true }).length,
    ).toBe(1);
  });

  test("a value before the cut-off is not read; one on the cut-off day is", (): void => {
    const cut = storeOf({ property: "follow-up", since: "2026-11-20" });
    expect(read(cut, { "follow-up": "2026-11-19" })).toStrictEqual([]);
    expect(read(cut, { "follow-up": "2026-11-20" }).length).toBe(1);
  });

  test("the title property is used on a managed row only", (): void => {
    const fm = { reminder: "2026-11-20", "reminder-title": " Send it " };
    expect(
      read(storeOf({ property: "reminder", managed: true }), fm)[0]?.title,
    ).toBe("Send it");
    expect(read(storeOf({ property: "reminder" }), fm)[0]?.title).toBe(
      undefined,
    );
  });

  test("a title that is not text is treated as absent", (): void => {
    const managed = storeOf({ property: "reminder", managed: true });
    expect(
      read(managed, { reminder: "2026-11-20", "reminder-title": 3 })[0]?.title,
    ).toBe(undefined);
  });

  test("keys() lists the configured properties", (): void => {
    expect(storeOf({ property: "a" }, { property: "b" }).keys()).toStrictEqual([
      "a",
      "b",
    ]);
  });
});

describe("PropertyNoteReminderStore#apply() done", (): void => {
  const store = storeOf({ property: "follow-up" });

  test("records the time and leaves the value", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    expect(store.apply(fm, "follow-up", done("2026-11-20"))).toBe("applied");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-20",
    });
    expect(read(store, fm)).toStrictEqual([]);
  });

  test("a new value is pending again and can be completed again", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-12-05",
      "follow-up-done": "2026-11-20",
    };
    expect(read(store, fm).length).toBe(1);
    expect(store.apply(fm, "follow-up", done("2026-12-05"))).toBe("applied");
    expect(fm["follow-up-done"]).toBe("2026-12-05");
  });

  test("an outdated notification writes nothing", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-27" };
    expect(store.apply(fm, "follow-up", done("2026-11-20"))).toBe("stale");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-27" });
  });

  test("a second Done is stale", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    store.apply(fm, "follow-up", done("2026-11-20"));
    expect(store.apply(fm, "follow-up", done("2026-11-20"))).toBe("stale");
  });

  test("a removed value and an unlisted property are missing", (): void => {
    expect(store.apply({}, "follow-up", done("2026-11-20"))).toBe("missing");
    expect(
      store.apply({ "follow-up": "later" }, "follow-up", done("2026-11-20")),
    ).toBe("missing");
    expect(
      store.apply({ other: "2026-11-20" }, "other", done("2026-11-20")),
    ).toBe("missing");
  });

  test("a done property that is not a time blocks and is left alone", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    };
    expect(store.apply(fm, "follow-up", done("2026-11-20"))).toBe("blocked");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    });
  });

  test("an empty done property does not block", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20", "follow-up-done": "" };
    expect(store.apply(fm, "follow-up", done("2026-11-20"))).toBe("applied");
    expect(fm["follow-up-done"]).toBe("2026-11-20");
  });
});

describe("PropertyNoteReminderStore#apply() snooze", (): void => {
  const store = storeOf({ property: "follow-up" });

  test("a date stays a date", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20" };
    expect(
      store.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21T10:30")),
    ).toBe("applied");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21" });
  });

  test("a date-time stays a date-time", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-20T09:00:00" };
    store.apply(
      fm,
      "follow-up",
      snooze("2026-11-20T09:00", "2026-11-20T09:30"),
    );
    expect(fm).toStrictEqual({ "follow-up": "2026-11-20T09:30:00" });
    store.apply(fm, "follow-up", snooze("2026-11-20T09:30", "2026-11-21"));
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21T00:00:00" });
  });

  test("an outdated notification writes nothing", (): void => {
    const fm: Frontmatter = { "follow-up": "2026-11-27" };
    expect(
      store.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21")),
    ).toBe("stale");
    expect(fm).toStrictEqual({ "follow-up": "2026-11-27" });
  });

  test("snoozing onto the recorded time removes the record", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-21",
    };
    store.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21"));
    expect(fm).toStrictEqual({ "follow-up": "2026-11-21" });
    expect(read(store, fm).length).toBe(1);
  });

  test("a done property that is not a time is left alone", (): void => {
    const fm: Frontmatter = {
      "follow-up": "2026-11-20",
      "follow-up-done": true,
    };
    expect(
      store.apply(fm, "follow-up", snooze("2026-11-20", "2026-11-21")),
    ).toBe("applied");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-21",
      "follow-up-done": true,
    });
  });
});

describe("the dialog's functions", (): void => {
  test("readPropertyReminderState()", (): void => {
    expect(readPropertyReminderState({}, "reminder")).toStrictEqual({
      time: null,
      foreignValue: null,
      title: "",
      done: false,
    });
    const pending = readPropertyReminderState(
      { reminder: "2026-11-20", "reminder-title": "Send" },
      "reminder",
    );
    expect(pending.time && formatTimeValue(pending.time)).toBe("2026-11-20");
    expect(pending.title).toBe("Send");
    expect(pending.done).toBe(false);
    expect(
      readPropertyReminderState(
        { reminder: "2026-11-20", "reminder-done": "2026-11-20" },
        "reminder",
      ).done,
    ).toBe(true);
    expect(
      readPropertyReminderState({ reminder: "next week" }, "reminder")
        .foreignValue,
    ).toBe("next week");
    expect(
      readPropertyReminderState({ reminder: ["a"] }, "reminder").foreignValue,
    ).toBe('["a"]');
  });

  test("setPropertyReminder() writes the time and the title", (): void => {
    const fm: Frontmatter = {};
    expect(
      setPropertyReminder(fm, "reminder", {
        time: time("2026-11-21T09:00"),
        title: " Send the report ",
      }),
    ).toBe(true);
    expect(fm).toStrictEqual({
      reminder: "2026-11-21T09:00:00",
      "reminder-title": "Send the report",
    });
  });

  test("setPropertyReminder() removes an empty title and an equal done record", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-title": "Old",
      "reminder-done": "2026-11-20",
    };
    setPropertyReminder(fm, "reminder", {
      time: time("2026-11-20"),
      title: "",
    });
    expect(fm).toStrictEqual({ reminder: "2026-11-20" });
  });

  test("setPropertyReminder() keeps a done record for another time", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-done": "2026-11-20",
    };
    setPropertyReminder(fm, "reminder", {
      time: time("2026-11-27"),
      title: "",
    });
    expect(fm).toStrictEqual({
      reminder: "2026-11-27",
      "reminder-done": "2026-11-20",
    });
  });

  test("setPropertyReminder() refuses a value that is not a time", (): void => {
    const fm: Frontmatter = { reminder: "next week" };
    expect(
      setPropertyReminder(fm, "reminder", {
        time: time("2026-11-27"),
        title: "x",
      }),
    ).toBe(false);
    expect(fm).toStrictEqual({ reminder: "next week" });
  });

  test("setPropertyReminder() leaves a title that is not text", (): void => {
    const fm: Frontmatter = { "reminder-title": ["a"] };
    setPropertyReminder(fm, "reminder", {
      time: time("2026-11-27"),
      title: "x",
    });
    expect(fm).toStrictEqual({
      "reminder-title": ["a"],
      reminder: "2026-11-27",
    });
  });

  test("removePropertyReminder() removes what the plugin wrote", (): void => {
    const fm: Frontmatter = {
      reminder: "2026-11-20",
      "reminder-title": "Send",
      "reminder-done": "2026-11-13",
      other: 1,
    };
    removePropertyReminder(fm, "reminder");
    expect(fm).toStrictEqual({ other: 1 });
  });

  test("removePropertyReminder() keeps a done property that is not a time", (): void => {
    const fm: Frontmatter = { reminder: "2026-11-20", "reminder-done": true };
    removePropertyReminder(fm, "reminder");
    expect(fm).toStrictEqual({ "reminder-done": true });
  });
});
