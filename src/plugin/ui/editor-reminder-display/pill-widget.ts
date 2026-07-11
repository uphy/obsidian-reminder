import type ReminderPlugin from "main";
import { modifyReminder, parseReminder } from "model/format";
import type { ReminderSpan } from "model/format";
import { MarkdownDocument } from "model/format/markdown";
import { EditorView, WidgetType } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import { showDateTimeChooserModal } from "plugin/ui/date-chooser-modal";
import { forceReminderPillRecompute } from "./state-effects";
import type { ReminderPillSpan } from "./types";
import ReminderPillComponent from "./ReminderPill.svelte";

/** Renders a single reminder's time text as a clickable "⏰ <time>" pill. */
export class ReminderPillWidget extends WidgetType {
  private component?: ReminderPillComponent;

  constructor(
    private readonly span: ReminderPillSpan,
    private readonly plugin: ReminderPlugin,
  ) {
    super();
  }

  override eq(other: ReminderPillWidget): boolean {
    // Compare content only, not positions: the click flow re-resolves the
    // reminder from the widget's current DOM position, so correctness never
    // depends on the captured span. Ignoring positions lets CodeMirror keep
    // the DOM of every pill below an unrelated edit instead of tearing it
    // down and rebuilding it on each decoration rebuild.
    return (
      this.span.text === other.span.text &&
      this.span.reminder.title === other.span.reminder.title
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("span");
    this.component = new ReminderPillComponent({
      target: container,
      props: {
        label: `⏰ ${this.span.reminder.time.toString()}`,
        title: `Reminder: ${this.span.reminder.title}`,
      },
    });
    this.component.$on("activate", () => {
      // Fire-and-forget: this is a user-initiated action from a DOM event
      // handler, there's nothing to await it against.
      void this.activate(view, container);
    });
    return container;
  }

  override destroy(): void {
    this.component?.$destroy();
    this.component = undefined;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private async activate(
    view: EditorView,
    container: HTMLElement,
  ): Promise<void> {
    try {
      await openChooserAndApplyEdit(view, this.plugin, container);
    } catch {
      // The chooser was cancelled (or a genuine failure occurred); either
      // way there's nothing to recover, leave the document untouched.
    }
  }
}

type ResolvedReminder = {
  md: MarkdownDocument;
  span: ReminderSpan;
};

/**
 * Re-resolves which reminder the pill at `container` refers to, against the
 * editor's *current* state.
 *
 * The click flow must not trust the `ReminderPillSpan` captured at
 * decoration-build time: after an edit elsewhere in the document, CodeMirror
 * only maps decoration positions until the debounced reparse lands, and the
 * `reminder.rowNumber` inside the captured object is never remapped — acting
 * on it could rewrite the wrong line. The widget's DOM position is always
 * current, so parse the current document and pick the reminder on the pill's
 * own line instead.
 */
function resolveReminderAt(
  view: EditorView,
  container: HTMLElement,
): ResolvedReminder | null {
  if (!view.dom.contains(container)) {
    // The widget was removed while e.g. the chooser modal was open;
    // posAtDOM() would throw on a detached node.
    return null;
  }
  const pos = view.posAtDOM(container);
  const line = view.state.doc.lineAt(pos);
  const filePath = view.state.field(editorInfoField, false)?.file?.path ?? "";
  const md = new MarkdownDocument(filePath, view.state.doc.toString());
  const candidates = parseReminder(md).filter(
    (span) => span.reminder.rowNumber === line.number - 1,
  );

  // Pick the span containing `pos`, or the nearest one on the line (a line
  // normally holds exactly one reminder anyway).
  let best: ReminderSpan | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const from = line.from + candidate.columnStart;
    const to = line.from + candidate.columnEnd;
    const distance =
      pos >= from && pos <= to
        ? 0
        : Math.min(Math.abs(pos - from), Math.abs(pos - to));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (best == null) {
    return null;
  }
  return { md, span: best };
}

/**
 * Opens the date/time chooser pre-filled with the reminder's current time,
 * then rewrites only the reminder's own line with the edited time.
 *
 * The reminder is resolved from the pill's DOM position twice: once to seed
 * the chooser, and again after the modal resolves — the modal can stay open
 * for a while and the document may change underneath it (e.g. via sync), so
 * the edit is always applied to the then-current resolution.
 */
async function openChooserAndApplyEdit(
  view: EditorView,
  plugin: ReminderPlugin,
  container: HTMLElement,
): Promise<void> {
  const initial = resolveReminderAt(view, container);
  if (initial == null) {
    return;
  }

  const chosen = await showDateTimeChooserModal(
    plugin.app,
    plugin.reminders,
    plugin.settings.reminderTimeStep.value,
    initial.span.reminder.time,
  );

  const current = resolveReminderAt(view, container);
  if (current == null) {
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
