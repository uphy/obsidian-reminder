import type ReminderPlugin from "main";
import { modifyReminder, parseReminder } from "model/format";
import type { ReminderSpan } from "model/format";
import { MarkdownDocument } from "model/format/markdown";
import type { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import { showDateTimeChooserModal } from "plugin/ui/date-chooser-modal";
import { forceReminderPillRecompute } from "./state-effects";

/**
 * Where a clicked pill's reminder lives, as a 1-based CodeMirror line number.
 *
 * `preferPos` disambiguates a line that carries more than one reminder: the
 * span nearest that document position wins. A caller that knows only the line
 * leaves it out and takes the first reminder on it.
 */
export type ReminderLocation = {
  lineNumber: number;
  preferPos?: number;
};

/**
 * Locates the clicked reminder against the editor's *current* state, or
 * returns `null` when it can no longer be located (the pill was removed while
 * the chooser was open, say).
 *
 * This is a callback rather than a value because the click flow resolves
 * twice — before opening the chooser and again after it closes — and the
 * document can change in between.
 */
export type LocateReminder = () => ReminderLocation | null;

type ResolvedReminder = {
  md: MarkdownDocument;
  span: ReminderSpan;
};

/**
 * Parses the editor's current document and picks the reminder at `location`.
 *
 * The reminder is always re-parsed rather than taken from whatever was
 * captured when the pill was built: after an edit elsewhere in the document
 * that captured `rowNumber` is stale, and acting on it would rewrite the
 * wrong line.
 */
function resolveReminder(
  view: EditorView,
  location: ReminderLocation,
): ResolvedReminder | null {
  const { lineNumber, preferPos } = location;
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return null;
  }
  const line = view.state.doc.line(lineNumber);
  const filePath = view.state.field(editorInfoField, false)?.file?.path ?? "";
  const md = new MarkdownDocument(filePath, view.state.doc.toString());
  const candidates = parseReminder(md).filter(
    (span) => span.reminder.rowNumber === lineNumber - 1,
  );

  let best: ReminderSpan | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (preferPos === undefined) {
      return { md, span: candidate };
    }
    const from = line.from + candidate.columnStart;
    const to = line.from + candidate.columnEnd;
    const distance =
      preferPos >= from && preferPos <= to
        ? 0
        : Math.min(Math.abs(preferPos - from), Math.abs(preferPos - to));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best === null ? null : { md, span: best };
}

/**
 * Opens the date/time chooser pre-filled with the reminder's current time,
 * then rewrites only the reminder's own line with the edited time.
 *
 * `locate` is called twice — once to seed the chooser, and again after the
 * modal resolves, since the modal can stay open for a while and the document
 * may change underneath it (e.g. via sync).
 */
export async function openChooserAndApplyEdit(
  view: EditorView,
  plugin: ReminderPlugin,
  locate: LocateReminder,
): Promise<void> {
  const initialLocation = locate();
  if (initialLocation === null) {
    return;
  }
  const initial = resolveReminder(view, initialLocation);
  if (initial === null) {
    return;
  }

  const chosen = await showDateTimeChooserModal(
    plugin.app,
    plugin.reminders,
    plugin.settings.reminderTimeStep.value,
    Number(plugin.settings.weekStart.value),
    initial.span.reminder.time,
  );

  const currentLocation = locate();
  if (currentLocation === null) {
    return;
  }
  const current = resolveReminder(view, currentLocation);
  if (current === null) {
    return;
  }

  const modified = await modifyReminder(current.md, current.span.reminder, {
    time: chosen,
  });
  if (!modified) {
    return;
  }

  const rowNumber = current.span.reminder.rowNumber;
  const newLine = current.md.toMarkdown().split("\n")[rowNumber] ?? "";
  const line = view.state.doc.line(rowNumber + 1);
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newLine },
    effects: [forceReminderPillRecompute.of()],
  });
}
