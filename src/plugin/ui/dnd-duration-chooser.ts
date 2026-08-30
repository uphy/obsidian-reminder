import type { Later } from "model/time";
import { App, SuggestModal } from "obsidian";

/**
 * Lets the user pick how long to pause reminder notifications for, from the
 * same "Remind me later" choices (`Settings.laters`) used by the reminder
 * popup's snooze dropdown.
 */
export class DndDurationModal extends SuggestModal<Later> {
  constructor(
    app: App,
    private laters: Array<Later>,
    private onSelect: (later: Later) => void,
    // Called once the modal closes, whether the user picked a duration or
    // dismissed it (e.g. Escape / clicking outside). Callers that need to
    // know "the chooser is gone now" (as opposed to "a duration was picked")
    // should use this rather than piggybacking on `onSelect`.
    private onCloseCallback?: () => void,
  ) {
    super(app);
    this.setPlaceholder("Pause reminder notifications for...");
  }

  getSuggestions(query: string): Array<Later> {
    return this.laters.filter((later) =>
      later.label.toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(later: Later, el: HTMLElement) {
    el.createDiv({ text: later.label });
  }

  onChooseSuggestion(later: Later) {
    this.onSelect(later);
  }

  override onClose() {
    this.onCloseCallback?.();
  }
}
