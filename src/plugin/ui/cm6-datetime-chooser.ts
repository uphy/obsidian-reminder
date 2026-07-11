import type { EditorView } from "@codemirror/view";
import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import moment from "moment";
import DateTimeChooser from "ui/DateTimeChooser.svelte";

/**
 * Inline date/time chooser popup for the CodeMirror 6 (Live Preview) editor.
 *
 * This mirrors the CM5-era `DateTimeChooserView` (./datetime-chooser.ts):
 * a `position: fixed` div holding `ui/DateTimeChooser.svelte`, positioned
 * near the cursor. The main differences are:
 * - Positioning uses CM6's `EditorView.coordsAtPos()` instead of CM5's
 *   `charCoords()`. `coordsAtPos()` already returns viewport-relative
 *   coordinates, so no offset against `document.body`'s bounding rect is
 *   needed.
 * - Keyboard interaction (arrow keys / Enter inside the calendar and time
 *   picker) is handled by giving the popup real DOM focus, which is picked
 *   up by the existing `on:keydown` handlers in Calendar.svelte and
 *   TimePicker.svelte. Escape and clicking outside the popup close it here.
 * - Focus is returned to the editor when the popup closes, so typing can
 *   continue seamlessly whether the user picked a date/time or cancelled.
 */
/** Minimum gap between the popup and the viewport edges. */
const VIEWPORT_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class CM6DateTimeChooserPopup {
  private view: HTMLElement;
  private dateTimeChooser?: DateTimeChooser;
  private resultResolve?: (result: DateTime) => void;
  private resultReject?: () => void;
  // The document position the popup is anchored to (right after the trigger).
  private anchorPos = 0;

  private onDocumentMouseDown = (event: MouseEvent): void => {
    if (!this.view.contains(event.target as Node)) {
      this.cancel();
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }
  };

  // Follow editor scrolling (and window resizes) so the fixed-position popup
  // stays anchored to the trigger's text position. Reading the layout via
  // coordsAtPos() is fine here: the restriction only applies inside the CM6
  // update cycle.
  private onReposition = (): void => {
    this.position(this.anchorPos);
  };

  constructor(
    private editorView: EditorView,
    private reminders: Reminders,
    private timeStep: number,
  ) {
    this.view = document.createElement("div");
    this.view.addClass("date-time-chooser-popup");
    this.view.style.position = "fixed";
  }

  /** Show the popup near the given document position and wait for a result. */
  show(pos: number): Promise<DateTime> {
    this.anchorPos = pos;

    // Attach the container to the DOM before mounting the Svelte component:
    // Calendar.svelte's onMount reads `table.clientWidth` to size the footer
    // slot, which is 0 while the container is detached (that would collapse
    // the reminder list in the footer to zero width). Positioning in turn
    // needs the popup's own size, known only after mounting — so keep it
    // invisible until it has been measured and placed, to avoid a visible
    // jump.
    this.view.style.visibility = "hidden";
    document.body.appendChild(this.view);
    this.dateTimeChooser = new DateTimeChooser({
      target: this.view,
      props: {
        onSelect: (time: DateTime) => {
          this.setResult(time);
          this.hide();
        },
        reminders: this.reminders,
        timeStep: this.timeStep,
        date: moment(),
      },
    });
    this.position(pos);
    this.view.style.visibility = "visible";

    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    this.view.addEventListener("keydown", this.onKeyDown);
    this.editorView.scrollDOM.addEventListener("scroll", this.onReposition, {
      passive: true,
    });
    window.addEventListener("resize", this.onReposition, { passive: true });

    // Move real DOM focus into the popup so arrow keys / Enter reach the
    // calendar's own keydown handling (Calendar.svelte).
    this.view.querySelector<HTMLElement>(".reminder-calendar")?.focus();

    return new Promise<DateTime>((resolve, reject) => {
      this.resultResolve = resolve;
      this.resultReject = reject;
    });
  }

  /**
   * Place the popup at the given document position, kept fully inside the
   * viewport: preferably below the cursor, flipped above it when it would
   * overflow the bottom edge, and clamped to the viewport otherwise.
   */
  private position(pos: number): void {
    const coords = this.editorView.coordsAtPos(pos);
    const editorRect = this.editorView.dom.getBoundingClientRect();
    const anchorTop = coords?.top ?? editorRect.top;
    const anchorBottom = coords?.bottom ?? editorRect.top;
    const anchorLeft = coords?.left ?? editorRect.left;

    const { width, height } = this.view.getBoundingClientRect();

    // Preferred: below the cursor. Flip above when it would overflow the
    // bottom of the viewport, then clamp into the viewport as a last resort.
    let top = anchorBottom;
    if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchorTop - height;
    }
    top = clamp(
      top,
      VIEWPORT_MARGIN,
      Math.max(window.innerHeight - height - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
    );
    const left = clamp(
      anchorLeft,
      VIEWPORT_MARGIN,
      Math.max(window.innerWidth - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
    );

    this.view.style.top = `${top}px`;
    this.view.style.left = `${left}px`;
  }

  /** Close the popup without producing a result (used for Escape/click-outside/destroy). */
  cancel(): void {
    this.setResult(null);
    this.hide();
  }

  private setResult(result: DateTime | null): void {
    if (this.resultReject == null || this.resultResolve == null) {
      return;
    }
    if (result === null) {
      this.resultReject();
    } else {
      this.resultResolve(result);
    }
    this.resultReject = undefined;
    this.resultResolve = undefined;
  }

  private hide(): void {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
    this.view.removeEventListener("keydown", this.onKeyDown);
    this.editorView.scrollDOM.removeEventListener("scroll", this.onReposition);
    window.removeEventListener("resize", this.onReposition);
    // The popup is single-use: destroy the Svelte component along with
    // detaching the container.
    this.dateTimeChooser?.$destroy();
    this.dateTimeChooser = undefined;
    if (this.view.parentNode) {
      this.view.parentNode.removeChild(this.view);
    }
    // Return focus to the editor so typing continues seamlessly.
    this.editorView.focus();
  }
}
