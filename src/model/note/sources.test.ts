import { normalizeSources, validateSourceName } from "./sources";
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
