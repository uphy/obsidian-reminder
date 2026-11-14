import {
  countSourceStats,
  normalizeSources,
  validateSourceName,
  withManagedSource,
} from "./sources";
import type { NoteReminderSource } from "./sources";

const rows: Array<NoteReminderSource> = [
  { property: "follow-up", managed: false, since: "" },
  { property: "reminder", managed: true, since: "2026-11-14" },
];

describe("validateSourceName()", (): void => {
  test("a new name is accepted", (): void => {
    expect(validateSourceName(rows, -1, "sr-due")).toBeNull();
  });

  test("an empty name is rejected", (): void => {
    expect(validateSourceName(rows, -1, "  ")).toBe("empty");
  });

  test("a name that is already listed is rejected", (): void => {
    expect(validateSourceName(rows, -1, " follow-up ")).toBe("duplicate");
  });

  test("the row being edited does not collide with itself", (): void => {
    expect(validateSourceName(rows, 0, "follow-up")).toBeNull();
  });

  test("a companion of another row is rejected", (): void => {
    expect(validateSourceName(rows, -1, "follow-up-done")).toBe("companion");
    expect(validateSourceName(rows, -1, "reminder-title")).toBe("companion");
    expect(validateSourceName(rows, -1, "reminder-repeat")).toBe("companion");
  });

  test("a name another row is a companion of is rejected", (): void => {
    const existing: Array<NoteReminderSource> = [
      { property: "due-done", managed: false, since: "" },
    ];
    expect(validateSourceName(existing, -1, "due")).toBe("companion");
  });
});

describe("normalizeSources()", (): void => {
  test("anything that is not a list gives no rows", (): void => {
    expect(normalizeSources(undefined)).toStrictEqual([]);
    expect(normalizeSources("follow-up")).toStrictEqual([]);
    expect(normalizeSources({ property: "follow-up" })).toStrictEqual([]);
  });

  test("malformed rows are dropped and missing fields get defaults", (): void => {
    expect(
      normalizeSources([
        null,
        "follow-up",
        { property: "" },
        { property: " follow-up " },
        { property: "follow-up", managed: true },
        { property: "reminder", managed: true, since: "2026-11-14" },
        { property: "review", managed: "yes", since: "last week" },
      ]),
    ).toStrictEqual([
      { property: "follow-up", managed: false, since: "" },
      { property: "reminder", managed: true, since: "2026-11-14" },
      { property: "review", managed: false, since: "" },
    ]);
  });
});

describe("withManagedSource()", (): void => {
  test("an existing row is switched to managed and keeps its cut-off", (): void => {
    const existing: Array<NoteReminderSource> = [
      { property: "follow-up", managed: false, since: "2026-01-01" },
      { property: "due", managed: false, since: "" },
    ];
    expect(
      withManagedSource(existing, "follow-up", "2026-11-14"),
    ).toStrictEqual([
      { property: "follow-up", managed: true, since: "2026-01-01" },
      { property: "due", managed: false, since: "" },
    ]);
    expect(withManagedSource(existing, "due", "2026-11-14")![1]).toStrictEqual({
      property: "due",
      managed: true,
      since: "",
    });
    // The rows passed in are not edited.
    expect(existing[0]!.managed).toBe(false);
  });

  test("a companion of another row is rejected", (): void => {
    expect(withManagedSource(rows, "follow-up-done", "2026-11-14")).toBeNull();
  });

  test("a new name is added as a managed row cut off at today", (): void => {
    expect(withManagedSource(rows, "sr-due", "2026-11-20")).toStrictEqual([
      ...rows,
      { property: "sr-due", managed: true, since: "2026-11-20" },
    ]);
  });
});

describe("countSourceStats()", (): void => {
  const source: NoteReminderSource = {
    property: "due",
    managed: false,
    since: "2026-11-14",
  };

  test("a time before the cut-off counts as ignored", (): void => {
    expect(
      countSourceStats(source, [
        { due: "2026-11-13" },
        { due: "2026-11-13T23:59" },
        { due: "2026-11-14" },
        { due: "some text" },
        {},
      ]),
    ).toStrictEqual({ ignored: 2, foreignDone: 0 });
  });

  test("without a cut-off nothing is ignored", (): void => {
    expect(
      countSourceStats({ ...source, since: "" }, [{ due: "2020-01-01" }]),
    ).toStrictEqual({ ignored: 0, foreignDone: 0 });
  });

  test("a done property that is not a time counts as foreign", (): void => {
    expect(
      countSourceStats(source, [
        { due: "2026-11-20", "due-done": true },
        { "due-done": "yes" },
      ]),
    ).toStrictEqual({ ignored: 0, foreignDone: 2 });
  });

  test("an empty or recorded done property is not foreign", (): void => {
    expect(
      countSourceStats(source, [
        { due: "2026-11-20", "due-done": "" },
        { due: "2026-11-20", "due-done": null },
        { due: "2026-11-20", "due-done": "2026-11-20" },
      ]),
    ).toStrictEqual({ ignored: 0, foreignDone: 0 });
  });
});
