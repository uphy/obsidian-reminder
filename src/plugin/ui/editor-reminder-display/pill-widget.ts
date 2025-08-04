/**
 * Pill widget DOM rendering and helpers
 */
import type { App } from "obsidian";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { DateTime } from "../../../model/time";
import { showDateTimeChooserModal } from "../date-chooser-modal";
import { MarkdownDocument } from "../../../model/format/markdown";
import { modifyReminder } from "../../../model/format/index";
import { forceReminderPillRecompute } from "./state-effects";
import type { PillContext, PillSpec, TokenSpan } from "./types";

// Minimal spec builder with guards
export function specFrom(span: TokenSpan): PillSpec {
  const safeText = typeof span?.text === "string" ? span.text : "";
  const label = `⏰ ${safeText}`;
  const title = `Reminder: ${safeText}`;
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
    try {
      const root = document.createElement("span");
      root.className = "reminder-pill";
      root.setAttribute("role", "button");
      root.setAttribute("tabindex", "0");
      root.title = this.spec?.title ?? "";

      // Prevent caret/click suppression
      root.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      root.addEventListener(
        "touchstart",
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
        { passive: false },
      );

      const inner = document.createElement("span");
      inner.className = "reminder-pill__inner";
      inner.textContent = this.spec?.label ?? "";
      root.appendChild(inner);

      const activate = async (ev: Event) => {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          await openChooserAndApply(view, this.ctx.app, this.spec.span);
        } catch {
          // swallow activation errors to avoid breaking the editor
        }
      };

      root.addEventListener("click", activate);
      root.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") activate(e);
      });

      return root;
    } catch {
      // Fallback plain element
      const fallback = document.createElement("span");
      fallback.textContent = this.spec?.label ?? "";
      return fallback;
    }
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
  const prevHead =
    typeof prevSel?.main?.head === "number" ? prevSel.main.head : 0;
  const nextLen = Number.isFinite(nextContent?.length) ? nextContent.length : 0;

  const from = Number.isFinite(span?.from) ? span.from : 0;
  const to = Number.isFinite(span?.to) ? span.to : from;

  if (prevHead < from || prevHead > to) {
    const clamped = Math.max(0, Math.min(prevHead, nextLen));
    return { anchor: clamped, head: clamped };
  }

  const head = Math.min(to + 1, nextLen);
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
  // 1) Capture content and build MarkdownDocument
  let content = "";
  let md: MarkdownDocument;
  {
    const maybe = view?.state?.doc;
    content = typeof maybe?.toString === "function" ? maybe.toString() : "";
    md = new MarkdownDocument(getActiveFilePath(app), content);
  }

  // 2) Get reminders from plugin
  const reminders = app.plugins.plugins["obsidian-reminder-plugin"]?.reminders;
  if (!reminders) {
    console.warn("Reminder plugin not available");
    return;
  }

  // 3) Open modal - wrap whole async step to guard UI failure
  let chosen: string | DateTime | undefined;
  try {
    chosen = await showDateTimeChooserModal(app, reminders);
  } catch {
    chosen = undefined;
  }
  if (!chosen) return;

  // 4) Modify reminder and compute next markdown
  try {
    const ok = await modifyReminder(md, span.reminder, {
      time: chosen,
    });
    if (!ok) return;
  } catch {
    return;
  }
  const next = (() => {
    try {
      return md.toMarkdown();
    } catch {
      return content;
    }
  })();

  // 5) Compute next selection (no try/catch needed)
  const prevSel = view.state.selection;
  const nextSelection = preservedSelection(prevSel, span, next);

  // 6) Dispatch changes and force recompute
  try {
    const docLen = view.state.doc.length ?? next.length;
    view.dispatch({
      changes: { from: 0, to: docLen, insert: next },
      selection: nextSelection,
    });
    view.dispatch({ effects: forceReminderPillRecompute.of() });
  } catch {
    // ignore dispatch failures
  }

  // 7) Defensive microtask recompute (keep per user preference)
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
