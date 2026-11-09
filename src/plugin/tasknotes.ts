import { getAllTags } from "obsidian";
import type { App, EventRef, Plugin, TFile } from "obsidian";
import { DateTime } from "model/time";
import type { Reminder, Reminders } from "model/reminder";
import type { TaskNotesContext, TaskNotesOptions } from "model/tasknotes";
import {
  DEFAULT_TASKNOTES_PROPERTIES,
  extractReminders,
} from "model/tasknotes";
import { TaskNotesReminderState } from "model/tasknotes/state";
import type { PluginData } from "./data";
import type { Settings } from "./settings";

export class TaskNotesIntegration {
  private started = false;
  private listening = false;
  private state?: TaskNotesReminderState;
  private eventCleanups: Array<() => void> = [];
  private warnedKeys = new Set<string>();

  constructor(
    private app: App,
    private reminders: Reminders,
    private data: PluginData,
    private settings: Settings,
  ) {
    this.settings.taskNotesEnabled.rawValue.onChanged((_oldValue, enabled) => {
      if (!this.started) {
        return;
      }
      if (enabled) {
        this.enable();
      } else {
        this.disable();
      }
    });
    this.settingReferences().forEach((reference) => {
      reference.onChanged(() => {
        this.data.changed = true;
        if (this.started && this.settings.taskNotesEnabled.value) {
          void this.reloadAllFiles().catch((error: unknown) => {
            console.error("Failed to rescan TaskNotes reminders: %o", error);
          });
        }
      });
    });
  }

  async onLayoutReady(plugin: Plugin): Promise<void> {
    this.plugin = plugin;
    this.state = new TaskNotesReminderState(this.data.taskNotesReminderState);
    this.started = true;
    if (this.settings.reNotifyMutedOnStartup.value) {
      if (this.state.clearMuted() > 0) {
        this.data.changed = true;
      }
    }
    this.pruneState();
    if (this.settings.taskNotesEnabled.value) {
      this.startListening(plugin);
      await this.reloadAllFiles();
    }
  }

  async reloadAllFiles(): Promise<void> {
    await this.data.loaded;
    if (!this.settings.taskNotesEnabled.value) {
      this.reminders.clearSource("tasknotes");
      return;
    }
    this.pruneState();
    for (const file of this.app.vault.getMarkdownFiles()) {
      this.updateFile(file, this.app.metadataCache.getFileCache(file));
    }
  }

  done(reminder: Reminder): void {
    const task = this.taskForReminder(reminder);
    const state = this.stateForEvents();
    state.set(reminder.file, task.reminderId, reminder.time, "done");
    this.data.changed = true;
  }

  snooze(reminder: Reminder, until: DateTime): void {
    const task = this.taskForReminder(reminder);
    this.stateForEvents().set(
      reminder.file,
      task.reminderId,
      reminder.time,
      "snoozed",
      until,
    );
    reminder.effectiveTime = until;
    reminder.muteNotification = false;
    this.reminders.resort();
    this.data.changed = true;
  }

  mute(reminder: Reminder): void {
    const task = this.taskForReminder(reminder);
    this.stateForEvents().set(
      reminder.file,
      task.reminderId,
      reminder.time,
      "muted",
    );
    reminder.muteNotification = true;
    this.data.changed = true;
  }

  private enable(): void {
    const plugin = this.plugin;
    if (!plugin) {
      return;
    }
    this.startListening(plugin);
    void this.reloadAllFiles().catch((error: unknown) => {
      console.error(
        "Failed to scan TaskNotes reminders after enabling: %o",
        error,
      );
    });
  }

  private disable(): void {
    this.stopListening();
    if (this.reminders.clearSource("tasknotes")) {
      this.data.changed = true;
    }
  }

  private plugin?: Plugin;

  private startListening(plugin: Plugin): void {
    if (this.listening) {
      return;
    }
    this.plugin = plugin;
    const changedRef = this.app.metadataCache.on(
      "changed",
      (file, _data, cache) => {
        this.updateFile(file, cache);
      },
    );
    this.registerEvent(plugin, this.app.metadataCache, changedRef);

    const renameRef = this.app.vault.on("rename", (file, oldPath) => {
      const stateMoved = this.stateForEvents().migratePath(oldPath, file.path);
      const remindersMoved = this.reminders.migrateSourceFile(
        oldPath,
        file.path,
        "tasknotes",
      );
      if (stateMoved > 0 || remindersMoved) {
        this.data.changed = true;
      }
      this.moveWarnings(oldPath, file.path);
    });
    this.registerEvent(plugin, this.app.vault, renameRef);

    const deleteRef = this.app.vault.on("delete", (file) => {
      const removedState = this.stateForEvents().removeFile(file.path);
      const removedReminders = this.reminders.removeSourceFile(
        file.path,
        "tasknotes",
      );
      if (removedState > 0 || removedReminders) {
        this.data.changed = true;
      }
      this.clearWarnings(file.path);
    });
    this.registerEvent(plugin, this.app.vault, deleteRef);
    this.listening = true;
  }

  private registerEvent(
    plugin: Plugin,
    target: { offref: (ref: EventRef) => void },
    ref: EventRef,
  ): void {
    plugin.registerEvent(ref);
    this.eventCleanups.push(() => target.offref(ref));
  }

  private stopListening(): void {
    this.eventCleanups.forEach((cleanup) => cleanup());
    this.eventCleanups = [];
    this.listening = false;
  }

  private updateFile(
    file: TFile,
    cache: ReturnType<App["metadataCache"]["getFileCache"]>,
  ): void {
    if (
      !this.settings.taskNotesEnabled.value ||
      file.extension.toLowerCase() !== "md"
    ) {
      return;
    }
    const options = this.options();
    const context: TaskNotesContext = {
      filePath: file.path,
      fileName: file.basename,
      tags: cache ? (getAllTags(cache) ?? []) : [],
      options,
      warnOnce: (key, message) => {
        if (!this.warnedKeys.has(key)) {
          this.warnedKeys.add(key);
          console.warn(message);
        }
      },
    };
    const parsed = extractReminders(cache?.frontmatter, context);
    const active: Array<Reminder> = [];
    parsed.forEach((reminder) => {
      const task = reminder.tasknotes;
      if (!task) {
        return;
      }
      const key = `${file.path}::${task.reminderId}`;
      const hadEntry = Object.prototype.hasOwnProperty.call(
        this.data.taskNotesReminderState,
        key,
      );
      const state = this.stateForEvents();
      const entry = state.get(file.path, task.reminderId, reminder.time);
      if (hadEntry && !entry) {
        this.data.changed = true;
      }
      if (entry?.kind === "done") {
        return;
      }
      reminder.effectiveTime = state.effectiveTime(
        file.path,
        task.reminderId,
        reminder.time,
      );
      reminder.muteNotification = entry?.kind === "muted";
      active.push(reminder);
    });
    this.reminders.replaceSourceFile(file.path, "tasknotes", active);
  }

  private options(): TaskNotesOptions {
    const rawMode = this.settings.taskNotesIdentificationMode.value;
    const identificationMode =
      rawMode === "property" || rawMode === "reminders" ? rawMode : "tag";
    const properties = {
      title: this.propertyName("title"),
      status: this.propertyName("status"),
      due: this.propertyName("due"),
      scheduled: this.propertyName("scheduled"),
      reminders: this.propertyName("reminders"),
      completedDate: this.propertyName("completedDate"),
      recurrence: this.propertyName("recurrence"),
      completeInstances: this.propertyName("completeInstances"),
      skippedInstances: this.propertyName("skippedInstances"),
    };
    const ignoreOlderThanDays =
      this.settings.taskNotesIgnoreOlderThanDays.value;
    return {
      identificationMode,
      tag: this.settings.taskNotesTag.value,
      identificationProperty:
        this.settings.taskNotesIdentificationProperty.value,
      identificationValue: this.settings.taskNotesIdentificationValue.value,
      excludedFolders: this.settings.taskNotesExcludedFolders.value,
      properties,
      completedStatuses: this.settings.taskNotesCompletedStatuses.value
        .split(/\r?\n/)
        .map((status) => status.trim())
        .filter((status) => status.length > 0),
      skipCompleted: this.settings.taskNotesSkipCompleted.value,
      skipArchived: this.settings.taskNotesSkipArchived.value,
      archiveTag: this.settings.taskNotesArchiveTag.value,
      skipRecurringInstances:
        this.settings.taskNotesSkipRecurringInstances.value,
      dateOnlyAnchorTime: this.settings.taskNotesDateOnlyAnchorTime.value,
      ignoreOlderThanDays: Number.isFinite(ignoreOlderThanDays)
        ? Math.max(0, Math.floor(ignoreOlderThanDays))
        : 1,
    };
  }

  private pruneState(): void {
    if (
      this.stateForEvents().prune(
        DateTime.now(),
        this.options().ignoreOlderThanDays,
      ) > 0
    ) {
      this.data.changed = true;
    }
  }

  private propertyName(
    property: keyof typeof DEFAULT_TASKNOTES_PROPERTIES,
  ): string {
    return (
      this.settings.taskNotesProperties[property].value.trim() ||
      DEFAULT_TASKNOTES_PROPERTIES[property]
    );
  }

  private taskForReminder(reminder: Reminder) {
    if (reminder.source !== "tasknotes" || !reminder.tasknotes) {
      throw new Error("TaskNotes state requires a TaskNotes reminder.");
    }
    return reminder.tasknotes;
  }

  private stateForEvents(): TaskNotesReminderState {
    if (!this.state) {
      throw new Error("TaskNotes state is not initialized.");
    }
    return this.state;
  }

  private settingReferences() {
    return [
      this.settings.taskNotesIdentificationMode.rawValue,
      this.settings.taskNotesTag.rawValue,
      this.settings.taskNotesIdentificationProperty.rawValue,
      this.settings.taskNotesIdentificationValue.rawValue,
      this.settings.taskNotesExcludedFolders.rawValue,
      this.settings.taskNotesCompletedStatuses.rawValue,
      this.settings.taskNotesSkipCompleted.rawValue,
      this.settings.taskNotesSkipArchived.rawValue,
      this.settings.taskNotesArchiveTag.rawValue,
      this.settings.taskNotesSkipRecurringInstances.rawValue,
      this.settings.taskNotesDateOnlyAnchorTime.rawValue,
      this.settings.taskNotesIgnoreOlderThanDays.rawValue,
      ...Object.values(this.settings.taskNotesProperties).map(
        (setting) => setting.rawValue,
      ),
    ];
  }

  private moveWarnings(oldPath: string, newPath: string): void {
    const oldPrefix = `${oldPath}::`;
    const warnings = Array.from(this.warnedKeys).filter((key) =>
      key.startsWith(oldPrefix),
    );
    warnings.forEach((key) => {
      this.warnedKeys.delete(key);
      this.warnedKeys.add(`${newPath}::${key.slice(oldPrefix.length)}`);
    });
  }

  private clearWarnings(path: string): void {
    const prefix = `${path}::`;
    Array.from(this.warnedKeys)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => this.warnedKeys.delete(key));
  }
}
