import {
  NotificationWorker,
  PluginData,
  ReminderPluginFileSystem,
  ReminderPluginUI,
} from "plugin";
import { Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER } from "model/time";
import { App, Plugin } from "obsidian";
import type { PluginManifest } from "obsidian";

export default class ReminderPlugin extends Plugin {
  _data: PluginData;
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
    this._notificationWorker = new NotificationWorker(this);
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

  get settings() {
    return this.data.settings;
  }
}
