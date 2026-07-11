import {
  NotificationWorker,
  PluginData,
  ReminderPluginFileSystem,
  ReminderPluginUI,
} from "plugin";
import { Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER } from "model/time";
import type { Settings } from "plugin/settings";
import { App, Plugin } from "obsidian";
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
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this._reminders = new Reminders(() => {
      // on changed
      if (this.ui) {
        this.ui.invalidate();
      }
      this.data.changed = true;
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
    );
    this._notificationWorker = new NotificationWorker({
      registerInterval: (id) => this.registerInterval(id),
      isLayoutReady: () => this.app.workspace.layoutReady,
      reloadUI: (force) => this.ui.reload(force),
      isEditing: () => this.ui.isEditing(),
      showReminder: (reminder) => this.ui.showReminder(reminder),
      isScanned: () => this.data.scanned.value,
      markScanned: () => {
        this.data.scanned.value = true;
      },
      saveData: (force) => {
        this.data.save(force);
      },
      reloadRemindersInAllFiles: () =>
        this.fileSystem.reloadRemindersInAllFiles(),
      getExpiredReminders: () =>
        this.reminders.getExpiredReminders(this.settings.reminderTime.value),
      checkIntervalSec: () => this.settings.reminderCheckIntervalSec.value,
      isNotificationEnabled: () => this.settings.enableNotification.value,
    });
  }

  override async onload() {
    this.ui.onload();
    this.app.workspace.onLayoutReady(async () => {
      await this.data.load();
      this.ui.onLayoutReady();
      this.fileSystem.onload(this);
      this._notificationWorker.startPeriodicTask();
    });
  }

  override onunload(): void {
    this.ui.onunload();
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
