import type { Reminder } from "model/reminder";
import type { DateTime, Later } from "model/time";
import ReminderView from "ui/Reminder.svelte";

/**
 * Manages non-modal "toast" reminder popups stacked in the bottom-right
 * corner of the window. Unlike `NotificationModal` (see reminder.ts), toasts
 * never take focus and multiple toasts can be shown at once, so they don't
 * participate in `reminder.beingDisplayed` serialization: the notification
 * worker fires them all without waiting.
 */
export class ReminderToastManager {
  // Created lazily on the first `show()` call rather than in the
  // constructor, mirroring `DndStatusBar`/`ReminderModal` -- this class is
  // constructed before the plugin (and `document.body`) is guaranteed ready.
  private containerEl?: HTMLElement;
  private toasts: Map<string, { el: HTMLElement; component: ReminderView }> =
    new Map();

  show(
    reminder: Reminder,
    laters: Array<Later>,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onCancel: () => void,
    onOpenFile: () => void,
    onPauseAllNotifications: () => void,
    onMuteAll: () => void,
  ) {
    const key = reminder.key();
    // Replace rather than stack a second toast for the same reminder (e.g.
    // it expires again before the first toast was dismissed).
    this.remove(key);

    const cardEl = this.getContainer().createDiv("reminder-toast-card");
    const component = new ReminderView({
      target: cardEl,
      props: {
        reminder,
        laters,
        variant: "toast",
        // Set to the right value up front (rather than relying only on the
        // post-insert `updateShortcutTarget()` call below) to avoid a brief
        // flicker where two toasts both have shortcuts enabled.
        shortcutsEnabled: true,
        onRemindMeLater: (time: DateTime) => {
          onRemindMeLater(time);
          this.remove(key);
        },
        onDone: () => {
          onDone();
          this.remove(key);
        },
        onOpenFile: () => {
          // Matches NotificationModal: opening the file also mutes the
          // reminder (closing the modal with `canceled = true` triggers
          // `onCancel` there).
          onOpenFile();
          onCancel();
          this.remove(key);
        },
        onMute: () => {
          onCancel();
          this.remove(key);
        },
        onClose: () => {
          onCancel();
          this.remove(key);
        },
        onPauseAllNotifications: () => {
          onPauseAllNotifications();
          this.remove(key);
        },
        onMuteAll: () => {
          onMuteAll();
          this.remove(key);
        },
      },
    });

    this.toasts.set(key, { el: cardEl, component });
    this.updateShortcutTarget();
  }

  /** Unmounts and removes every toast and the container (for plugin unload). */
  destroy() {
    this.toasts.forEach(({ component }) => component.$destroy());
    this.toasts.clear();
    this.containerEl?.remove();
    this.containerEl = undefined;
  }

  private remove(key: string) {
    const entry = this.toasts.get(key);
    if (!entry) {
      return;
    }
    entry.component.$destroy();
    entry.el.remove();
    this.toasts.delete(key);
    this.updateShortcutTarget();
  }

  /**
   * Keeps keyboard mnemonics active on exactly one toast: the most recently
   * shown one. Each toast mounts its own `svelte:window` keydown handler
   * (see `Reminder.svelte`), so if more than one had shortcuts enabled, a
   * single keypress would trigger all of them at once. `this.toasts`
   * preserves insertion order, so the last entry is the newest toast.
   */
  private updateShortcutTarget() {
    const keys = Array.from(this.toasts.keys());
    const lastKey = keys[keys.length - 1];
    this.toasts.forEach(({ component }, key) => {
      component.$set({ shortcutsEnabled: key === lastKey });
    });
  }

  private getContainer(): HTMLElement {
    if (!this.containerEl) {
      const el = document.body.createDiv("reminder-toast-container");
      el.style.cssText =
        "position: fixed; right: 16px; bottom: 40px; z-index: var(--layer-notice); " +
        "display: flex; flex-direction: column; gap: 8px; max-height: 70vh; " +
        "overflow-y: auto; width: 360px; max-width: calc(100vw - 32px);";
      this.containerEl = el;
    }
    return this.containerEl;
  }
}
