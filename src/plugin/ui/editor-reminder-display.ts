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
import { modifyReminder, parseReminder } from "../../model/format";
import { showDateTimeChooserModal } from "./date-chooser-modal";
import type { Reminders } from "../../model/reminder";
import { DateTime, DATE_TIME_FORMATTER } from "../../model/time";

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
// Dev logging flag to trace compute/update flow without noisy production logs
const DEV_DEBUG_PILLS = true as const;

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

// Derive spans from parsed reminders and the markdown document.
// Best-effort format-agnostic span location using regex heuristics.
// See design: "Parse and Span Derivation".
function deriveSpans(
  md: MarkdownDocument,
  reminders: any[],
  state: EditorState,
): TokenSpan[] {
  if (DEV_DEBUG_PILLS) {
    try {
      console.debug?.("[pill] deriveSpans:start", {
        docLen: state.doc.length,
        lines: state.doc.lines,
        remindersCount: reminders?.length ?? 0,
      });
    } catch {}
  }
  // 1) Build lineStarts and line texts via CodeMirror API
  const lineStarts: number[] = [];
  const lineTexts: string[] = [];
  const totalLines = state.doc.lines;
  for (let i = 1; i <= totalLines; i++) {
    const line = state.doc.line(i);
    lineStarts.push(line.from);
    lineTexts.push(line.text);
  }

  // 2) Per-line cache for disambiguation of multiple matches
  interface LineCache {
    used: Array<{ from: number; to: number }>;
  }
  const lineCaches = new Map<number, LineCache>();
  function getLineCache(idx: number): LineCache {
    let c = lineCaches.get(idx);
    if (!c) {
      c = { used: [] };
      lineCaches.set(idx, c);
    }
    return c;
  }
  function overlaps(
    a: { from: number; to: number },
    b: { from: number; to: number },
  ): boolean {
    return a.from < b.to && b.from < a.to;
  }

  // 3) Token regexes
  //    - FULL_REMINDER_RE: preferred, matches the entire reminder token including leading icon/marker
  //      Examples:
  //        - "📅 2025-08-03 12:30"
  //        - "⏰ 14:00"
  //        - "- [ ] Task ⏰ 14:00"
  //        - "@remind 📆 2025/8/3 7:05"
  //      It captures the whole token so the pill replaces the full reminder syntax.
  //    - TOKEN_RE: fallback matcher for just date/time-like segments when full token cannot be confidently found.
  const FULL_REMINDER_RE =
    /(?:@remind\s+)?(?:(?:⏰|📅|📆)\s*)\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\b(?:@remind\s+)?(?:⏰|📅|📆)\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?/g;
  const TOKEN_RE =
    /(?:⏰|📅|📆)?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)/g;

  const spans: TokenSpan[] = [];

  // Helper to map model row to CodeMirror line index (0-based)
  function resolveLineIndex(rowNumber: number): number | null {
    // Defensive: try as 0-based first (repo tests hint internal logic uses 0-based),
    // then 1-based, then +/-1 fallback within bounds.
    const candidates: number[] = [];
    // 0-based direct
    if (Number.isInteger(rowNumber)) candidates.push(rowNumber);
    // 1-based -> 0-based
    candidates.push(rowNumber - 1);
    // Fallbacks
    candidates.push(rowNumber + 1);
    candidates.push(rowNumber - 2);

    for (const c of candidates) {
      if (c >= 0 && c < totalLines) return c;
    }
    return null;
  }

  for (const reminder of reminders ?? []) {
    // Expect parser to provide rowNumber; skip if absent
    const rowNum: number | undefined = reminder?.rowNumber;
    if (typeof rowNum !== "number") {
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] deriveSpans:skip-reminder-no-row", {
            reminder,
          });
        } catch {}
      }
      continue;
    }

    const lineIdx = resolveLineIndex(rowNum);
    if (lineIdx == null) {
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] deriveSpans:skip-reminder-line-oob", {
            rowNum,
          });
        } catch {}
      }
      continue;
    }

    const lineText = lineTexts[lineIdx] ?? "";
    if (!lineText) {
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] deriveSpans:skip-empty-line", { lineIdx });
        } catch {}
      }
      continue;
    }

    // 4) Run regex left-to-right and select first non-overlapping match on this line
    // Prefer FULL_REMINDER_RE; fallback to TOKEN_RE if nothing found.
    let match: RegExpExecArray | null;
    const lineCache = getLineCache(lineIdx);
    let chosenLocalRange: { from: number; to: number } | null = null;
    let chosenText: string | null = null;
    let chosenSource: "FULL" | "FALLBACK" | null = null;

    // First pass: FULL_REMINDER_RE
    FULL_REMINDER_RE.lastIndex = 0;
    while ((match = FULL_REMINDER_RE.exec(lineText)) !== null) {
      const matchText = match[0];
      const start = match.index;
      const end = start + matchText.length;

      const candidate = { from: start, to: end };
      const conflicts = lineCache.used.some((u) => overlaps(u, candidate));
      if (!conflicts) {
        chosenLocalRange = candidate;
        chosenText = matchText.trim();
        chosenSource = "FULL";
        break;
      }
    }

    // Second pass: fallback TOKEN_RE
    if (!chosenLocalRange || !chosenText) {
      TOKEN_RE.lastIndex = 0;
      while ((match = TOKEN_RE.exec(lineText)) !== null) {
        const matchText = match[0];
        const start = match.index;
        const end = start + matchText.length;

        const candidate = { from: start, to: end };
        const conflicts = lineCache.used.some((u) => overlaps(u, candidate));
        if (!conflicts) {
          chosenLocalRange = candidate;
          chosenText = matchText.trim();
          chosenSource = "FALLBACK";
          break;
        }
      }
    }

    if (!chosenLocalRange || !chosenText) {
      // No confident match found for this reminder on the designated line; skip.
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] deriveSpans:no-token-match", {
            lineIdx,
            lineText,
          });
        } catch {}
      }
      continue;
    }

    if (DEV_DEBUG_PILLS) {
      try {
        console.debug?.("[pill] deriveSpans:match", {
          lineIdx,
          source: chosenSource,
          range: chosenLocalRange,
          text: chosenText,
        });
      } catch {}
    }

    // 5) Compute absolute offsets and record used range for the line
    const localRange = chosenLocalRange as { from: number; to: number };
    const absFrom = lineStarts[lineIdx]! + localRange.from;
    const absTo = lineStarts[lineIdx]! + localRange.to;
    lineCache.used.push({
      from: localRange.from,
      to: localRange.to,
    });

    spans.push({
      from: absFrom,
      to: absTo,
      row: lineIdx, // store resolved 0-based row for now
      text: chosenText,
      reminder,
    });
  }

  // 6) Return spans in document order
  spans.sort((a, b) => a.from - b.from);
  if (DEV_DEBUG_PILLS) {
    try {
      console.debug?.("[pill] deriveSpans:done", {
        spansCount: spans.length,
        firstSpans: spans.slice(0, 3),
      });
    } catch {}
  }
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
    if (DEV_DEBUG_PILLS) {
      try {
        console.debug?.("[pill] preservedSelection:outside-token", {
          prevHead,
          clamped,
          nextLen,
        });
      } catch {}
    }
    return { anchor: clamped, head: clamped };
  }

  // Local helper: find updated token end within nextContent at approxRow.
  // Mirrors deriveSpans' heuristic with a conservative datetime/time regex.
  function findUpdatedTokenEndInNextLocal(
    next: string,
    rowHint: number,
  ): number | null {
    try {
      // Prefer FULL_REMINDER_RE-like range; fallback to TOKEN-like range.
      const FULL_LOCAL =
        /(?:@remind\s+)?(?:(?:⏰|📅|📆)\s*)\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\b(?:@remind\s+)?(?:⏰|📅|📆)\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?/g;
      const TOKEN_LOCAL =
        /(?:⏰|📅|📆)?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)/g;
      const lines = next.split(/\r?\n/);
      if (lines.length === 0) return null;
      const row = Math.max(0, Math.min(rowHint ?? 0, lines.length - 1));
      const lineText = lines[row] ?? "";
      if (!lineText) return null;

      // Try FULL
      FULL_LOCAL.lastIndex = 0;
      let m = FULL_LOCAL.exec(lineText);
      if (!m) {
        // fallback
        TOKEN_LOCAL.lastIndex = 0;
        m = TOKEN_LOCAL.exec(lineText);
      }
      if (!m) return null;

      const localStart = m.index;
      const localEnd = localStart + m[0].length;
      let abs = 0;
      for (let i = 0; i < row; i++) {
        abs += (lines[i]?.length ?? 0) + 1; // +1 for newline
      }
      const absEnd = abs + localEnd;
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] findUpdatedTokenEndInNextLocal", {
            approxRow: rowHint,
            resolvedRow: row,
            lineSample: lineText.slice(0, 120),
            localStart,
            localEnd,
            absEnd,
          });
        } catch {}
      }
      return absEnd;
    } catch {
      return null;
    }
  }

  // If caret was inside the updated token, deterministically relocate after the
  // token in the NEXT content by scanning the approx row using the local regex.
  const end = findUpdatedTokenEndInNextLocal(nextContent, approxRow);
  const head =
    end != null ? Math.min(end + 1, nextLen) : Math.min(span.to + 1, nextLen);

  if (DEV_DEBUG_PILLS) {
    try {
      console.debug?.("[pill] preservedSelection:inside-token", {
        prevHead,
        spanFrom: span.from,
        spanTo: span.to,
        approxRow,
        computedEnd: end,
        finalHead: head,
        nextLen,
      });
    } catch {}
  }
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
    // Keep quiet, optional debug
    console.debug?.("modifyReminder failed", e);
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
      let reminders: any[] = [];
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
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] build:create", {
            head,
            spansCount: spans.length,
            spansPreview: spans.slice(0, 3),
          });
        } catch {}
      }
      for (const s of spans) {
        if (head >= s.from && head <= s.to) {
          if (DEV_DEBUG_PILLS) {
            try {
              console.debug?.("[pill] build:create:skip-caret-inside", {
                head,
                span: s,
              });
            } catch {}
          }
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
          if (DEV_DEBUG_PILLS) {
            try {
              console.debug?.("[pill] build:create:builder-add-error", {
                e,
                span: s,
              });
            } catch {}
          }
        }
      }
      const set = builder.finish();
      if (DEV_DEBUG_PILLS) {
        try {
          console.debug?.("[pill] build:create:finish", {
            empty: set?.size === 0,
          });
        } catch {}
      }
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
        let reminders: any[] = [];
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
        if (DEV_DEBUG_PILLS) {
          try {
            console.debug?.("[pill] build:update", {
              head,
              spansCount: spans.length,
              spansPreview: spans.slice(0, 3),
              docChanged: tr.docChanged,
              effects: tr.effects?.length ?? 0,
            });
          } catch {}
        }
        for (const s of spans) {
          if (head >= s.from && head <= s.to) {
            if (DEV_DEBUG_PILLS) {
              try {
                console.debug?.("[pill] build:update:skip-caret-inside", {
                  head,
                  span: s,
                });
              } catch {}
            }
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
            if (DEV_DEBUG_PILLS) {
              try {
                console.debug?.("[pill] build:update:builder-add-error", {
                  e,
                  span: s,
                });
              } catch {}
            }
          }
        }
        const set = builder.finish();
        if (DEV_DEBUG_PILLS) {
          try {
            console.debug?.("[pill] build:update:finish", {
              empty: set?.size === 0,
            });
          } catch {}
        }
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
  // CSS injection per design doc ("Styling Spec" / "CSS Injection")
  ensureReminderPillStylesInjected();

  // TODO: Span derivation details
  // See design section "Core Algorithms → Parse and Span Derivation" and
  // "CodeMirror v6 Extension Design".
  // TODO: Span disambiguation, line offsets, matching by formatted time, caching by line number.

  // TODO: PillWidget
  // See design section "Inline Pill Widget Rendering".

  // TODO: openChooserAndApply
  // See design section "Activation and Interaction".

  // TODO: Reading view Phase 2 post-processor
  // See design section "Phase 2: Reading View Rendering".

  // TODO(selectionSet-debounce): Future optimization to debounce selection changes.

  // For this subtask: field builds decorations only when the feature flag is enabled.
  const reminderPillField = createReminderPillField(app);
  return [reminderPillField];
}
