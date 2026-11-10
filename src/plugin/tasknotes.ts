import { Notice, TFile, getAllTags } from "obsidian";
import type { App, EventRef, Plugin } from "obsidian";
import { DateTime } from "model/time";
import type { Reminder, Reminders } from "model/reminder";
import type { TaskNotesContext, TaskNotesOptions } from "model/tasknotes";
import {
  DEFAULT_TASKNOTES_PROPERTIES,
  extractReminders,
} from "model/tasknotes";
import {
  importTaskNotesRuntimeSettings,
  importTaskNotesSettings,
} from "model/tasknotes/settings-import";
import { completeTaskNotesReminder } from "model/tasknotes/completion";
import { TaskNotesReminderState } from "model/tasknotes/state";
import type { PluginData } from "./data";
import type { Settings } from "./settings";
import { TaskNotesRescanScheduler } from "./tasknotes-rescan";

interface TaskNotesModalApi {
  getTaskInfo(filePath: string): Promise<unknown>;
  openTaskEditModal(taskInfo: unknown): Promise<void>;
}

type TaskInfoGetter = (filePath: string) => Promise<unknown>;
type TaskInfoSource = (filePath: string) => unknown;
type TaskEditModal = (taskInfo: unknown) => void | Promise<void>;

interface TaskNotesRuntimeApi {
  apiVersion: number;
  hasCapability: (capability: string) => boolean;
  settings?: unknown;
  catalog?: unknown;
  tasks?: unknown;
}

export class TaskNotesIntegration {
  private started = false;
  private listening = false;
  private state?: TaskNotesReminderState;
  private eventCleanups: Array<() => void> = [];
  private warnedKeys = new Set<string>();
  private applyingFetchedSettings = false;
  private rescanScheduler: TaskNotesRescanScheduler;

  constructor(
    private app: App,
    private reminders: Reminders,
    private data: PluginData,
    private settings: Settings,
  ) {
    this.rescanScheduler = new TaskNotesRescanScheduler(() =>
      this.reloadAllFiles(),
    );
    this.settings.setTaskNotesSettingsFetcher(() =>
      this.fetchSettingsFromTaskNotes(),
    );
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
        if (this.applyingFetchedSettings) {
          return;
        }
        this.data.changed = true;
        if (this.started && this.settings.taskNotesEnabled.value) {
          void this.rescanScheduler.schedule().catch((error: unknown) => {
            console.error("Failed to rescan TaskNotes reminders: %o", error);
          });
        }
      });
    });
  }

  private async fetchSettingsFromTaskNotes(): Promise<string> {
    const taskNotesPlugin = this.app.plugins.plugins["tasknotes"];
    if (!isRecord(taskNotesPlugin)) {
      throw new Error(
        "TaskNotes must be installed and enabled to fetch settings.",
      );
    }

    const api = getTaskNotesRuntimeApi(taskNotesPlugin);
    const imported =
      api?.hasCapability("settings.snapshot") &&
      api.hasCapability("catalog.read")
        ? importTaskNotesRuntimeSettings(
            callRuntimeApiMethod(api["settings"], "snapshot"),
            callRuntimeApiMethod(api["catalog"], "statuses"),
          )
        : importTaskNotesSettings(taskNotesPlugin["settings"]);
    this.applyingFetchedSettings = true;
    try {
      this.settings.taskNotesIdentificationMode.rawValue.value =
        imported.identificationMode;
      this.settings.taskNotesTag.rawValue.value = imported.tag;
      this.settings.taskNotesIdentificationProperty.rawValue.value =
        imported.identificationProperty;
      this.settings.taskNotesIdentificationValue.rawValue.value =
        imported.identificationValue;
      this.settings.taskNotesExcludedFolders.rawValue.value =
        imported.excludedFolders;
      this.settings.taskNotesCompletedStatuses.rawValue.value =
        imported.completedStatuses;
      this.settings.taskNotesArchiveTag.rawValue.value = imported.archiveTag;
      this.settings.taskNotesProperties.title.rawValue.value =
        imported.properties.title;
      this.settings.taskNotesProperties.status.rawValue.value =
        imported.properties.status;
      this.settings.taskNotesProperties.due.rawValue.value =
        imported.properties.due;
      this.settings.taskNotesProperties.scheduled.rawValue.value =
        imported.properties.scheduled;
      this.settings.taskNotesProperties.reminders.rawValue.value =
        imported.properties.reminders;
      this.settings.taskNotesProperties.completedDate.rawValue.value =
        imported.properties.completedDate;
      this.settings.taskNotesProperties.recurrence.rawValue.value =
        imported.properties.recurrence;
      this.settings.taskNotesProperties.completeInstances.rawValue.value =
        imported.properties.completeInstances;
      this.settings.taskNotesProperties.skippedInstances.rawValue.value =
        imported.properties.skippedInstances;
    } finally {
      this.applyingFetchedSettings = false;
    }

    this.data.changed = true;
    if (this.started && this.settings.taskNotesEnabled.value) {
      try {
        await this.rescanScheduler.schedule();
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "unknown rescan error";
        throw new Error(
          `TaskNotes settings were imported, but reminders could not be rescanned: ${detail}`,
        );
      }
      return "Fetched TaskNotes settings and rescanned reminders.";
    }
    return "Fetched TaskNotes settings. Enable the integration to scan reminders.";
  }

  async onLayoutReady(plugin: Plugin): Promise<void> {
    this.plugin = plugin;
    plugin.register(() => this.rescanScheduler.cancelPending());
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
      await this.rescanScheduler.runNow();
    }
  }

  async reloadAllFiles(): Promise<void> {
    await this.data.loaded;
    if (!this.settings.taskNotesEnabled.value) {
      this.reminders.clearSource("tasknotes");
      return;
    }
    this.pruneState();
    const files = new Map<string, Array<Reminder>>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      files.set(
        file.path,
        this.getFileReminders(file, this.app.metadataCache.getFileCache(file)),
      );
    }
    this.reminders.replaceSourceFiles("tasknotes", files);
  }

  async done(reminder: Reminder): Promise<void> {
    const task = this.taskForReminder(reminder);
    await completeTaskNotesReminder({
      openTaskEditModal: () => this.openTaskEditModal(reminder),
      notifyModalUnavailable: () => {
        new Notice(
          "Tasknotes edit modal is unavailable. Opening the task note instead.",
        );
      },
      openTaskNote: () => this.openTaskNote(reminder),
      markReminderDone: () => {
        this.stateForEvents().set(
          reminder.file,
          task.reminderId,
          reminder.time,
          "done",
        );
        this.data.changed = true;
      },
    });
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
    void this.rescanScheduler.runNow().catch((error: unknown) => {
      console.error(
        "Failed to scan TaskNotes reminders after enabling: %o",
        error,
      );
    });
  }

  private disable(): void {
    this.rescanScheduler.cancelPending();
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
      if (!isMarkdownPath(oldPath)) {
        return;
      }
      if (!isMarkdownPath(file.path)) {
        this.removeFileState(oldPath);
        return;
      }
      if (!this.hasTaskNotesData(oldPath)) {
        return;
      }
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
      if (!isMarkdownPath(file.path) || !this.hasTaskNotesData(file.path)) {
        return;
      }
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
    if (!isMarkdownPath(file.path)) {
      return;
    }
    if (!this.hasReminderItems(cache)) {
      this.removeFileState(file.path);
      return;
    }
    this.reminders.replaceSourceFile(
      file.path,
      "tasknotes",
      this.getFileReminders(file, cache),
    );
  }

  private getFileReminders(
    file: TFile,
    cache: ReturnType<App["metadataCache"]["getFileCache"]>,
  ): Array<Reminder> {
    if (
      !this.settings.taskNotesEnabled.value ||
      file.extension.toLowerCase() !== "md"
    ) {
      return [];
    }
    if (!this.hasReminderItems(cache)) {
      return [];
    }
    const options = this.options();
    const context: TaskNotesContext = {
      filePath: file.path,
      fileName: file.basename,
      tags: cache ? (getAllTags(cache) ?? []) : [],
      options,
      effectiveTimeFor: (reminderId, trigger) => {
        const key = `${file.path}::${reminderId}`;
        const hadEntry = Object.prototype.hasOwnProperty.call(
          this.data.taskNotesReminderState,
          key,
        );
        const entry = this.stateForEvents().get(file.path, reminderId, trigger);
        if (hadEntry && !entry) {
          this.data.changed = true;
        }
        return DateTime.ofEpochMillis(
          entry?.until ?? trigger.getTimeInMillis(),
        );
      },
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
    return active;
  }

  private hasReminderItems(
    cache: ReturnType<App["metadataCache"]["getFileCache"]>,
  ): boolean {
    const frontmatter = cache?.frontmatter;
    if (!isRecord(frontmatter)) {
      return false;
    }
    const reminders = frontmatter[this.propertyName("reminders")];
    return Array.isArray(reminders) && reminders.length > 0;
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

  private async openTaskEditModal(reminder: Reminder): Promise<boolean> {
    const api = getTaskNotesModalApi(this.app.plugins.plugins);
    const taskInfo = await api?.getTaskInfo(reminder.file);
    if (api && taskInfo) {
      await api.openTaskEditModal(taskInfo);
      return true;
    }
    return false;
  }

  private async openTaskNote(reminder: Reminder): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      throw new Error(
        `Cannot open TaskNotes note because it is unavailable: ${reminder.file}`,
      );
    }
    await this.app.workspace.getLeaf(false).openFile(file);
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

  private hasTaskNotesData(path: string): boolean {
    return (
      this.reminders.hasSourceFile(path, "tasknotes") ||
      this.stateForEvents().hasFile(path) ||
      this.hasWarnings(path)
    );
  }

  private hasWarnings(path: string): boolean {
    const prefix = `${path}::`;
    return Array.from(this.warnedKeys).some((key) => key.startsWith(prefix));
  }

  private removeFileState(path: string): void {
    const state = this.stateForEvents();
    const removedState = state.hasFile(path) ? state.removeFile(path) : 0;
    const removedReminders = this.reminders.removeSourceFile(path, "tasknotes");
    if (this.hasWarnings(path)) {
      this.clearWarnings(path);
    }
    if (removedState > 0 || removedReminders) {
      this.data.changed = true;
    }
  }
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function getTaskNotesModalApi(plugins: unknown): TaskNotesModalApi | undefined {
  if (!isRecord(plugins)) {
    return undefined;
  }
  const plugin = plugins["tasknotes"];
  if (!isRecord(plugin)) {
    return undefined;
  }
  const openTaskEditModal = plugin["openTaskEditModal"];
  if (!isTaskEditModal(openTaskEditModal)) {
    return undefined;
  }

  const api = getTaskNotesRuntimeApi(plugin);
  const taskGetter = api?.hasCapability("tasks.read")
    ? runtimeTaskGetter(api)
    : legacyTaskGetter(plugin);
  if (!taskGetter) {
    return undefined;
  }
  return {
    getTaskInfo: taskGetter,
    openTaskEditModal: async (taskInfo) => {
      await openTaskEditModal.call(plugin, taskInfo);
    },
  };
}

function getTaskNotesRuntimeApi(
  plugin: Record<string, unknown>,
): TaskNotesRuntimeApi | undefined {
  const api = plugin["api"];
  if (
    !isRecord(api) ||
    api["apiVersion"] !== 1 ||
    !isCapabilityChecker(api["hasCapability"])
  ) {
    return undefined;
  }
  const hasCapability = api["hasCapability"];
  return {
    apiVersion: 1,
    hasCapability: (capability) => hasCapability.call(api, capability),
    settings: api["settings"],
    catalog: api["catalog"],
    tasks: api["tasks"],
  };
}

function callRuntimeApiMethod(target: unknown, methodName: string): unknown {
  if (!isRecord(target)) {
    throw new Error(
      `TaskNotes runtime API is missing the ${methodName} interface.`,
    );
  }
  const method = target[methodName];
  if (typeof method !== "function") {
    throw new Error(`TaskNotes runtime API does not provide ${methodName}().`);
  }
  return method.call(target);
}

function runtimeTaskGetter(
  api: TaskNotesRuntimeApi,
): TaskInfoGetter | undefined {
  if (!isRecord(api["tasks"])) {
    throw new Error("TaskNotes runtime API is missing the tasks interface.");
  }
  const tasks = api["tasks"];
  const getTask = tasks["get"];
  if (!isTaskInfoGetter(getTask)) {
    throw new Error("TaskNotes runtime API does not provide tasks.get().");
  }
  return async (filePath) => await getTask.call(tasks, filePath);
}

function legacyTaskGetter(
  plugin: Record<string, unknown>,
): TaskInfoGetter | undefined {
  const cacheManager = plugin["cacheManager"];
  if (!isRecord(cacheManager)) {
    return undefined;
  }
  const getTaskInfo = cacheManager["getTaskInfo"];
  if (!isTaskInfoGetter(getTaskInfo)) {
    return undefined;
  }
  return async (filePath) => await getTaskInfo.call(cacheManager, filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTaskInfoGetter(value: unknown): value is TaskInfoSource {
  return typeof value === "function";
}

function isCapabilityChecker(
  value: unknown,
): value is (capability: string) => boolean {
  return typeof value === "function";
}

function isTaskEditModal(value: unknown): value is TaskEditModal {
  return typeof value === "function";
}
