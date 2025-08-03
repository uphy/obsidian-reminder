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
  const path = app.workspace.getActiveFile()?.path;
  return typeof path === "string" && path.length > 0 ? path : "untitled";
}

export function buildMarkdownDocument(
  app: App,
  content: string,
): MarkdownDocument {
  // MarkdownDocument constructor is expected to be safe; no micro try/catch
  return new MarkdownDocument(getActiveFilePath(app), content ?? "");
}

// Derive spans directly from ReminderSpan columnStart/columnEnd and rowNumber.
// No regex; rely on parser-provided positions.
export function deriveSpans(
  md: MarkdownDocument,
  reminders: ReminderSpan[],
  state: EditorState,
): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const totalLines = state?.doc?.lines ?? 0;

  if (!Number.isFinite(totalLines) || totalLines <= 0) {
    return [];
  }

  // Build line start offsets for absolute position mapping.
  const lineStarts: number[] = [];
  for (let i = 1; i <= totalLines; i++) {
    // state.doc.line(i) is valid for 1..lines; use bounds-checked loop
    const lineInfo = state.doc.line(i);
    lineStarts.push(lineInfo.from);
  }

  for (const rs of reminders ?? []) {
    if (!rs || !(rs as any).reminder) continue;

    const rowNum: unknown = (rs as any).reminder?.rowNumber;
    if (!Number.isInteger(rowNum)) continue;

    // rowNumber in Reminder is line index (0-based) for MarkdownDocument Todo
    const lineIdx0 = rowNum as number;
    if (lineIdx0 < 0 || lineIdx0 >= totalLines) continue;

    const lineStart = lineStarts[lineIdx0] ?? 0;

    const colStart = Number.isFinite(rs.columnStart ?? NaN)
      ? (rs.columnStart as number)
      : 0;
    const colEnd = Number.isFinite(rs.columnEnd ?? NaN)
      ? (rs.columnEnd as number)
      : colStart;

    let from = lineStart + Math.max(0, colStart);
    let to = lineStart + Math.max(colStart, colEnd);

    // Clamp into document bounds
    const docLen = state.doc.length;
    from = Math.max(0, Math.min(from, docLen));
    to = Math.max(from, Math.min(to, docLen));

    // Guard against invalid ranges
    if (!(Number.isFinite(from) && Number.isFinite(to) && from <= to)) continue;

    // Extract visible text for label safely
    let text = "";
    const t = (rs as any).reminder?.time;
    if (t != null) {
      if (typeof t === "string") text = t;
      else if (typeof t?.toString === "function") text = t.toString();
    }
    if (typeof text !== "string") text = "";

    spans.push({
      from,
      to,
      row: lineIdx0,
      text,
      reminder: (rs as any).reminder,
    });
  }

  spans.sort((a, b) => a.from - b.from);
  return spans;
}
