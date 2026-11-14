import "./note-reminder-indicator.css";
import { t } from "i18n";
import type ReminderPlugin from "main";
import { propertyOf } from "model/note/property-format";
import type { Reminder } from "model/reminder";
import { MarkdownView, TFile } from "obsidian";
import {
  canSetNoteReminder,
  hasNoteReminder,
  openNoteReminderModal,
} from "./note-reminder-modal";

/**
 * What the bell says about a note: a reminder is waiting, the note holds a
 * reminder that is not waiting (done, or dated before the cut-off), or it
 * holds none yet.
 */
type BellState = "pending" | "set" | "none";

const BELL_ICONS: Record<BellState, string> = {
  pending: "bell-ring",
  set: "bell",
  none: "bell-plus",
};

/**
 * Shows a bell in the header of open notes. Clicking it opens the reminder
 * dialog. This is the in-note sign of a note reminder, as the pill is for a
 * task line: frontmatter is drawn by Obsidian's own properties editor, which
 * plugins have no supported way to decorate.
 *
 * A note with a pending reminder on a managed property always gets the bell.
 * With the "Show a bell in every note's header" setting on, the other notes
 * get a faint one, so that the way to add a note reminder is on screen and
 * not only in the command palette and the file menu. That holds before any
 * property is managed too: the dialog then starts with its offer to set one
 * up, and a user who has not found the feature yet is the one who needs the
 * bell most.
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
    // The faint bell tells "has a reminder" from "has none" by the note's
    // properties, which change without any pending reminder changing.
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on("changed", () => this.refresh()),
    );
    this.plugin.settings.noteReminderHeaderBell.rawValue.onChanged(() =>
      this.refresh(),
    );
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
    const state = file == null ? null : this.stateOf(file, pending);
    const existing = this.actions.get(view);
    if (file == null || state == null) {
      existing?.remove();
      this.actions.delete(view);
      return;
    }
    const label =
      state === "pending"
        ? pending.map(tooltipOf).join("\n")
        : state === "set"
          ? t("Edit this note's reminder")
          : t("Set reminder for this note");
    // The icon is fixed when the action is created, so a change of state
    // (or of note) replaces the element.
    const id = state + ":" + file.path;
    if (existing != null && existing.dataset["reminderBell"] === id) {
      existing.setAttribute("aria-label", label);
      return;
    }
    existing?.remove();
    const el = view.addAction(BELL_ICONS[state], label, () => {
      const current = view.file;
      if (current instanceof TFile) {
        openNoteReminderModal(this.plugin, current);
      }
    });
    el.addClass("reminder-note-indicator");
    el.toggleClass("is-idle", state !== "pending");
    el.dataset["reminderBell"] = id;
    this.actions.set(view, el);
  }

  /** Null when the note gets no bell. */
  private stateOf(file: TFile, pending: Array<Reminder>): BellState | null {
    if (pending.length > 0) {
      return "pending";
    }
    if (
      !this.plugin.settings.noteReminderHeaderBell.value ||
      !canSetNoteReminder(this.plugin, file)
    ) {
      return null;
    }
    return hasNoteReminder(this.plugin, file) ? "set" : "none";
  }

  private pendingReminders(path: string): Array<Reminder> {
    const managed = this.plugin
      .managedNoteReminderSources()
      .map((source) => source.property);
    return (this.plugin.reminders.fileToReminders.get(path) ?? []).filter(
      (r) => {
        const property = propertyOf(r);
        return property != null && managed.includes(property);
      },
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
    property: propertyOf(reminder) ?? "",
  });
}
