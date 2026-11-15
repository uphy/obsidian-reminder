import { Reference } from "model/ref";
import { Reminder, Reminders } from "model/reminder";
import { DateTime } from "model/time";
import { Settings, TAG_RESCAN } from "plugin/settings";
import type { SettingModel } from "plugin/settings/helper";

interface ReminderData {
  title: string;
  time: string;
  rowNumber: number;
  muted?: boolean;
}

/**
 * A cached note reminder. Kept under its own key in data.json, apart from
 * `ReminderData`, so that a plugin version that predates note reminders
 * never loads one as a line reminder.
 */
interface NoteReminderData {
  title: string;
  time: string;
  muted?: boolean;
  format: string;
  key: string;
  label: string;
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
  private resolveLoaded: () => void = () => {};
  /**
   * Resolves once the first `load()` has finished (or failed). Anything that
   * reparses the whole vault has to wait for this, because scanning before
   * the persisted settings and reminders are restored produces reminders
   * parsed with default settings — and `Reminders.replaceFile()` would then
   * carry the restored mute flags over onto them.
   */
  readonly loaded: Promise<void> = new Promise<void>((resolve) => {
    this.resolveLoaded = resolve;
  });
  changed: boolean = false;
  public scanned: Reference<boolean> = new Reference(false);
  // The "Task statuses" text last seeded from the Tasks plugin, persisted so
  // a seed that CHANGED between sessions can be told apart from one that was
  // merely re-read. See `updateSeededTaskStatuses`.
  private seededTaskStatusesText = "";
  // The part of the TaskNotes plugin's settings this plugin reads, as it was
  // the last time TaskNotes was running (the shape `exportTaskNotesSettings`
  // writes). Persisted so that a session or a device without TaskNotes reads
  // task notes the same way. See `updateKnownTaskNotesSettings`.
  private knownTaskNotes: Record<string, unknown> | null = null;
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
    // Install this (the plugin's real) Settings instance as the process-wide
    // reminder-format config. Must run exactly once, here, for the real
    // instance only — see `Settings.wireReminderFormatConfig()`.
    this._settings.wireReminderFormatConfig();
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

  /**
   * Records the "Task statuses" text seeded from the Tasks plugin this
   * session, and forces a rescan when it differs from the previous session's.
   *
   * The seed lands in a module variable rather than a `SettingModel`, so it
   * never takes the TAG_RESCAN path — and `doLoad` restores stored reminders
   * with `done` hardcoded to `false` instead of re-parsing. Without this, a
   * reminder classified under the OLD statuses (say a `[v]` line stored as
   * active before `[v]` meant DONE) survives in data.json and pops up once
   * per session until a manual Scan.
   */
  updateSeededTaskStatuses(text: string) {
    if (this.seededTaskStatusesText === text) {
      return;
    }
    this.seededTaskStatusesText = text;
    this.scanned.value = false;
    this.changed = true;
  }

  /** The TaskNotes settings last seen, or null when there were none. */
  get knownTaskNotesSettings(): Record<string, unknown> | null {
    return this.knownTaskNotes;
  }

  /**
   * Records what the running TaskNotes plugin says about its task notes.
   * When that differs from what was known, stored reminders may have been
   * read under other property names, so a rescan is forced -- but only while
   * TaskNotes reminders are read at all.
   */
  updateKnownTaskNotesSettings(settings: Record<string, unknown>) {
    if (JSON.stringify(this.knownTaskNotes) === JSON.stringify(settings)) {
      return;
    }
    this.knownTaskNotes = settings;
    if (this.settings.taskNotesEnabled.value) {
      this.scanned.value = false;
    }
    this.changed = true;
  }

  async load() {
    try {
      await this.doLoad();
    } finally {
      // Resolve even when loading failed, so that a scan waiting on
      // `loaded` isn't blocked forever.
      this.resolveLoaded();
    }
  }

  private async doLoad() {
    console.debug("Load reminder plugin data");
    // `loadData()` returns data of unknown shape (it's whatever was
    // previously passed to `saveData()`), so this cast is a minimal, trusted
    // bridge between the untyped persistence API and our persisted data shape.
    const data = (await this.store.loadData()) as
      | {
          scanned: boolean;
          seededTaskStatuses?: string;
          taskNotesSettings?: unknown;
          debug?: boolean;
          dndUntil?: number | null;
          settings?: Record<string, unknown>;
          reminders?: Record<string, Array<ReminderData>>;
          noteReminders?: Record<string, Array<NoteReminderData>>;
        }
      | undefined;
    if (!data) {
      this.scanned.value = false;
      return;
    }
    this.scanned.value = data.scanned;
    this.seededTaskStatusesText = data.seededTaskStatuses ?? "";
    const known = data.taskNotesSettings;
    this.knownTaskNotes =
      typeof known === "object" && known !== null && !Array.isArray(known)
        ? (known as Record<string, unknown>)
        : null;
    if (data.debug != null) {
      this.debug.value = data.debug;
    }
    this.dndUntil.value =
      data.dndUntil != null ? DateTime.ofEpochMillis(data.dndUntil) : null;

    this.settings.forEach((setting) => {
      setting.load(data.settings);
    });

    // Settings are restored just above, so the toggle already holds the
    // persisted value here. Dropping the mute flags at restore time (rather
    // than unmuting later) means a subsequent `Reminders.replaceFile()` has
    // nothing to carry over.
    const restoreMuted = !this.settings.reNotifyMutedOnStartup.value;

    const remindersData = data.reminders ?? {};
    const noteRemindersData = data.noteReminders ?? {};
    const filePaths = new Set([
      ...Object.keys(remindersData),
      ...Object.keys(noteRemindersData),
    ]);
    filePaths.forEach((filePath) => {
      // Both kinds go into one `replaceFile()` call, because that call
      // replaces everything stored for the file.
      const restored: Array<Reminder> = [];
      for (const d of remindersData[filePath] ?? []) {
        const reminder = Reminder.ofLine(
          filePath,
          d.title,
          DateTime.parse(d.time),
          d.rowNumber,
          false,
        );
        reminder.muteNotification = restoreMuted && (d.muted ?? false);
        restored.push(reminder);
      }
      for (const d of noteRemindersData[filePath] ?? []) {
        const reminder = Reminder.ofNote(
          filePath,
          d.title,
          DateTime.parse(d.time),
          { kind: "note", format: d.format, key: d.key, label: d.label },
        );
        reminder.muteNotification = restoreMuted && (d.muted ?? false);
        restored.push(reminder);
      }
      if (restored.length > 0) {
        this.reminders.replaceFile(filePath, restored);
      }
    });
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
    const remindersData: Record<string, Array<ReminderData>> = {};
    const noteRemindersData: Record<string, Array<NoteReminderData>> = {};
    this.reminders.fileToReminders.forEach((r, filePath) => {
      const lines: Array<ReminderData> = [];
      const notes: Array<NoteReminderData> = [];
      for (const rr of r) {
        const origin = rr.origin;
        if (origin.kind === "line") {
          lines.push({
            title: rr.title,
            time: rr.time.toString(),
            rowNumber: origin.row,
            muted: rr.muteNotification,
          });
        } else {
          notes.push({
            title: rr.title,
            time: rr.time.toString(),
            muted: rr.muteNotification,
            format: origin.format,
            key: origin.key,
            label: origin.label,
          });
        }
      }
      if (lines.length > 0) {
        remindersData[filePath] = lines;
      }
      if (notes.length > 0) {
        noteRemindersData[filePath] = notes;
      }
    });
    const settings: Record<string, unknown> = {};
    this.settings.forEach((setting) => {
      setting.store(settings);
    });
    // Clear the flag before the write, not after it: a change that arrives
    // while the write is in flight has to stay flagged, or the next `save()`
    // would skip it and it would never reach the disk.
    this.changed = false;
    try {
      await this.store.saveData({
        scanned: this.scanned.value,
        seededTaskStatuses: this.seededTaskStatusesText,
        ...(this.knownTaskNotes != null
          ? { taskNotesSettings: this.knownTaskNotes }
          : {}),
        reminders: remindersData,
        noteReminders: noteRemindersData,
        debug: this.debug.value,
        dndUntil: this.dndUntil.value?.getTimeInMillis() ?? null,
        settings,
      });
    } catch (e) {
      // Nothing was written, so the state is still unsaved.
      this.changed = true;
      throw e;
    }
  }

  get settings() {
    return this._settings;
  }
}
