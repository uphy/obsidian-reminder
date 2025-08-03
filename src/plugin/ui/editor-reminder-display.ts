/**
 * Editor Reminder Inline Display (CodeMirror v6 scaffolding)
 *
 * This file scaffolds the CM6 extension for inline reminder "pill" decorations.
 * It intentionally contains only the minimal structure for Phase 1 Subtask 1.
 *
 * Design reference:
 * - Implementation Tasks:
 *   https://github.com/uphy/obsidian-reminder/blob/main/.roo/docs/2025-08-03-obsidian-reminder-inline-display-design-detailed.md#implementation-tasks
 * - CodeMirror v6 Extension Design:
 *   https://github.com/uphy/obsidian-reminder/blob/main/.roo/docs/2025-08-03-obsidian-reminder-inline-display-design-detailed.md#codemirror-v6-extension-design
 *
 * Notes:
 * - The compute function is stubbed to return Decoration.none (no decorations).
 * - No span derivation, widget rendering, activation behaviors, or CSS injection are implemented yet.
 * - This file should compile standalone within the repo's TypeScript setup.
 */

import type { App } from "obsidian";
import {
  type Extension,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";

// Model format imports
import { MarkdownDocument } from "../../model/format/markdown";
import {
  type ReminderSpan,
  modifyReminder,
  parseReminder,
} from "../../model/format";
import type { Reminders } from "../../model/reminder";
import { DATE_TIME_FORMATTER, DateTime } from "../../model/time";
import { showDateTimeChooserModal } from "./date-chooser-modal";

// Internal types for span derivation and pill specs
export interface TokenSpan {
  from: number;
  to: number;
  row: number;
  text: string;
  reminder: any; // TODO: refine to repository Reminder type
}

export interface PillSpec {
  title: string;
  label: string;
  span: TokenSpan;
}

// Feature flag: Live Preview pill decorations enabled (design 171–195)
// Turned on to render pills when caret is outside the token span.
// TODO(dev): TEMP enable during development to verify immediate re-render behavior. Revert to false/default gate before release.
const PILL_DECORATIONS_ENABLED = true as const;

/**
 * CSS Injection per design doc:
 * See ".roo/docs/2025-08-03-obsidian-reminder-inline-display-design-detailed.md" sections:
 * - "Styling Spec"
 * - "CSS Injection"
 * This injector is idempotent across multiple editor views.
 */
let reminderPillStylesInjected = false;
export function ensureReminderPillStylesInjected(): void {
  if (reminderPillStylesInjected) return;
  const style = document.createElement("style");
  style.setAttribute("data-reminder-pill-styles", "true");
  style.textContent = `
.reminder-pill {
  background: var(--tag-background);
  border: 1px solid var(--tag-border-color);
  color: var(--text-normal);
  border-radius: calc(var(--radius-s) + 4px);
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.reminder-pill:hover, .reminder-pill:focus {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 1px;
  background: color-mix(in srgb, var(--tag-background) 85%, var(--interactive-accent) 15%);
}
.reminder-pill__inner { font-size: 0.95em; }
  `.trim();
  document.head.appendChild(style);
  reminderPillStylesInjected = true;
}

// Helpers to build MarkdownDocument with active file path
function getActiveFilePath(app: App): string {
  return app.workspace.getActiveFile()?.path ?? "untitled";
}

function buildMarkdownDocument(app: App, content: string): MarkdownDocument {
  return new MarkdownDocument(getActiveFilePath(app), content);
}

// Derive spans directly from ReminderSpan columnStart/columnEnd and rowNumber.
// No regex; rely on parser-provided positions.
function deriveSpans(
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

// Pill widget class rendering minimal DOM per design
interface PillContext {
  app: App;
}

class PillWidget extends WidgetType {
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
    // TODO(a11y): Add aria-label content per design.
    const inner = document.createElement("span");
    inner.className = "reminder-pill__inner";
    inner.textContent = this.spec.label;
    root.appendChild(inner);
    // Event handlers (activation wires to chooser)
    const activate = async (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      await openChooserAndApply(view, this.ctx.app, this.spec.span);
    };
    root.addEventListener("click", activate);
    root.addEventListener("keydown", (e: KeyboardEvent) => {
      // TODO(keyboard): Confirm keyboard activation behavior per design.
      if (e.key === "Enter" || e.key === " ") activate(e);
    });
    return root;
  }
  override ignoreEvent(event: Event): boolean {
    // Allow click and keydown to be handled; ignore others by default.
    if (
      event.type === "mousedown" ||
      event.type === "click" ||
      event.type === "keydown"
    )
      return false;
    return true;
  }
}

// Caret suppression helper

// Helper to build minimal spec from a span
function specFrom(span: TokenSpan): PillSpec {
  // Minimal placeholder label; real formatting to be added later.
  const label = `⏰ ${span.text}`;
  const title = `Reminder: ${span.text}`;
  return { title, label, span };
}

/**
 * Effect to force recomputing reminder pill decorations.
 * Exported to allow external triggers (e.g., command or model changes).
 */
export const forceReminderPillRecompute = StateEffect.define<void>();

// Selection preservation heuristic
function preservedSelection(
  prevSel: EditorState["selection"],
  span: TokenSpan,
  nextContent: string,
  approxRow: number,
) {
  const prevHead = prevSel.main.head;
  const nextLen = nextContent.length;

  // If previous head was outside the token, preserve position within new bounds.
  if (prevHead < span.from || prevHead > span.to) {
    const clamped = Math.max(0, Math.min(prevHead, nextLen));
    return { anchor: clamped, head: clamped };
  }

  // With absolute spans, keep selection simple:
  // If caret was inside the updated token, place it just after the old span end,
  // clamped within the next content bounds.
  const head = Math.min(span.to + 1, nextLen);
  return { anchor: head, head };
}

// Open chooser and apply full-text replacement
async function openChooserAndApply(
  view: EditorView,
  app: App,
  span: TokenSpan,
): Promise<void> {
  const content = view.state.doc.toString();
  const md = new MarkdownDocument(getActiveFilePath(app), content);

  // Determine initial time in the correct type.
  // If span.reminder?.time is a string, parse via DATE_TIME_FORMATTER.parse(...)
  //   - See (src/model/time.ts:326) DATE_TIME_FORMATTER.parse
  // If it is already a DateTime, pass it through.
  // Otherwise pass undefined so chooser starts empty.
  let initialTime: DateTime | undefined;
  const rawTime = span.reminder?.time;
  if (rawTime != null) {
    if (typeof rawTime === "string") {
      const parsed = DATE_TIME_FORMATTER.parse(rawTime); // (src/model/time.ts:326)
      if (parsed?.isValid()) {
        initialTime = parsed;
      }
    } else if (
      typeof rawTime === "object" &&
      typeof rawTime.toString === "function"
    ) {
      // Best-effort runtime type guard for DateTime-like
      initialTime = rawTime as DateTime;
    }
  }

  // Call chooser with the exact signature (src/plugin/ui/date-chooser-modal.ts:56-71 showDateTimeChooserModal()):
  //   showDateTimeChooserModal(app: App, reminders: Reminders, timeStep?: number): Promise<DateTime>
  // Pass only the required Reminders methods used by the chooser UI:
  // - DateTimeChooser.svelte reads reminders.byDate(DateTime) (src/ui/DateTimeChooser.svelte:35-37).
  // - It also reads reminders.reminderTime?.value.toString() (src/ui/DateTimeChooser.svelte:13), so if we don't have a valid initial time,
  //   omit reminderTime entirely to avoid undefined.toString() issues.
  const minimalReminders = {
    byDate: () => [],
    ...(initialTime && {
      reminderTime: { value: { toString: () => initialTime!.format("HH:mm") } },
    }),
  } as unknown as Reminders;

  const chosen = await showDateTimeChooserModal(app, minimalReminders);
  if (!chosen) return;

  try {
    // reminder typed as any for now; TODO refine typing
    const ok = await modifyReminder(md, span.reminder, { time: chosen });
    if (!ok) {
      return;
    }
  } catch (e) {
    // Keep quiet in production
    return;
  }

  const next = md.toMarkdown();
  const prevSel = view.state.selection;

  // Compute new selection strictly after the updated token end within next content.
  const nextSelection = preservedSelection(prevSel, span, next, span.row);

  // Single dispatch including changes and selection; then force recompute immediately.
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
    selection: nextSelection,
  });
  view.dispatch({ effects: forceReminderPillRecompute.of() });

  // Keep microtask re-dispatch as safeguard across editor timing edge cases.
  queueMicrotask(() => {
    try {
      view.dispatch({ effects: forceReminderPillRecompute.of() });
    } catch {
      // view may be disposed
    }
  });
}

/**
 * StateField that holds the set of inline decorations for reminder "pills".
 * For Subtask 1, the field always returns Decoration.none.
 */
const createReminderPillField = (app: App) =>
  StateField.define<DecorationSet>({
    create: (state) => {
      // Parse reminders and derive spans
      const content = state.doc.toString();
      const md = buildMarkdownDocument(app, content);
      let reminders: ReminderSpan[] = [];
      try {
        reminders = parseReminder(md);
      } catch {
        reminders = [];
      }
      const spans = deriveSpans(md, reminders, state);
      const ctx: PillContext = { app };

      // Build decorations when enabled; suppress replacement where caret is inside span.
      // TODO(reading-view): Phase 2 will add unconditional decoration via separate processor.
      if (!PILL_DECORATIONS_ENABLED) return Decoration.none;
      const builder = new RangeSetBuilder<Decoration>();
      const head = state.selection.main.head;
      for (const s of spans) {
        if (head >= s.from && head <= s.to) {
          continue; // suppress where caret inside
        }
        try {
          builder.add(
            s.from,
            s.to,
            Decoration.replace({
              widget: new PillWidget(specFrom(s), ctx),
              inclusive: false,
            }),
          );
        } catch (e) {
          // ignore decoration errors silently
        }
      }
      const set = builder.finish();
      return set;
    },

    update: (value, tr) => {
      // Recompute on doc changes or explicit effects
      if (
        tr.docChanged ||
        tr.effects.some((e) => e.is(forceReminderPillRecompute))
      ) {
        const content = tr.state.doc.toString();
        const md = buildMarkdownDocument(app, content);
        let reminders: ReminderSpan[] = [];
        try {
          reminders = parseReminder(md);
        } catch {
          reminders = [];
        }
        const spans = deriveSpans(md, reminders, tr.state);
        const ctx: PillContext = { app };

        // Apply suppression in update path as well.
        // TODO(opt): Consider debouncing selectionSet updates to reduce recompute churn.
        if (!PILL_DECORATIONS_ENABLED) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const head = tr.state.selection.main.head;
        for (const s of spans) {
          if (head >= s.from && head <= s.to) {
            continue; // suppress where caret inside
          }
          try {
            builder.add(
              s.from,
              s.to,
              Decoration.replace({
                widget: new PillWidget(specFrom(s), ctx),
                inclusive: false,
              }),
            );
          } catch (e) {
            // ignore decoration errors silently
          }
        }
        const set = builder.finish();
        return set;
      }
      return value;
    },

    provide: (f) => EditorView.decorations.from(f),
  });

/**
 * Factory for the reminder pill CM6 extension set.
 * Currently returns only the StateField; styles and behaviors will be added later.
 */
export function createReminderPillExtension(app: App): Extension[] {
  ensureReminderPillStylesInjected();
  const reminderPillField = createReminderPillField(app);
  return [reminderPillField];
}
