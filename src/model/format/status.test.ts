import {
  DEFAULT_STATUSES_TEXT,
  StatusRegistry,
  parseStatusSetting,
  unknownStatusTypes,
} from "./status";
import type { TaskStatus } from "./status";

const STATUSES: Array<TaskStatus> = [
  { symbol: " ", nextStatusSymbol: "x", type: "TODO" },
  { symbol: "x", nextStatusSymbol: " ", type: "DONE" },
  { symbol: "-", nextStatusSymbol: "-", type: "CANCELLED" },
  { symbol: "v", nextStatusSymbol: " ", type: "DONE" },
  { symbol: "d", nextStatusSymbol: "d", type: "CANCELLED" },
  { symbol: "w", nextStatusSymbol: "v", type: "ON_HOLD" },
  { symbol: "I", nextStatusSymbol: " ", type: "TODO" },
  { symbol: "1", nextStatusSymbol: "1", type: "NON_TASK" },
];

describe("StatusRegistry", (): void => {
  const registry = new StatusRegistry(STATUSES);

  test("EMPTY reproduces the historical x/- behavior", (): void => {
    const empty = StatusRegistry.EMPTY;
    expect(empty.isChecked("x")).toBe(true);
    expect(empty.isChecked("-")).toBe(true);
    expect(empty.isChecked("w")).toBe(false);
    expect(empty.checkSymbol(" ")).toBe("x");
    expect(empty.uncheckSymbol("x")).toBe(" ");
  });

  test("EMPTY: snoozing a custom status is a no-op, not a reset to [ ] (#269)", (): void => {
    const empty = StatusRegistry.EMPTY;
    expect(empty.uncheckSymbol("/")).toBe("/");
    expect(empty.checkSymbol("-")).toBe("-");
  });

  test("DONE, CANCELLED and NON_TASK are checked; the rest are not", (): void => {
    for (const checked of ["x", "-", "v", "d", "1"]) {
      expect(registry.isChecked(checked)).toBe(true);
    }
    for (const unchecked of [" ", "w", "I"]) {
      expect(registry.isChecked(unchecked)).toBe(false);
    }
  });

  test("an unregistered symbol counts as TODO, like the Tasks plugin", (): void => {
    expect(registry.isChecked("?")).toBe(false);
  });

  test("duplicate symbols: only the first definition is used, like the Tasks plugin", (): void => {
    const dup = new StatusRegistry([
      { symbol: "-", nextStatusSymbol: "-", type: "CANCELLED" },
      { symbol: "-", nextStatusSymbol: " ", type: "TODO" },
    ]);
    expect(dup.isChecked("-")).toBe(true);
    expect(dup.uncheckSymbol("-")).toBe(" ");
  });

  test("checkSymbol follows nextStatusSymbol when it lands checked", (): void => {
    expect(registry.checkSymbol("w")).toBe("v");
    expect(registry.checkSymbol(" ")).toBe("x");
  });

  test("checkSymbol falls back to x when the next symbol is not checked", (): void => {
    // [I]'s next is " " (TODO): following it would not complete the line.
    expect(registry.checkSymbol("I")).toBe("x");
  });

  test("checkSymbol is a no-op on an already-checked symbol", (): void => {
    expect(registry.checkSymbol("v")).toBe("v");
  });

  test("uncheckSymbol follows nextStatusSymbol when it lands unchecked", (): void => {
    expect(registry.uncheckSymbol("v")).toBe(" ");
  });

  test("uncheckSymbol falls back to space on a self-loop like [d]", (): void => {
    expect(registry.uncheckSymbol("d")).toBe(" ");
  });

  test("uncheckSymbol is a no-op on an already-unchecked symbol", (): void => {
    expect(registry.uncheckSymbol("w")).toBe("w");
  });

  test("checkSymbol never lands on a symbol the registry reads as not checked", (): void => {
    // A registry that registers "x" as something other than done (or not at
    // all, next test) must not have Done write "x": the line would re-parse
    // as an active reminder and re-fire forever.
    const xIsTodo = new StatusRegistry([
      { symbol: "x", nextStatusSymbol: " ", type: "TODO" },
      { symbol: "v", nextStatusSymbol: " ", type: "DONE" },
    ]);
    const landed = xIsTodo.checkSymbol(" ");
    expect(landed).toBe("v");
    expect(xIsTodo.isChecked(landed)).toBe(true);
  });

  test("checkSymbol under a registry without x falls back to the first DONE entry", (): void => {
    const noX = new StatusRegistry([
      { symbol: "a", nextStatusSymbol: "b", type: "TODO" },
      { symbol: "v", nextStatusSymbol: " ", type: "DONE" },
    ]);
    // "a"'s next ("b") is unregistered, so it reads TODO and is skipped.
    expect(noX.checkSymbol("a")).toBe("v");
    // An unregistered symbol takes the same fallback.
    expect(noX.checkSymbol(" ")).toBe("v");
  });

  test("the setting merged with the defaults keeps Done working (#361 review)", (): void => {
    // The exact scenario from the review: a user on the default format adds
    // only the #269 line. Merged with the built-in defaults (user first, so
    // the user wins on duplicates), "- [x]" stays done and Done still
    // converges.
    const merged = new StatusRegistry(
      parseStatusSetting("[/] -> [x] IN_PROGRESS\n" + DEFAULT_STATUSES_TEXT),
    );
    expect(merged.isChecked("x")).toBe(true);
    expect(merged.checkSymbol(" ")).toBe("x");
    expect(merged.checkSymbol("/")).toBe("x");
    expect(merged.uncheckSymbol("x")).toBe(" ");
    // And the #269 behavior the user asked for still holds: snoozing an
    // in-progress line does not reset it.
    expect(merged.uncheckSymbol("/")).toBe("/");
  });

  test("isDone is DONE-only: a CANCELLED landing gets no done date", (): void => {
    expect(registry.isDone("v")).toBe(true);
    expect(registry.isDone("x")).toBe(true);
    expect(registry.isDone("-")).toBe(false);
    expect(registry.isDone("d")).toBe(false);
  });
});

describe("parseStatusSetting", (): void => {
  test("parses one status per line and skips unparseable lines", (): void => {
    const parsed = parseStatusSetting(
      "[w] -> [v] ON_HOLD\nnot a status line\n[ ] -> [x] TODO\n",
    );
    expect(parsed).toEqual([
      { symbol: "w", nextStatusSymbol: "v", type: "ON_HOLD" },
      { symbol: " ", nextStatusSymbol: "x", type: "TODO" },
    ]);
  });

  test("the type is case-normalized: a lowercase done still means DONE", (): void => {
    const registry = new StatusRegistry(parseStatusSetting("[x] -> [ ] done"));
    expect(registry.isChecked("x")).toBe(true);
    expect(registry.isDone("x")).toBe(true);
  });

  test("unknownStatusTypes surfaces typos, normalized and deduplicated", (): void => {
    expect(
      unknownStatusTypes("[x] -> [ ] DOME\n[v] -> [ ] dome\n[ ] -> [x] todo"),
    ).toEqual(["DOME"]);
    expect(unknownStatusTypes(DEFAULT_STATUSES_TEXT)).toEqual([]);
  });
});
