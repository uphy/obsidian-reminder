import { DateTime } from "model/time";

export type TaskNotesReminderStateKind = "done" | "snoozed" | "muted";

export interface TaskNotesReminderStateEntry {
  trigger: number;
  kind: TaskNotesReminderStateKind;
  until?: number;
}

export type TaskNotesReminderStateMap = Record<
  string,
  TaskNotesReminderStateEntry
>;

export class TaskNotesReminderState {
  constructor(private entries: TaskNotesReminderStateMap) {}

  get(
    path: string,
    reminderId: string,
    trigger: DateTime,
  ): TaskNotesReminderStateEntry | undefined {
    const key = this.key(path, reminderId);
    const entry = this.entries[key];
    if (!entry) {
      return undefined;
    }
    if (entry.trigger !== trigger.getTimeInMillis()) {
      delete this.entries[key];
      return undefined;
    }
    return entry;
  }

  effectiveTime(path: string, reminderId: string, trigger: DateTime): DateTime {
    const entry = this.get(path, reminderId, trigger);
    return DateTime.ofEpochMillis(entry?.until ?? trigger.getTimeInMillis());
  }

  set(
    path: string,
    reminderId: string,
    trigger: DateTime,
    kind: TaskNotesReminderStateKind,
    until?: DateTime,
  ): void {
    const key = this.key(path, reminderId);
    const entry: TaskNotesReminderStateEntry = {
      trigger: trigger.getTimeInMillis(),
      kind,
    };
    if (until) {
      entry.until = until.getTimeInMillis();
    }
    this.entries[key] = entry;
  }

  hasFile(path: string): boolean {
    const prefix = `${path}::`;
    return Object.keys(this.entries).some((key) => key.startsWith(prefix));
  }

  migratePath(oldPath: string, newPath: string): number {
    const oldPrefix = `${oldPath}::`;
    const oldKeys = Object.keys(this.entries).filter((key) =>
      key.startsWith(oldPrefix),
    );
    oldKeys.forEach((key) => {
      const newKey = `${newPath}::${key.slice(oldPrefix.length)}`;
      if (!this.entries[newKey]) {
        this.entries[newKey] = this.entries[key]!;
      }
      delete this.entries[key];
    });
    return oldKeys.length;
  }

  prune(now: DateTime, ignoreOlderThanDays: number): number {
    const threshold = now
      .add(-Math.max(0, ignoreOlderThanDays), "days")
      .getTimeInMillis();
    let removed = 0;
    Object.entries(this.entries).forEach(([key, entry]) => {
      const effectiveTime =
        entry.kind === "snoozed"
          ? (entry.until ?? entry.trigger)
          : entry.trigger;
      if (effectiveTime < threshold) {
        delete this.entries[key];
        removed++;
      }
    });
    return removed;
  }

  removeFile(path: string): number {
    const prefix = `${path}::`;
    let removed = 0;
    Object.keys(this.entries)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => {
        delete this.entries[key];
        removed++;
      });
    return removed;
  }

  clearMuted(): number {
    let removed = 0;
    Object.entries(this.entries).forEach(([key, entry]) => {
      if (entry.kind === "muted") {
        delete this.entries[key];
        removed++;
      }
    });
    return removed;
  }

  private key(path: string, reminderId: string): string {
    return `${path}::${reminderId}`;
  }
}
