import {
  NoteReminderService,
  NotificationWorker,
  NtfyController,
  PluginData,
  ReminderPluginFileSystem,
  ReminderPluginUI,
} from "plugin";
import { isNotificationPaused } from "model/dnd";
import { isPathExcluded } from "model/exclusion";
import { PropertyNoteReminderFormat } from "model/note/property-format";
import { NoteReminderReader } from "model/note/reader";
import {
  countSourceStats,
  newSourceCutOff,
  withManagedSource,
} from "model/note/sources";
import type { NoteReminderSource } from "model/note/sources";
import type { Frontmatter } from "model/note/format";
import { TaskNotesNoteReminderFormat } from "model/note/tasknotes-format";
import {
  exportTaskNotesSettings,
  taskNotesDefaults,
} from "model/note/tasknotes-settings";
import { Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import type { Settings } from "plugin/settings";
import { setSeededTaskStatuses } from "plugin/settings";
import { formatStatusSetting } from "model/format/status";
import type { TaskStatus } from "model/format/status";
import { App, Notice, Plugin, TFile, parseYaml, requestUrl } from "obsidian";
import type { PluginManifest } from "obsidian";

export default class ReminderPlugin extends Plugin {
  _data: PluginData;
  // `Plugin.settings` is declared as `settings?: unknown` since obsidian 1.13.0.
  // We override it with the concrete `Settings` type here. It has to be a plain
  // field (not a getter) because TypeScript doesn't allow overriding a base
  // class property with an accessor.
  override settings: Settings;
  private _ui: ReminderPluginUI;
  private _reminders: Reminders;
  private _fileSystem: ReminderPluginFileSystem;
  private _noteReminders: NoteReminderService;
  private _noteReminderReader: NoteReminderReader;
  private _notificationWorker: NotificationWorker;
  private _ntfyController: NtfyController;
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this._reminders = new Reminders(() => {
      // on changed
      if (this.ui) {
        this.ui.invalidate();
      }
      this.data.changed = true;
      if (this._ntfyController) {
        this._ntfyController.notifyRemindersChanged();
      }
    });
    this._data = new PluginData(this, this.reminders);
    // `data.settings` always returns the same `Settings` instance for the
    // lifetime of the plugin (only its values change on reload), so it's
    // safe to capture the reference once here.
    this.settings = this.data.settings;
    // Resolve "automatic" before any UI is built, so the commands registered
    // in `onload()` already use the right language. `applyLanguage()` runs
    // again once the persisted settings are loaded.
    this.settings.applyLanguage();
    this.reminders.reminderTime = this.settings.reminderTime;
    DATE_TIME_FORMATTER.setTimeFormat(
      this.settings.dateFormat,
      this.settings.dateTimeFormat,
      this.settings.strictDateFormat,
    );

    this._noteReminderReader = new NoteReminderReader([
      new PropertyNoteReminderFormat(() => this.noteReminderSources()),
      new TaskNotesNoteReminderFormat(() => this.settings.taskNotesOptions()),
    ]);
    const fileAt = (path: string): TFile => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        throw new Error(`Not a file: ${path}`);
      }
      return file;
    };
    this._noteReminders = new NoteReminderService(this._noteReminderReader, {
      parseYaml: (yaml): unknown => parseYaml(yaml),
      readFile: async (path) => this.app.vault.read(fileAt(path)),
      processFrontMatter: async (path, fn) => {
        await this.app.fileManager.processFrontMatter(fileAt(path), fn);
      },
    });
    this.settings.noteReminderStats = (source) =>
      this.noteReminderStats(source);
    this.settings.noteReminderNewCutOff = (property, today) =>
      this.newNoteReminderCutOff(property, today);
    this.settings.taskNotesDefaults = () => this.taskNotesDefaults();

    this._ui = new ReminderPluginUI(this);
    this._fileSystem = new ReminderPluginFileSystem(
      app.vault,
      this.reminders,
      () => {
        this.ui.reload(true);
      },
      () => this.settings.excludedPaths.value,
      () => this.data.loaded,
      (path, content) => this.noteReminders.read(path, content),
    );
    this._notificationWorker = new NotificationWorker({
      registerInterval: (id) => this.registerInterval(id),
      isLayoutReady: () => this.app.workspace.layoutReady,
      reloadUI: (force) => this.ui.reload(force),
      isEditing: () => this.ui.isEditing(),
      // Deliberately `!== "toast"` rather than `=== "modal"`: any future/
      // unknown popup style value falls back to the previous, conservative
      // (intrusive) behavior.
      isPopupIntrusive: () =>
        this.settings.notificationPopupStyle.value !== "toast",
      showReminder: (reminder) => this.ui.showReminder(reminder),
      isScanned: () => this.data.scanned.value,
      markScanned: () => {
        this.data.scanned.value = true;
      },
      saveData: (force) => {
        // `NotificationWorkerDeps.saveData` is synchronous by contract; the
        // save itself is fire-and-forget here.
        void this.data.save(force);
      },
      reloadRemindersInAllFiles: () =>
        this.fileSystem.reloadRemindersInAllFiles(),
      getExpiredReminders: () =>
        this.reminders.getExpiredReminders(this.settings.reminderTime.value),
      checkIntervalSec: () => this.settings.reminderCheckIntervalSec.value,
      isNotificationEnabled: () => this.settings.enableNotification.value,
      isNotificationPaused: () =>
        isNotificationPaused(this.data.dndUntil.value, DateTime.now()),
    });
    this._ntfyController = new NtfyController({
      isEnabled: () => this.settings.ntfyEnabled.value,
      serverUrl: () => this.settings.ntfyServerUrl.value,
      topic: () => this.settings.ntfyTopic.value,
      accessToken: () => this.settings.ntfyAccessToken.value,
      reminders: () => this.reminders.reminders,
      defaultTime: () => this.settings.reminderTime.value,
      hasNoteReminderSources: () =>
        this.noteReminderSources().length > 0 ||
        this.settings.taskNotesEnabled.value,
      vaultName: () => this.app.vault.getName(),
      registerInterval: (id) => this.registerInterval(id),
      // `throw: false` so an HTTP error status comes back as a response the
      // controller can inspect (status *and* body) instead of an exception
      // that has already thrown away the server's explanation.
      request: (request) => requestUrl({ ...request, throw: false }),
      notify: (message) => {
        new Notice(message);
      },
    });
    // Without this, changing any of the ntfy settings (most importantly,
    // flipping the toggle back on) would sit inert until the next reminder
    // edit or the 30-minute interval sync happened to come around. See
    // `NtfyController.notifySettingsChanged()` for why this is debounced
    // rather than syncing immediately.
    for (const setting of [
      this.settings.ntfyEnabled,
      this.settings.ntfyServerUrl,
      this.settings.ntfyTopic,
      this.settings.ntfyAccessToken,
    ]) {
      setting.rawValue.onChanged(() => {
        this._ntfyController.notifySettingsChanged();
      });
    }
  }

  override async onload() {
    this.ui.onload();
    this.app.workspace.onLayoutReady(async () => {
      await this.data.load();
      // A fresh install has nothing persisted for the "Language" setting, so
      // its change listener never fires; resolving "automatic" here is what
      // makes the plugin follow Obsidian's UI language from the first run on.
      this.settings.applyLanguage();
      await this.seedTaskStatuses();
      this.ui.onLayoutReady();
      this.fileSystem.onload(this);
      this._notificationWorker.startPeriodicTask();
      this._ntfyController.start();
    });
  }

  /**
   * Seeds the "Task statuses" fallback from the Tasks plugin's own status
   * settings, so an empty setting follows the vault's real statuses. Reads
   * via `loadData()` because the Tasks plugin does not expose its settings
   * object on the plugin instance.
   */
  private async seedTaskStatuses() {
    try {
      let statuses: Array<TaskStatus> = [];
      const tasks = this.app.plugins.plugins["obsidian-tasks-plugin"];
      if (tasks != null) {
        // `loadData()` returns whatever the Tasks plugin persisted; this cast
        // is the minimal trusted bridge to the fields read here (same pattern
        // as `PluginData.doLoad`).
        const data = (await tasks.loadData()) as
          | {
              statusSettings?: {
                coreStatuses?: Array<TaskStatus>;
                customStatuses?: Array<TaskStatus>;
              };
            }
          | undefined;
        const statusSettings = data?.statusSettings;
        if (statusSettings != null) {
          statuses = [
            ...(statusSettings.coreStatuses ?? []),
            ...(statusSettings.customStatuses ?? []),
          ];
        }
      }
      setSeededTaskStatuses(statuses);
      // Reminders already stored in data.json were classified under the
      // PREVIOUS seed and are restored without re-parsing, so a seed that
      // changed since last session (the Tasks plugin's statuses edited, the
      // plugin installed or removed) must force a rescan. An empty seed is a
      // real value here for exactly that reason. Runs after `data.load()`
      // and before the notification worker starts, so the cleared `scanned`
      // is acted on this session.
      this.data.updateSeededTaskStatuses(formatStatusSetting(statuses));
    } catch (e) {
      // Read failure is not a seed of "no statuses": keep last session's
      // seed rather than rescanning the vault on a transient error.
      console.warn("Failed to read the Tasks plugin's statuses: %o", e);
    }
  }

  override onunload(): void {
    this.ui.onunload();
    this._ntfyController.stop();
  }

  get reminders() {
    return this._reminders;
  }

  get ui() {
    return this._ui;
  }

  get fileSystem() {
    return this._fileSystem;
  }

  /** Reads and writes the reminders kept in a note's properties. */
  get noteReminders() {
    return this._noteReminders;
  }

  get noteReminderReader() {
    return this._noteReminderReader;
  }

  /** The rows of the "Properties to remind from" setting. */
  noteReminderSources(): Array<NoteReminderSource> {
    return this.settings.noteReminderSources.value;
  }

  /** The sources the reminder dialog may create, edit and remove. */
  managedNoteReminderSources(): Array<NoteReminderSource> {
    return this.noteReminderSources().filter((source) => source.managed);
  }

  /**
   * Lets the reminder dialog manage `property`: adds it as a managed source
   * (with today as its cut-off when the vault already holds earlier values
   * of it), or switches an existing row to managed.
   * Returns false when the name can't be a source (it is a companion of
   * another row).
   */
  addManagedNoteReminderSource(property: string): boolean {
    const rows = withManagedSource(
      this.noteReminderSources(),
      property,
      this.newNoteReminderCutOff(property, DateTime.now().format("YYYY-MM-DD")),
    );
    if (rows == null) {
      return false;
    }
    this.settings.noteReminderSources.rawValue.value = rows;
    return true;
  }

  /**
   * The defaults of the TaskNotes settings: the running TaskNotes plugin's
   * own settings, else what it said the last time it was running, else
   * TaskNotes' factory defaults. What TaskNotes says is recorded on the way,
   * for the sessions (and synced devices) where it is not there, e.g.
   * because it loads after this plugin or is not installed.
   *
   * TaskNotes keeps its settings on the plugin instance. That is not an API,
   * so they are checked field by field before use (`importTaskNotesSettings`).
   */
  private taskNotesDefaults() {
    const defaults = taskNotesDefaults(
      this.app.plugins.plugins.tasknotes?.settings,
      this.data.knownTaskNotesSettings,
    );
    if (defaults.source === "tasknotes") {
      this.data.updateKnownTaskNotesSettings(
        exportTaskNotesSettings(defaults.settings),
      );
    }
    return defaults;
  }

  /**
   * The cut-off for a property that is being added. Every note counts,
   * also under an excluded path: its values are read once the path is no
   * longer excluded. A note Obsidian has not indexed yet makes the answer
   * unknown, which `newSourceCutOff` turns into today.
   */
  private newNoteReminderCutOff(property: string, today: string): string {
    const frontmatters: Array<Frontmatter> = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache == null) {
        return newSourceCutOff(property, today, null);
      }
      if (cache.frontmatter != null) {
        frontmatters.push(cache.frontmatter);
      }
    }
    return newSourceCutOff(property, today, frontmatters);
  }

  /**
   * Display-only numbers for the settings page, taken from Obsidian's
   * metadata cache (which may lag a just-edited note by a moment). Notes
   * under an excluded path are not read, so they are not counted.
   */
  private noteReminderStats(source: NoteReminderSource) {
    const frontmatters: Array<Frontmatter> = [];
    const excluded = this.settings.excludedPaths.value;
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isPathExcluded(file.path, excluded)) {
        continue;
      }
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm != null) {
        frontmatters.push(fm);
      }
    }
    return countSourceStats(source, frontmatters);
  }

  get data() {
    return this._data;
  }
}
