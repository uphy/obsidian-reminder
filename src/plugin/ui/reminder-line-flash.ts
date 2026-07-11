import type { Extension } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

/**
 * How long the CSS `background-color` transition (and thus the visual fade
 * from the highlight color to transparent) takes, in milliseconds. Reused
 * for both the inline `transition` style and the JS timer below so the two
 * stay in lockstep.
 */
const FADE_DURATION_MS = 1300;

/**
 * Extra time after the CSS transition ends before the decoration is cleared
 * entirely, so the fade always finishes rendering before the highlighted
 * range disappears (clearing exactly at `FADE_DURATION_MS` risks a visible
 * last-frame cutoff if a paint lands slightly late).
 */
const CLEAR_BUFFER_MS = 200;

/** Public effect: dispatch this to flash-highlight `[from, to)`, then fade it out and remove it automatically. */
export const flashReminderLine = StateEffect.define<{
  from: number;
  to: number;
}>();

/** Internal: swaps the decoration's inline style from the highlight color to transparent, letting the CSS transition animate the fade. */
const startReminderLineFade = StateEffect.define<void>();

/** Internal: removes the flash decoration once the fade has finished. */
const clearReminderLineFlash = StateEffect.define<void>();

interface FlashState {
  decos: DecorationSet;
  /** The range the active decoration covers, or `undefined` when nothing is flashing. Tracked separately from `decos` so `startReminderLineFade`/`clearReminderLineFlash` can rebuild the decoration without needing to carry position data of their own. */
  range?: { from: number; to: number };
}

const emptyState: FlashState = { decos: Decoration.none, range: undefined };

/** Builds the single mark decoration for the active range, or `Decoration.none` if the range is empty (e.g. flashing a blank line). */
function buildFlashDecoration(
  range: { from: number; to: number },
  transparent: boolean,
): DecorationSet {
  if (range.from >= range.to) {
    return Decoration.none;
  }
  const color = transparent ? "transparent" : "var(--text-highlight-bg)";
  return Decoration.set([
    Decoration.mark({
      attributes: {
        style: `background-color: ${color}; transition: background-color ${FADE_DURATION_MS}ms ease-out;`,
      },
    }).range(range.from, range.to),
  ]);
}

const reminderLineFlashField = StateField.define<FlashState>({
  create() {
    return emptyState;
  },

  update(value, tr) {
    let decos = value.decos.map(tr.changes);
    let range = value.range;
    if (range !== undefined) {
      range = {
        from: tr.changes.mapPos(range.from),
        to: tr.changes.mapPos(range.to, 1),
      };
    }

    for (const effect of tr.effects) {
      if (effect.is(flashReminderLine)) {
        range = effect.value;
        decos = buildFlashDecoration(range, false);
      } else if (effect.is(startReminderLineFade)) {
        if (range !== undefined) {
          decos = buildFlashDecoration(range, true);
        }
      } else if (effect.is(clearReminderLineFlash)) {
        decos = Decoration.none;
        range = undefined;
      }
    }

    return { decos, range };
  },

  provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

/**
 * Drives the fade-and-clear sequence after `flashReminderLine` lands: waits
 * a frame (so the initial highlight color actually paints before the
 * transition starts), then swaps to transparent, then clears the decoration
 * once the transition has had time to finish. Owns its own rAF/timer
 * handles and cancels them whenever a new flash arrives, so rapidly
 * reopening reminders can't stack timers that fight over the same
 * decoration.
 */
const reminderLineFlashViewPlugin = ViewPlugin.fromClass(
  class {
    private rafHandle?: number;
    private clearTimer?: number;

    constructor(private readonly view: EditorView) {}

    update(update: ViewUpdate) {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(flashReminderLine)) {
            this.cancelPending();
            this.rafHandle = window.requestAnimationFrame(() => {
              this.rafHandle = undefined;
              this.view.dispatch({ effects: startReminderLineFade.of() });
              this.clearTimer = window.setTimeout(() => {
                this.clearTimer = undefined;
                this.view.dispatch({ effects: clearReminderLineFlash.of() });
              }, FADE_DURATION_MS + CLEAR_BUFFER_MS);
            });
          }
        }
      }
    }

    private cancelPending() {
      if (this.rafHandle !== undefined) {
        window.cancelAnimationFrame(this.rafHandle);
        this.rafHandle = undefined;
      }
      if (this.clearTimer !== undefined) {
        window.clearTimeout(this.clearTimer);
        this.clearTimer = undefined;
      }
    }

    destroy() {
      this.cancelPending();
    }
  },
);

/** CM6 extension: flash-highlights a range dispatched via `flashReminderLine`, then fades and removes it automatically. */
export function createReminderLineFlashExtension(): Extension {
  return [reminderLineFlashField, reminderLineFlashViewPlugin];
}
