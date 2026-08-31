import {
  NotificationWorker,
  NtfyController,
  PluginData,
  ReminderPluginFileSystem,
  ReminderPluginUI,
} from "plugin";
import { isNotificationPaused } from "model/dnd";
import { Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import type { Settings } from "plugin/settings";
import { setSeededTaskStatuses } from "plugin/settings";
import { formatStatusSetting } from "model/format/status";
import type { TaskStatus } from "model/format/status";
import { App, Notice, Plugin, requestUrl } from "obsidian";
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
    this.reminders.reminderTime = this.settings.reminderTime;
    DATE_TIME_FORMATTER.setTimeFormat(
      this.settings.dateFormat,
      this.settings.dateTimeFormat,
      this.settings.strictDateFormat,
    );

    this._ui = new ReminderPluginUI(this);
    this._fileSystem = new ReminderPluginFileSystem(
      app.vault,
      this.reminders,
      () => {
        this.ui.reload(true);
      },
      () => this.settings.excludedPaths.value,
      () => this.data.loaded,
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

  get data() {
    return this._data;
  }
}
