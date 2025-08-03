/**
 * Span derivation and MarkdownDocument helpers
 */
import type { App } from "obsidian";
import type { EditorState } from "@codemirror/state";
import { MarkdownDocument } from "../../../model/format/markdown";
import type { ReminderSpan } from "../../../model/format";
import type { TokenSpan } from "./types";

// Helpers to build MarkdownDocument with active file path
export function getActiveFilePath(app: App): string {
  return app.workspace.getActiveFile()?.path ?? "untitled";
}

export function buildMarkdownDocument(
  app: App,
  content: string,
): MarkdownDocument {
  return new MarkdownDocument(getActiveFilePath(app), content);
}

// Derive spans directly from ReminderSpan columnStart/columnEnd and rowNumber.
// No regex; rely on parser-provided positions.
export function deriveSpans(
  md: MarkdownDocument,
  reminders: ReminderSpan[],
  state: EditorState,
): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const totalLines = state.doc.lines;

  // Build line start offsets for absolute position mapping.
  const lineStarts: number[] = [];
  for (let i = 1; i <= totalLines; i++) {
    lineStarts.push(state.doc.line(i).from);
  }

  for (const rs of reminders ?? []) {
    const rowNum: number | undefined = rs.reminder.rowNumber;
    if (typeof rowNum !== "number") {
      continue;
    }

    // rowNumber in Reminder is line index (0-based) for MarkdownDocument Todo
    const lineIdx0 = rowNum;
    if (lineIdx0 < 0 || lineIdx0 >= totalLines) {
      continue;
    }

    const lineStart = lineStarts[lineIdx0]!;
    const from = lineStart + (rs.columnStart ?? 0);
    const to = lineStart + (rs.columnEnd ?? 0);

    // Guard against invalid ranges
    if (!(Number.isFinite(from) && Number.isFinite(to) && from <= to)) {
      continue;
    }

    // Extract visible text for label
    const text = rs.reminder.time.toString();

    spans.push({
      from,
      to,
      row: lineIdx0,
      text,
      reminder: rs.reminder,
    });
  }

  spans.sort((a, b) => a.from - b.from);
  return spans;
}
