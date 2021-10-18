import type { Reminder } from 'model/reminder';
import { DateTime, Time } from 'model/time';
import moment from 'moment';
import { ReminderStatus, ReminderSynchronizer, SnapshotReminder } from 'sync';
import { GoogleTasksApi, GoogleTasksStatus } from './client';

class GoogleTaskNote {
    static parse(note: string): GoogleTaskNote | null {
        const map = new Map();
        for (const line of note.split('\n')) {
            const i = line.indexOf(':');
            if (i > 0) {
                const key = line.substring(0, i).trim();
                const value = line.substring(i + 1).trim();
                map.set(key, value);
            }
        }
        const file = map.get('File');
        const id = map.get('ID');
        const time = map.get('Time');
        if (file == null || id == null) {
            return null;
        }
        return new GoogleTaskNote(file, id);
    }
    constructor(public file: string, public id: string, public time?: string) {}
    toString(): string {
        if (this.time == null) {
            return `File: ${this.file}\nID: ${this.id}`;
        } else {
            return `File: ${this.file}\nTime: ${this.time}\nID: ${this.id}`;
        }
    }
}

export class GoogleTasksSynchronizer extends ReminderSynchronizer {
    constructor(private client: GoogleTasksApi, private taskListId: string) {
        super();
    }
    setupReady(): boolean {
        return this.client.isReady();
    }
    async snapshot(): Promise<SnapshotReminder[]> {
        const tasks = await this.client.fetchAllTasks(this.taskListId);
        return tasks
            .map((task) => {
                if (task.notes == null) {
                    return null;
                }
                const notes = GoogleTaskNote.parse(task.notes);
                if (notes == null) {
                    return null;
                }
                let status: ReminderStatus;
                switch (task.status) {
                    case GoogleTasksStatus.NEEDS_ACTION:
                        status = ReminderStatus.TODO;
                        break;
                    case GoogleTasksStatus.COMPLETED:
                        status = ReminderStatus.DONE;
                        break;
                    default:
                        status = ReminderStatus.UNKNOWN;
                }
                return {
                    id: notes.id,
                    eventId: task.id,
                    title: task.title,
                    time: new DateTime(moment(task.due), true),
                    status,
                } as SnapshotReminder;
            })
            .filter((r): r is SnapshotReminder => r !== null);
    }

    override async add(id: string, reminder: Reminder, defaultTime: Time): Promise<string> {
        let time: string | undefined;
        if (reminder.time.hasTimePart) {
            time = reminder.time.format('HH:mm');
        } else {
            time = defaultTime.toString();
        }
        const created = await this.client.createTask(this.taskListId, {
            title: reminder.title,
            due: reminder.time.fixedTime(defaultTime).format(),
            notes: new GoogleTaskNote(reminder.getFileName(), id, time).toString(),
        } as any);
        return created.id;
    }

    override async remove(externalId: string): Promise<void> {
        await this.client.deleteTask(this.taskListId, externalId);
    }
}
