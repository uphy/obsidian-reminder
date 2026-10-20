/**
 * A task-status definition, shaped after the Tasks plugin's status settings
 * (`statusSettings.coreStatuses`/`customStatuses` in its data.json): which
 * symbol sits between the brackets, which symbol a click writes next, and
 * what the status means.
 */
export type TaskStatus = {
  symbol: string;
  nextStatusSymbol: string;
  type: string; // TODO | IN_PROGRESS | DONE | CANCELLED | ON_HOLD | NON_TASK
};

/**
 * Resolves what a checkbox symbol means and what checking/unchecking writes.
 *
 * With no statuses configured (`EMPTY`), this reproduces the plugin's
 * historical behavior exactly: "x" and "-" count as checked, checking writes
 * "x", unchecking writes " ". With statuses, it follows the Tasks plugin's
 * rules: DONE/CANCELLED/NON_TASK symbols count as checked (NON_TASK lines are
 * not tasks at all, so they must never arm a reminder), an unregistered
 * symbol counts as TODO, duplicate symbols keep only the first definition
 * (matching Tasks: "It silently ignores any duplicate symbols: only the
 * first will be used"), and state changes advance one `nextStatusSymbol`
 * step when that step lands in the desired state.
 */
export class StatusRegistry {
  static readonly EMPTY = new StatusRegistry([]);
  private static readonly checkedTypes = ["DONE", "CANCELLED", "NON_TASK"];

  private bySymbol: Map<string, TaskStatus> = new Map();

  constructor(statuses: Array<TaskStatus>) {
    for (const status of statuses) {
      if (!this.bySymbol.has(status.symbol)) {
        this.bySymbol.set(status.symbol, status);
      }
    }
  }

  public isEmpty(): boolean {
    return this.bySymbol.size === 0;
  }

  public isChecked(symbol: string): boolean {
    if (this.isEmpty()) {
      return symbol === "x" || symbol === "-";
    }
    const status = this.bySymbol.get(symbol);
    if (status == null) {
      return false;
    }
    return StatusRegistry.checkedTypes.includes(status.type);
  }

  /** Whether completing a line that landed on `symbol` should stamp a ✅ done date. */
  public isDone(symbol: string): boolean {
    if (this.isEmpty()) {
      return true;
    }
    return this.bySymbol.get(symbol)?.type === "DONE";
  }

  /**
   * The symbol that "check this line" writes, given the current symbol.
   * Already in the desired state is a no-op in both directions — which is
   * what keeps a snooze from resetting a custom status like [/] back to
   * [ ] (uphy/obsidian-reminder#269): the snooze path calls
   * `setChecked(false)` unconditionally.
   */
  public checkSymbol(symbol: string): string {
    if (this.isChecked(symbol)) {
      return symbol;
    }
    if (this.isEmpty()) {
      return "x";
    }
    const next = this.bySymbol.get(symbol)?.nextStatusSymbol;
    if (next != null && this.isChecked(next)) {
      return next;
    }
    // The fallback must land on a symbol this registry agrees is checked:
    // writing a blind "x" under a registry that classifies "x" as not-done
    // makes Done never converge — the line re-parses as an active reminder
    // and re-fires every check interval. Unlike uncheckSymbol below, which
    // can fall back to " " unconditionally (an unregistered symbol is TODO,
    // so " " always lands unchecked), checkSymbol has to look at where it
    // is falling back to.
    if (this.isChecked("x")) {
      return "x";
    }
    for (const status of this.bySymbol.values()) {
      if (status.type === "DONE") {
        return status.symbol;
      }
    }
    // A registry with no DONE entry and an unchecked "x" has no symbol that
    // completes anything; keep the historical write rather than inventing one.
    return "x";
  }

  /** See `checkSymbol` — same rules, mirrored. */
  public uncheckSymbol(symbol: string): string {
    if (!this.isChecked(symbol)) {
      return symbol;
    }
    if (this.isEmpty()) {
      return " ";
    }
    const next = this.bySymbol.get(symbol)?.nextStatusSymbol;
    if (next != null && !this.isChecked(next)) {
      return next;
    }
    return " ";
  }
}

/**
 * The historical x/- behavior written out as statuses: the merge fallback for
 * the "Task statuses" setting when the Tasks plugin has nothing to seed from.
 * A user line that redefines one of these symbols wins (the registry keeps
 * the first definition per symbol, and user lines come first).
 */
export const DEFAULT_STATUSES_TEXT = [
  "[ ] -> [x] TODO",
  "[x] -> [ ] DONE",
  "[-] -> [ ] CANCELLED",
].join("\n");

/** The status types the registry understands; anything else reads as TODO. */
export const STATUS_TYPES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "ON_HOLD",
  "NON_TASK",
];

/**
 * Parses the "Task statuses" setting text, one status per line:
 *
 *     [w] -> [v] ON_HOLD
 *
 * Unparseable lines are skipped rather than failing the whole setting, so a
 * half-typed line never silently reverts every status to the defaults. The
 * type is case-normalized ("done" means DONE); an unknown type is kept as
 * written and reads as TODO — `unknownStatusTypes` exists so the settings UI
 * can say so, since free text has no dropdown to make the valid set visible.
 */
export function parseStatusSetting(text: string): Array<TaskStatus> {
  const statuses: Array<TaskStatus> = [];
  for (const line of text.split("\n")) {
    const match = /^\s*\[(.)\]\s*->\s*\[(.)\]\s+(\w+)\s*$/.exec(line);
    if (match) {
      statuses.push({
        symbol: match[1]!,
        nextStatusSymbol: match[2]!,
        type: match[3]!.toUpperCase(),
      });
    }
  }
  return statuses;
}

/**
 * The types in `text` that no status semantics back — a typo like "DOME"
 * silently makes its symbol not-done otherwise. Returned normalized and
 * deduplicated, for the settings UI to surface.
 */
export function unknownStatusTypes(text: string): Array<string> {
  const unknown = new Set<string>();
  for (const status of parseStatusSetting(text)) {
    if (!STATUS_TYPES.includes(status.type)) {
      unknown.add(status.type);
    }
  }
  return [...unknown];
}

/** Inverse of `parseStatusSetting`, used to render a seeded registry. */
export function formatStatusSetting(statuses: Array<TaskStatus>): string {
  return statuses
    .map((s) => `[${s.symbol}] -> [${s.nextStatusSymbol}] ${s.type}`)
    .join("\n");
}
