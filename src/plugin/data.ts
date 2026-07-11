import { Reference } from "model/ref";
import { Reminder, Reminders } from "model/reminder";
import { DateTime } from "model/time";
import { Settings, TAG_RESCAN } from "plugin/settings";
import type { SettingModel } from "plugin/settings/helper";

interface ReminderData {
  title: string;
  time: string;
  rowNumber: number;
}

/**
 * The minimal persistence surface `PluginData` needs. This matches the
 * signatures of Obsidian's `Plugin.loadData()`/`Plugin.saveData()`, so a
 * concrete `Plugin` instance is assignable here structurally without
 * `PluginData` depending on the `obsidian` module.
 */
export interface DataStore {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

export class PluginData {
  private restoring = true;
  changed: boolean = false;
  public scanned: Reference<boolean> = new Reference(false);
  public debug: Reference<boolean> = new Reference(false);
  // Do-not-disturb end time, or `null` while do-not-disturb is inactive.
  // Transient state (not a setting): not exposed in the settings tab, but
  // still persisted so a pause survives an Obsidian restart.
  public dndUntil: Reference<DateTime | null> = new Reference<DateTime | null>(
    null,
  );
  private readonly _settings = new Settings();

  constructor(
    private store: DataStore,
    private reminders: Reminders,
  ) {
    this.settings.forEach((setting) => {
      // `setting` is type-erased to `SettingModelBase` here; `rawValue.onChanged`
      // only registers a listener and doesn't use the raw value type, so
      // widening to `SettingModel<unknown, unknown>` to reach `rawValue` is safe.
      (setting as SettingModel<unknown, unknown>).rawValue.onChanged(() => {
        if (this.restoring) {
          return;
        }
        if (setting.hasTag(TAG_RESCAN)) {
          this.scanned.value = false;
        }
        this.changed = true;
      });
    });
  }

  async load() {
    console.debug("Load reminder plugin data");
    // `loadData()` returns data of unknown shape (it's whatever was
    // previously passed to `saveData()`), so this cast is a minimal, trusted
    // bridge between the untyped persistence API and our persisted data shape.
    const data = (await this.store.loadData()) as
      | {
          scanned: boolean;
          debug?: boolean;
          dndUntil?: number | null;
          settings?: Record<string, unknown>;
          reminders?: Record<string, Array<ReminderData>>;
        }
      | undefined;
    if (!data) {
      this.scanned.value = false;
      return;
    }
    this.scanned.value = data.scanned;
    if (data.debug != null) {
      this.debug.value = data.debug;
    }
    this.dndUntil.value =
      data.dndUntil != null ? DateTime.ofEpochMillis(data.dndUntil) : null;

    this.settings.forEach((setting) => {
      setting.load(data.settings);
    });

    const remindersData = data.reminders;
    if (remindersData) {
      Object.keys(remindersData).forEach((filePath) => {
        const remindersInFile = remindersData[filePath];
        if (!remindersInFile) {
          return;
        }
        this.reminders.replaceFile(
          filePath,
          remindersInFile.map(
            (d) =>
              new Reminder(
                filePath,
                d.title,
                DateTime.parse(d.time),
                d.rowNumber,
                false,
              ),
          ),
        );
      });
    }
    this.changed = false;
    if (this.restoring) {
      this.restoring = false;
    }
  }

  async save(force: boolean = false) {
    if (!force && !this.changed) {
      return;
    }
    console.debug(
      "Save reminder plugin data: force=%s, changed=%s",
      force,
      this.changed,
    );
    const remindersData: any = {};
    this.reminders.fileToReminders.forEach((r, filePath) => {
      remindersData[filePath] = r.map((rr) => ({
        title: rr.title,
        time: rr.time.toString(),
        rowNumber: rr.rowNumber,
      }));
    });
    const settings: Record<string, unknown> = {};
    this.settings.forEach((setting) => {
      setting.store(settings);
    });
    await this.store.saveData({
      scanned: this.scanned.value,
      reminders: remindersData,
      debug: this.debug.value,
      dndUntil: this.dndUntil.value?.getTimeInMillis() ?? null,
      settings,
    });
    this.changed = false;
  }

  get settings() {
    return this._settings;
  }
}
