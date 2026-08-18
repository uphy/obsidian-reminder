import { StatusRegistry, parseStatusSetting } from "./status";
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

  test("EMPTY reproduces the historical behavior", (): void => {
    const empty = StatusRegistry.EMPTY;
    expect(empty.isChecked("x")).toBe(true);
    expect(empty.isChecked("-")).toBe(true);
    expect(empty.isChecked("w")).toBe(false);
    expect(empty.checkSymbol(" ")).toBe("x");
    expect(empty.uncheckSymbol("x")).toBe(" ");
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
});
