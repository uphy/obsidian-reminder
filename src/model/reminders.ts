import type { ReadOnlyReference } from "model/ref";
import { DateTime, Time } from "model/time";
import type { Reminder } from "./reminder";

export class Reminders {
  public fileToReminders: Map<string, Array<Reminder>> = new Map();
  public reminders: Array<Reminder> = [];
  public reminderTime?: ReadOnlyReference<Time>;

  constructor(private onChange: () => void) {}

  public getExpiredReminders(defaultTime: Time): Array<Reminder> {
    const now = new Date().getTime();
    const result: Array<Reminder> = [];
    for (let i = 0; i < this.reminders.length; i++) {
      const reminder = this.reminders[i]!;
      if (reminder.isExpired(now, defaultTime)) {
        result.push(reminder);
      } else {
        break;
      }
    }
    return result;
  }

  /**
   * Mutes every currently expired reminder (bulk mute, #220), so the
   * notification storm after a long absence can be stopped in one action.
   * Mirrors the single-reminder mute path: it only flips `muteNotification`
   * and does not call `onChange()`, leaving UI reload to the caller.
   *
   * @returns the number of reminders that were newly muted (already-muted
   * expired reminders don't count).
   */
  public muteExpiredReminders(defaultTime: Time): number {
    let count = 0;
    for (const reminder of this.getExpiredReminders(defaultTime)) {
      if (!reminder.muteNotification) {
        reminder.muteNotification = true;
        count++;
      }
    }
    return count;
  }

  public byDate(date: DateTime) {
    return this.reminders.filter(
      (reminder) => reminder.effectiveTime.toYYYYMMDD() === date.toYYYYMMDD(),
    );
  }

  public removeReminder(reminder: Reminder) {
    console.debug("Remove reminder: %o", reminder);
    this.reminders.remove(reminder);
    const file = this.fileToReminders.get(reminder.file);
    if (file) {
      file.remove(reminder);
      if (file.length === 0) {
        this.fileToReminders.delete(reminder.file);
      }
    }
    this.onChange();
  }

  public clear() {
    this.fileToReminders.clear();
    this.reminders = [];
    this.onChange();
  }

  public clearSource(source: Reminder["source"]): boolean {
    let changed = false;
    for (const [filePath, reminders] of this.fileToReminders.entries()) {
      const retained = reminders.filter(
        (reminder) => reminder.source !== source,
      );
      if (retained.length !== reminders.length) {
        changed = true;
        if (retained.length === 0) {
          this.fileToReminders.delete(filePath);
        } else {
          this.fileToReminders.set(filePath, retained);
        }
      }
    }
    if (changed) {
      this.sortReminders();
    }
    return changed;
  }

  public removeByFile(filePath: string) {
    if (this.fileToReminders.delete(filePath)) {
      this.sortReminders();
      return true;
    }
    return false;
  }

  public removeSourceFile(
    filePath: string,
    source: Reminder["source"],
  ): boolean {
    const current = this.fileToReminders.get(filePath);
    if (!current) {
      return false;
    }
    const retained = current.filter((reminder) => reminder.source !== source);
    if (retained.length === current.length) {
      return false;
    }
    if (retained.length === 0) {
      this.fileToReminders.delete(filePath);
    } else {
      this.fileToReminders.set(filePath, retained);
    }
    this.sortReminders();
    return true;
  }

  public hasSourceFile(filePath: string, source: Reminder["source"]): boolean {
    return (
      this.fileToReminders
        .get(filePath)
        ?.some((reminder) => reminder.source === source) ?? false
    );
  }

  public replaceSourceFile(
    filePath: string,
    source: Reminder["source"],
    reminders: Array<Reminder>,
  ): boolean {
    if (!this.replaceSourceFileInMap(filePath, source, reminders)) {
      return false;
    }
    this.sortReminders();
    return true;
  }

  /**
   * Replaces the complete set of files for a reminder source in one update.
   * Paths omitted from `files` have their reminders for `source` removed.
   */
  public replaceSourceFiles(
    source: Reminder["source"],
    files: Map<string, Array<Reminder>>,
  ): boolean {
    const filePaths = new Set([
      ...this.fileToReminders.keys(),
      ...files.keys(),
    ]);
    let changed = false;
    filePaths.forEach((filePath) => {
      if (
        this.replaceSourceFileInMap(filePath, source, files.get(filePath) ?? [])
      ) {
        changed = true;
      }
    });
    if (changed) {
      this.sortReminders();
    }
    return changed;
  }

  private replaceSourceFileInMap(
    filePath: string,
    source: Reminder["source"],
    reminders: Array<Reminder>,
  ): boolean {
    const current = this.fileToReminders.get(filePath) ?? [];
    const oldByKey = new Map(
      current
        .filter((reminder) => reminder.source === source)
        .map((reminder) => [reminder.key(), reminder]),
    );
    for (const reminder of reminders) {
      const old = oldByKey.get(reminder.key());
      if (old?.time.equals(reminder.time)) {
        reminder.muteNotification = old.muteNotification;
      }
    }
    const retained = current.filter((reminder) => reminder.source !== source);
    const replacement = [...retained, ...reminders];
    if (this.equals(current, replacement)) {
      return false;
    }
    if (replacement.length === 0) {
      this.fileToReminders.delete(filePath);
    } else {
      this.fileToReminders.set(filePath, replacement);
    }
    return true;
  }

  public migrateSourceFile(
    oldPath: string,
    newPath: string,
    source: Reminder["source"],
  ): boolean {
    const oldFile = this.fileToReminders.get(oldPath);
    if (!oldFile) {
      return false;
    }
    const moved = oldFile.filter((reminder) => reminder.source === source);
    if (moved.length === 0) {
      return false;
    }
    const retained = oldFile.filter((reminder) => reminder.source !== source);
    if (retained.length === 0) {
      this.fileToReminders.delete(oldPath);
    } else {
      this.fileToReminders.set(oldPath, retained);
    }
    moved.forEach((reminder) => {
      reminder.file = newPath;
    });
    const destination = this.fileToReminders.get(newPath) ?? [];
    const destinationRetained = destination.filter(
      (reminder) => reminder.source !== source,
    );
    this.fileToReminders.set(newPath, [...destinationRetained, ...moved]);
    this.sortReminders();
    return true;
  }

  public resort(): void {
    this.sortReminders();
  }

  public replaceFile(filePath: string, reminders: Array<Reminder>): boolean {
    // migrate muteNotification property
    const oldReminders = this.fileToReminders.get(filePath);
    if (oldReminders) {
      if (this.equals(oldReminders, reminders)) {
        return false;
      }
      const keyToMuteNotification = new Map<string, boolean>();
      for (const reminder of oldReminders) {
        keyToMuteNotification.set(reminder.key(), reminder.muteNotification);
      }
      for (const reminder of reminders) {
        const mute = keyToMuteNotification.get(reminder.key());
        keyToMuteNotification.set(reminder.key(), reminder.muteNotification);
        if (mute !== undefined) {
          reminder.muteNotification = mute;
        }
      }
    }
    // update
    this.fileToReminders.set(filePath, reminders);
    this.sortReminders();
    return true;
  }

  private equals(r1: Array<Reminder>, r2: Array<Reminder>) {
    if (r1.length !== r2.length) {
      return false;
    }
    // Sort copies so we don't mutate the arrays passed in (r1 may be the
    // array stored inside fileToReminders, and an equality check must not
    // change stored state).
    const sorted1 = [...r1];
    const sorted2 = [...r2];
    this.sort(sorted1);
    this.sort(sorted2);
    return sorted1.every((a, i) => a.equals(sorted2[i]!));
  }

  private sortReminders() {
    const reminders: Array<Reminder> = [];

    for (const r of this.fileToReminders.values()) {
      reminders.push(...r);
    }

    this.sort(reminders);
    this.reminders = reminders;
    this.onChange();
  }

  private sort(reminders: Array<Reminder>) {
    reminders.sort((a, b) => {
      const d =
        a.effectiveTime.getTimeInMillis(this.reminderTime?.value) -
        b.effectiveTime.getTimeInMillis(this.reminderTime?.value);
      return d > 0 ? 1 : d < 0 ? -1 : 0;
    });
  }
}
