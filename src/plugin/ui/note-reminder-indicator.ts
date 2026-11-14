import { t } from "i18n";
import type ReminderPlugin from "main";
import type { Reminder } from "model/reminder";
import { MarkdownView, TFile } from "obsidian";
import { openNoteReminderModal } from "./note-reminder-modal";

/**
 * Shows a bell in the header of every open note that has a pending reminder
 * on a managed property. Clicking it opens the reminder dialog. This is the
 * in-note sign of a note reminder, as the pill is for a task line:
 * frontmatter is drawn by Obsidian's own properties editor, which plugins
 * have no supported way to decorate.
 */
export class NoteReminderIndicator {
  private actions: Map<MarkdownView, HTMLElement> = new Map();
  private timer: number | undefined;
  private unloaded = false;

  constructor(private plugin: ReminderPlugin) {}

  onload() {
    const workspace = this.plugin.app.workspace;
    this.plugin.registerEvent(
      workspace.on("layout-change", () => this.refresh()),
    );
    this.plugin.registerEvent(workspace.on("file-open", () => this.refresh()));
    this.plugin.register(() => this.destroy());
  }

  /**
   * Re-evaluates every open note, once for all the calls made in the same
   * task: a full rescan reports a change per file. A timer is used rather
   * than an animation frame, because the bells also live in popout windows
   * and a minimized main window runs no animation frames.
   */
  refresh() {
    if (this.timer !== undefined || this.unloaded) {
      return;
    }
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      if (!this.unloaded) {
        this.update();
      }
    }, 0);
  }

  private update() {
    const open = new Set<MarkdownView>();
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      // A deferred (not yet loaded) tab has a placeholder view.
      if (!(view instanceof MarkdownView)) {
        continue;
      }
      open.add(view);
      this.updateView(view);
    }
    for (const [view, el] of this.actions) {
      if (!open.has(view)) {
        el.remove();
        this.actions.delete(view);
      }
    }
  }

  private updateView(view: MarkdownView) {
    const file = view.file;
    const pending = file == null ? [] : this.pendingReminders(file.path);
    const existing = this.actions.get(view);
    if (file == null || pending.length === 0) {
      existing?.remove();
      this.actions.delete(view);
      return;
    }
    const label = pending.map(tooltipOf).join("\n");
    if (existing != null && existing.dataset["reminderFile"] === file.path) {
      existing.setAttribute("aria-label", label);
      return;
    }
    existing?.remove();
    const el = view.addAction("bell-ring", label, () => {
      const current = view.file;
      if (current instanceof TFile) {
        openNoteReminderModal(this.plugin, current);
      }
    });
    el.addClass("reminder-note-indicator");
    el.dataset["reminderFile"] = file.path;
    this.actions.set(view, el);
  }

  private pendingReminders(path: string): Array<Reminder> {
    const managed = this.plugin
      .managedNoteReminderSources()
      .map((source) => source.property);
    return (this.plugin.reminders.fileToReminders.get(path) ?? []).filter(
      (r) =>
        r.origin.kind === "note" &&
        r.origin.store === "property" &&
        managed.includes(r.origin.key),
    );
  }

  private destroy() {
    this.unloaded = true;
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    for (const el of this.actions.values()) {
      el.remove();
    }
    this.actions.clear();
  }
}

function tooltipOf(reminder: Reminder): string {
  return t("Reminder: {time} ({property})", {
    time: reminder.time.toString(),
    property: reminder.origin.kind === "note" ? reminder.origin.label : "",
  });
}
