/**
 * Pill widget DOM rendering and helpers
 */
import type { App } from "obsidian";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import type { PillContext, PillSpec, TokenSpan } from "./types";
import type { Reminders } from "../../../model/reminder";
import { DATE_TIME_FORMATTER, DateTime } from "../../../model/time";
import { showDateTimeChooserModal } from "../date-chooser-modal";
import { MarkdownDocument } from "../../../model/format/markdown";
import { forceReminderPillRecompute } from "./state-effects";
import type { EditorState } from "@codemirror/state";

// Minimal spec builder
export function specFrom(span: TokenSpan): PillSpec {
  const label = `⏰ ${span.text}`;
  const title = `Reminder: ${span.text}`;
  return { title, label, span };
}

export class PillWidget extends WidgetType {
  constructor(
    private spec: PillSpec,
    private ctx: PillContext,
  ) {
    super();
  }

  override eq(other: PillWidget): boolean {
    const a = this.spec,
      b = other.spec;
    return (
      a.label === b.label &&
      a.title === b.title &&
      a.span.from === b.span.from &&
      a.span.to === b.span.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement("span");
    root.className = "reminder-pill";
    root.setAttribute("role", "button");
    root.setAttribute("tabindex", "0");
    root.title = this.spec.title;

    // Prevent caret/click suppression
    root.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    try {
      root.addEventListener(
        "touchstart",
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
        { passive: false },
      );
    } catch {
      // ignore
    }

    const inner = document.createElement("span");
    inner.className = "reminder-pill__inner";
    inner.textContent = this.spec.label;
    root.appendChild(inner);

    const activate = async (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      await openChooserAndApply(view, this.ctx.app, this.spec.span);
    };
    root.addEventListener("click", activate);
    root.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") activate(e);
    });

    return root;
  }

  override ignoreEvent(event: Event): boolean {
    if (
      event.type === "mousedown" ||
      event.type === "click" ||
      event.type === "keydown"
    )
      return false;
    return true;
  }
}

// Selection preservation heuristic
function preservedSelection(
  prevSel: EditorState["selection"],
  span: TokenSpan,
  nextContent: string,
) {
  const prevHead = prevSel.main.head;
  const nextLen = nextContent.length;

  if (prevHead < span.from || prevHead > span.to) {
    const clamped = Math.max(0, Math.min(prevHead, nextLen));
    return { anchor: clamped, head: clamped };
  }

  const head = Math.min(span.to + 1, nextLen);
  return { anchor: head, head };
}

// Helper to get active file path
function getActiveFilePath(app: App): string {
  return app.workspace.getActiveFile()?.path ?? "untitled";
}

// Open chooser and apply full-text replacement
async function openChooserAndApply(
  view: EditorView,
  app: App,
  span: TokenSpan,
): Promise<void> {
  const content = view.state.doc.toString();
  const md = new MarkdownDocument(getActiveFilePath(app), content);

  let initialTime: DateTime | undefined;
  const rawTime = span.reminder?.time;
  if (rawTime != null) {
    if (typeof rawTime === "string") {
      const parsed = DATE_TIME_FORMATTER.parse(rawTime);
      if (parsed?.isValid()) {
        initialTime = parsed;
      }
    } else if (
      typeof rawTime === "object" &&
      typeof rawTime.toString === "function"
    ) {
      initialTime = rawTime as DateTime;
    }
  }

  const minimalReminders = {
    byDate: () => [],
    ...(initialTime && {
      reminderTime: { value: { toString: () => initialTime!.format("HH:mm") } },
    }),
  } as unknown as Reminders;

  const chosen = await showDateTimeChooserModal(app, minimalReminders);
  if (!chosen) return;

  try {
    // dynamic import to avoid circular dep; modifyReminder is exported from ../../../model/format/index
    const { modifyReminder } = await import("../../../model/format/index");
    const ok = await modifyReminder(md, span.reminder, { time: chosen });
    if (!ok) return;
  } catch {
    return;
  }

  const next = md.toMarkdown();
  const prevSel = view.state.selection;
  const nextSelection = preservedSelection(prevSel, span, next);

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
    selection: nextSelection,
  });
  view.dispatch({ effects: forceReminderPillRecompute.of() });

  queueMicrotask(() => {
    try {
      view.dispatch({ effects: forceReminderPillRecompute.of() });
    } catch {
      // view may be disposed
    }
  });
}

// Convenience to create a Decoration for replacement
export function pillReplace(
  from: number,
  to: number,
  widget: PillWidget,
): Decoration {
  return Decoration.replace({ widget, inclusive: false });
}
