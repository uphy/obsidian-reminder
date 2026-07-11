import type ReminderPlugin from "main";
import { parseReminder } from "model/format";
import { MarkdownDocument } from "model/format/markdown";
import type { ChangeSet, EditorState, Extension } from "@codemirror/state";
import { Annotation, RangeSetBuilder, StateField } from "@codemirror/state";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import { deriveReminderPillSpans } from "./spans";
import { forceReminderPillRecompute } from "./state-effects";
import { ReminderPillWidget } from "./pill-widget";
import type { ReminderPillSpan } from "./types";

/** Debounce window for re-parsing after edits that don't touch a known reminder span. */
const DEBOUNCE_MS = 300;

/** Carries spans computed by the debounced re-parse across the transaction that applies them. */
const RecomputedSpans = Annotation.define<ReminderPillSpan[]>();

type FieldState = {
  decos: DecorationSet;
  cache: ReminderPillSpan[];
};

/**
 * Parses the document for reminders and derives their pill spans.
 *
 * Wrapped in a single try/catch: a malformed document (or a bug in the
 * parser) must never break editing, it should just fall back to showing no
 * pills.
 */
function computeReminderPillSpans(
  plugin: ReminderPlugin,
  state: EditorState,
): ReminderPillSpan[] {
  try {
    if (!plugin.settings.editorReminderDisplay.value) {
      return [];
    }
    if (!(state.field(editorLivePreviewField, false) ?? false)) {
      return [];
    }
    const filePath = state.field(editorInfoField, false)?.file?.path ?? "";
    const md = new MarkdownDocument(filePath, state.doc.toString());
    return deriveReminderPillSpans(state.doc, parseReminder(md));
  } catch (e) {
    console.error("Failed to parse reminders for editor pills.", e);
    return [];
  }
}

function buildDecorations(
  state: EditorState,
  spans: ReminderPillSpan[],
  plugin: ReminderPlugin,
): DecorationSet {
  const head = state.selection.main.head;
  const builder = new RangeSetBuilder<Decoration>();
  for (const span of spans) {
    // Hide the pill while the cursor sits inside it, so the raw reminder
    // text is editable.
    if (head >= span.from && head <= span.to) {
      continue;
    }
    builder.add(
      span.from,
      span.to,
      Decoration.replace({ widget: new ReminderPillWidget(span, plugin) }),
    );
  }
  return builder.finish();
}

function mapCache(
  cache: ReminderPillSpan[],
  changes: ChangeSet,
): ReminderPillSpan[] {
  const mapped: ReminderPillSpan[] = [];
  for (const span of cache) {
    const from = changes.mapPos(span.from);
    const to = changes.mapPos(span.to, 1);
    if (from < to) {
      mapped.push({ ...span, from, to });
    }
  }
  return mapped;
}

function createReminderPillField(plugin: ReminderPlugin) {
  return StateField.define<FieldState>({
    create(state) {
      const cache = computeReminderPillSpans(plugin, state);
      return { decos: buildDecorations(state, cache, plugin), cache };
    },

    update(value, tr) {
      let decos = value.decos.map(tr.changes);
      let cache = tr.docChanged
        ? mapCache(value.cache, tr.changes)
        : value.cache;

      const recomputedSpans = tr.annotation(RecomputedSpans);
      if (recomputedSpans !== undefined) {
        cache = recomputedSpans;
      }

      const touchesCache =
        tr.docChanged &&
        cache.some((span) => tr.changes.touchesRange(span.from, span.to));
      const hasForceEffect = tr.effects.some((e) =>
        e.is(forceReminderPillRecompute),
      );
      // `tr.reconfigured` is set for the transaction Obsidian's
      // `Workspace.updateOptions()` dispatches to every open editor, which
      // is how the "Show reminder pills in editor" setting toggle reaches
      // already-open editors: no view registry needed, just react to CM6's
      // own configuration-change signal.
      const needsReparse =
        touchesCache ||
        tr.reconfigured ||
        (hasForceEffect && recomputedSpans === undefined);

      if (needsReparse) {
        cache = computeReminderPillSpans(plugin, tr.state);
        decos = buildDecorations(tr.state, cache, plugin);
        return { decos, cache };
      }

      const selectionChanged = !tr.startState.selection.eq(tr.state.selection);
      if (recomputedSpans !== undefined || selectionChanged) {
        // Either the debounced re-parse just delivered fresh spans, or the
        // selection moved (which can reveal/hide the pill under the
        // cursor) — rebuild decorations from the current cache without a
        // full reparse.
        decos = buildDecorations(tr.state, cache, plugin);
      }

      return { decos, cache };
    },

    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
  });
}

/**
 * Watches for document changes and, after a quiet period, re-parses the
 * whole document so reminders added/removed outside any currently known
 * span are picked up without reparsing on every keystroke. Owns its
 * debounce timer per editor view and clears it on `destroy()` — there is no
 * module-level timer or view registry.
 */
function createReminderPillViewPlugin(plugin: ReminderPlugin) {
  return ViewPlugin.fromClass(
    class {
      private debounceTimer?: number;

      constructor(private readonly view: EditorView) {}

      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }
        if (this.debounceTimer !== undefined) {
          window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
          this.debounceTimer = undefined;
          const spans = computeReminderPillSpans(plugin, this.view.state);
          this.view.dispatch({
            annotations: RecomputedSpans.of(spans),
            effects: [forceReminderPillRecompute.of()],
          });
        }, DEBOUNCE_MS);
      }

      destroy() {
        if (this.debounceTimer !== undefined) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = undefined;
        }
      }
    },
  );
}

export function createReminderPillExtension(plugin: ReminderPlugin): Extension {
  return [
    createReminderPillField(plugin),
    createReminderPillViewPlugin(plugin),
  ];
}
