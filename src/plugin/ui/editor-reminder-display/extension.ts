/**
 * CodeMirror 6 extension to render reminder pills.
 * Parses reminder tokens and decorates them with pill widgets.
 */
import type { App } from "obsidian";
import type { Extension, StateEffect, Transaction } from "@codemirror/state";
import { Annotation, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

import { type ReminderSpan, parseReminder } from "../../../model/format";
import { ensureReminderPillStylesInjected } from "./styles";
import type { PillContext, TokenSpan } from "./types";
import { PillWidget, pillReplace, specFrom } from "./pill-widget";
import { buildMarkdownDocument, deriveSpans } from "./spans";
import { forceReminderPillRecompute } from "./state-effects";

// Typed global accessor for the active EditorView reference.
// Use a module-local unique symbol key to avoid polluting globalThis with any/unknown.
const REMINDER_VIEW_REF = Symbol("obsReminderViewRef");
type ReminderGlobal = { [REMINDER_VIEW_REF]?: EditorView };

/**
 * Install the reminder pill extension.
 * - Inject required styles
 * - Register view reference handler and StateField
 */
export function createReminderPillExtension(app: App): Extension[] {
  ensureReminderPillStylesInjected();

  // Keep a reference to the current EditorView for debounced recomputes.
  const viewRefPlugin = EditorView.domEventHandlers({
    focus: (_event, view) => {
      (globalThis as ReminderGlobal)[REMINDER_VIEW_REF] = view;
    },
    blur: () => {
      // Keep the last view to allow scheduling while typing resumes.
    },
  });

  const reminderPillField = createReminderPillField(app);
  return [viewRefPlugin, reminderPillField];
}

/**
 * StateField to compute, cache, and render reminder pills.
 * Debounces parsing for edits that don't touch cached spans.
 */
const DEBOUNCE_MS = 200;

// Typed Annotation to carry recomputed spans across a transaction
type TokenSpanShape = { from: number; to: number };
const RecomputedSpans = Annotation.define<TokenSpanShape[]>();

type CachedData = { spans: TokenSpanShape[] };

type FieldState = {
  decos: DecorationSet;
  cache: CachedData;
};

const createReminderPillField = (app: App) =>
  StateField.define<FieldState>({
    create: (state) => {
      // Initial parse/build for decorations and cache.
      const spans = computeSpansFromState(app, state);
      const richSpans = computeRichSpansFromState(app, state);
      return {
        decos: buildDecorationsFromSpans(app, state, richSpans),
        cache: { spans },
      };
    },

    update: (value, tr) => {
      try {
        // Map existing decorations across document changes.
        let mappedDecos = value.decos;
        try {
          if (tr.changes) {
            mappedDecos = value.decos.map(tr.changes);
          }
        } catch {
          mappedDecos = value.decos;
        }

        const hasForceEffect = tr.effects.some((e: StateEffect<unknown>) =>
          e.is(forceReminderPillRecompute),
        );
        const selectionChanged = !tr.startState.selection.eq(
          tr.state.selection,
        );

        // Use recomputed spans from a prior debounced job when present.
        const recomputedSpans = readRecomputedSpansFrom(tr);

        const nextCache: CachedData = recomputedSpans
          ? { spans: recomputedSpans }
          : value.cache;

        const rebuildFromCache = () => {
          // Use current document state to rederive rich spans for decorations,
          // while keeping the lightweight cached spans unchanged.
          const richSpans = computeRichSpansFromState(app, tr.state);
          return {
            decos: buildDecorationsFromSpans(app, tr.state, richSpans),
            cache: nextCache,
          };
        };

        if (!tr.docChanged) {
          if (hasForceEffect && recomputedSpans) {
            // Debounced parse completed; rebuild from cache.
            return rebuildFromCache();
          }
          if (selectionChanged) {
            // Selection-only change; rebuild to toggle edit-mode visibility.
            return rebuildFromCache();
          }
          // No relevant change; keep mapped decorations.
          return { decos: mappedDecos, cache: nextCache };
        }

        // If the edit touches cached spans, recompute immediately.
        const intersectsCached = intersectsAnyCachedSpan(tr, nextCache?.spans);

        if (intersectsCached || hasForceEffect) {
          try {
            const spans = computeSpansFromState(app, tr.state);
            const richSpans = computeRichSpansFromState(app, tr.state);
            return {
              decos: buildDecorationsFromSpans(app, tr.state, richSpans),
              cache: { spans },
            };
          } catch {
            // On parse error, keep mapped decorations and cache.
            return { decos: mappedDecos, cache: nextCache };
          }
        }

        // Otherwise, schedule a debounced recompute and return mapped decorations.
        try {
          const view = getActiveView();
          if (view) scheduleDebouncedRecompute(app, view);
        } catch {
          // Ignore scheduling errors.
        }

        return { decos: mappedDecos, cache: nextCache };
      } catch {
        return value;
      }
    },

    provide: (f) => EditorView.decorations.from(f, (v) => v.decos),
  });

/**
 * Parse reminders from the given content and convert them to editor spans.
 * Builds a markdown document, extracts ReminderSpan items, and derives
 * CodeMirror positions for each reminder occurrence.
 */
function computeSpans(
  app: App,
  state: EditorView["state"],
  content: string,
): TokenSpanShape[] {
  const md = buildMarkdownDocument(app, content);
  const reminders: ReminderSpan[] = parseReminder(md);
  return deriveSpans(md, reminders, state);
}

/**
 * Read the document content from the editor state and compute spans.
 * Convenience wrapper around computeSpans for the current state.
 */
function computeSpansFromState(
  app: App,
  state: EditorView["state"],
): TokenSpanShape[] {
  const content = state.doc?.toString?.() ?? "";
  return computeSpans(app, state, content);
}

/**
 * Compute rich spans (TokenSpan[]) for decoration building only.
 * Cache remains lightweight as TokenSpanShape[] elsewhere.
 */
function computeRichSpansFromState(
  app: App,
  state: EditorView["state"],
): TokenSpan[] {
  const content = state.doc?.toString?.() ?? "";
  const md = buildMarkdownDocument(app, content);
  const reminders: ReminderSpan[] = parseReminder(md);
  return deriveSpans(md, reminders, state);
}

/**
 * Build pill decorations from computed spans.
 * Skips invalid or overlapping ranges and avoids decorating the active selection head.
 */
function buildDecorationsFromSpans(
  app: App,
  state: EditorView["state"],
  spans: TokenSpan[],
): DecorationSet {
  try {
    const ctx: PillContext = { app };
    const builder = new RangeSetBuilder<Decoration>();
    const head = getSelectionHead(state);

    // Skip invalid/overlapping ranges and the selection head.
    let lastTo = -1;
    for (const raw of spans) {
      if (!isValidSpan(raw)) continue;
      if (head >= raw.from && head <= raw.to) continue;

      const safe = toSafeRange(raw, lastTo);
      if (!safe) continue;
      lastTo = safe.to;

      builder.add(
        safe.from,
        safe.to,
        pillReplace(safe.from, safe.to, new PillWidget(specFrom(raw), ctx)),
      );
    }
    return builder.finish();
  } catch {
    // On failure, return an empty decoration set.
    return Decoration.none;
  }
}

/**
 * Debounced recompute for edits that don't require immediate parsing.
 * Attaches recomputed spans as an annotation and triggers a force-recompute effect.
 */
let debounceTimer: number | undefined;

function scheduleDebouncedRecompute(app: App, view: EditorView) {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  debounceTimer = window.setTimeout(() => {
    try {
      const spans = computeSpansFromState(app, view.state);
      view.dispatch({
        annotations: RecomputedSpans.of(spans),
        effects: [forceReminderPillRecompute.of(void 0)],
      });
    } catch {
      // Ignore parse errors in the debounced job.
    }
  }, DEBOUNCE_MS);
}

/**
 * Utilities.
 */
function getSelectionHead(state: EditorView["state"]): number {
  const head = state.selection?.main?.head;
  return typeof head === "number" ? head : -1;
}

type HasFromTo = Partial<Record<"from" | "to", number>>;

function isValidSpan(s: HasFromTo) {
  if (!s || typeof s !== "object") return false;
  const { from, to } = s as { from?: unknown; to?: unknown };
  return typeof from === "number" && typeof to === "number" && from <= to;
}

function toSafeRange(
  s: TokenSpanShape,
  lastTo: number,
): { from: number; to: number } | null {
  const from = Math.max(0, s.from);
  const to = Math.max(from, s.to);
  if (to < lastTo) return null;
  return { from, to };
}

function readRecomputedSpansFrom(
  tr: Transaction,
): TokenSpanShape[] | undefined {
  return tr.annotation(RecomputedSpans);
}

function intersectsAnyCachedSpan(
  tr: Transaction,
  spans: TokenSpanShape[] | undefined,
): boolean {
  try {
    if (!tr.changes || !Array.isArray(spans)) return false;
    for (const s of spans) {
      if (!isValidSpan(s)) continue;
      if (tr.changes.touchesRange(s.from, s.to)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function getActiveView(): EditorView | undefined {
  try {
    const ref = (globalThis as ReminderGlobal)[REMINDER_VIEW_REF];
    if (ref instanceof EditorView) return ref;
    const active = document.activeElement as Element | null;
    const maybeView =
      active && active instanceof HTMLElement
        ? EditorView.findFromDOM(active)
        : undefined;
    if (maybeView) {
      (globalThis as ReminderGlobal)[REMINDER_VIEW_REF] = maybeView;
      return maybeView;
    }
  } catch {
    // Ignore lookup errors.
  }
  return undefined;
}
