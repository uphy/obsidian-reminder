import { NotificationWorker, PluginDataIO, ReminderPluginFileSystem, ReminderPluginUI, SETTINGS } from 'plugin';
import { Reminders } from 'model/reminder';
import { DATE_TIME_FORMATTER } from 'model/time';
import { App, Plugin, PluginManifest } from 'obsidian';

export default class ReminderPlugin extends Plugin {
  _pluginDataIO: PluginDataIO;
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
      this.pluginDataIO.changed = true;
    });
    this._pluginDataIO = new PluginDataIO(this, this.reminders);
    this.reminders.reminderTime = SETTINGS.reminderTime;
    DATE_TIME_FORMATTER.setTimeFormat(SETTINGS.dateFormat, SETTINGS.dateTimeFormat, SETTINGS.strictDateFormat);

    this._ui = new ReminderPluginUI(this);
    this._fileSystem = new ReminderPluginFileSystem(app.vault, this.reminders, () => {
      this.ui.reload(true);
    });
    this._notificationWorker = new NotificationWorker(this);
  }

  override async onload() {
    this.ui.onload();
    this.app.workspace.onLayoutReady(async () => {
      await this.pluginDataIO.load();
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

  get pluginDataIO() {
    return this._pluginDataIO;
  }
}
