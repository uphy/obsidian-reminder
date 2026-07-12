import type { Extension } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";

/** Public effect: dispatch this to highlight `[from, to)` until the user moves the cursor/selection or edits the document. */
export const highlightReminderLine = StateEffect.define<{
  from: number;
  to: number;
}>();

/** Builds the single mark decoration for the range, or `Decoration.none` if the range is empty (e.g. highlighting a blank line). */
function buildHighlightDecoration(range: {
  from: number;
  to: number;
}): DecorationSet {
  if (range.from >= range.to) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.mark({
      attributes: { style: "background-color: var(--text-highlight-bg);" },
    }).range(range.from, range.to),
  ]);
}

/**
 * Mirrors Obsidian's own search-jump highlight: it stays put until the user
 * moves the cursor/selection (e.g. clicking elsewhere) or edits the
 * document, rather than fading out on a timer.
 */
const reminderLineHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },

  update(decos, tr) {
    const highlight = tr.effects.find((e) => e.is(highlightReminderLine));
    if (highlight !== undefined) {
      return buildHighlightDecoration(highlight.value);
    }
    if (tr.docChanged || !tr.startState.selection.eq(tr.state.selection)) {
      return Decoration.none;
    }
    return decos.map(tr.changes);
  },

  provide: (field) => EditorView.decorations.from(field),
});

/** CM6 extension: highlights a range dispatched via `highlightReminderLine` until the user's next cursor move or edit. */
export function createReminderLineHighlightExtension(): Extension {
  return reminderLineHighlightField;
}
