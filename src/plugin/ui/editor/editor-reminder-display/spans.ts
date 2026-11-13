import type { Text } from "@codemirror/state";
import type { ReminderSpan } from "model/format";
import type { ReminderPillSpan } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts parser-provided `ReminderSpan`s (line-relative UTF-16 columns,
 * addressed by `reminder.rowNumber`) into absolute `[from, to)` positions
 * within the given CodeMirror document.
 *
 * Spans whose row no longer exists (stale parse against a shorter document)
 * are dropped, positions are clamped to their line's bounds, and the result
 * is sorted by `from` with overlapping ranges skipped (keeping the earlier
 * one) so it's safe to feed straight into a `RangeSetBuilder`.
 */
export function deriveReminderPillSpans(
  doc: Text,
  reminderSpans: ReminderSpan[],
): ReminderPillSpan[] {
  const spans: ReminderPillSpan[] = [];
  for (const { reminder, columnStart, columnEnd } of reminderSpans) {
    const lineNumber = reminder.rowNumber + 1; // CM6 lines are 1-based.
    if (lineNumber < 1 || lineNumber > doc.lines) {
      continue;
    }
    const line = doc.line(lineNumber);
    const from = clamp(line.from + columnStart, line.from, line.to);
    const to = clamp(line.from + columnEnd, from, line.to);
    if (from >= to) {
      continue;
    }
    spans.push({ from, to, reminder, text: doc.sliceString(from, to) });
  }

  spans.sort((a, b) => a.from - b.from);

  const nonOverlapping: ReminderPillSpan[] = [];
  let lastTo = -1;
  for (const span of spans) {
    if (span.from < lastTo) {
      continue;
    }
    nonOverlapping.push(span);
    lastTo = span.to;
  }
  return nonOverlapping;
}
