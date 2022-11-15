import type { Reminder } from 'model/reminder';
import { DateTime, Time } from 'model/time';
import moment from 'moment';
import { ReminderSynchronizer, SnapshotReminder } from 'sync';
import type { GoogleCalendarClient, GoogleCalendarEventForInsert } from './client';

const extendedSharedProperty = {
    reminderEventMark: {
        key: 'app',
        value: 'obsidian-reminder-plugin',
    },
    reminderIdKey: 'reminder-id',
};

export class GoogleCalendarSynchronizer extends ReminderSynchronizer {
    constructor(private client: GoogleCalendarClient, private calendarId: string) {
        super();
    }

    get name(): string {
        return 'GoogleCalendar';
    }

    setupReady(): boolean {
        return this.client.isReady();
    }

    async snapshot(): Promise<SnapshotReminder[]> {
        const snapshot: Array<SnapshotReminder> = [];
        let nextPageToken: string | undefined;
        do {
            const resp = await this.client.listEvents(this.calendarId, 100, nextPageToken);
            const events = resp.items;
            if (events == null) {
                throw new Error('Cannot get events: ' + resp);
            }

            nextPageToken = resp.nextPageToken;
            snapshot.push(
                ...events
                    .map((event) => {
                        if (event.start == null) {
                            console.warn('Ignoring unexpected task is in calendar.  : %o', event);
                            return null;
                        }
                        if (
                            event.id == null ||
                            event.extendedProperties == null ||
                            event.extendedProperties.shared == null
                        ) {
                            console.debug('Ignoring non-managed event. : %o', event);
                            return null;
                        }
                        const reminderId: string | undefined =
                            event.extendedProperties.shared[extendedSharedProperty.reminderIdKey];
                        if (reminderId == null) {
                            console.debug('Ignoring non-managed event. : %o', event);
                            return null;
                        }
                        let dateTime: DateTime;
                        if (event.start.date != null) {
                            // e.g. 2021-10-19
                            dateTime = new DateTime(moment(event.start.date), false);
                        } else if (event.start.dateTime != null) {
                            // e.g. 2021-10-19T01:00:00Z
                            dateTime = new DateTime(moment(event.start.dateTime), true);
                        } else {
                            return null;
                        }

                        return {
                            id: reminderId,
                            eventId: event.id,
                            title: event.summary ?? '',
                            time: dateTime,
                        } as SnapshotReminder;
                    })
                    .filter((r: SnapshotReminder | null): r is SnapshotReminder => r != null),
            );
        } while (nextPageToken != null);
        return snapshot;
    }

    override async add(id: string, reminder: Reminder, defaultTime: Time): Promise<string> {
        if (id == null) {
            throw new Error(`event id == null: id=${id}, reminder=${reminder}, defaultTime=${defaultTime}`);
        }
        const resp = await this.client.insertEvent(this.calendarId, this.requestBody(id, reminder, defaultTime));
        return resp.id;
    }

    private requestBody(id: string, reminder: Reminder, defaultTime: Time): GoogleCalendarEventForInsert {
        const time = reminder.time
            .add(new Date().getTimezoneOffset(), 'minutes', defaultTime)
            .format('YYYY-MM-DD[T]HH:mm:ss[Z]', defaultTime);

        return {
            summary: reminder.title,
            description: `File: ${reminder.file}
Title: ${reminder.title}`,
            extendedProperties: {
                shared: {
                    [extendedSharedProperty.reminderEventMark.key]: extendedSharedProperty.reminderEventMark.value,
                    [extendedSharedProperty.reminderIdKey]: id,
                },
            },
            reminders: {
                overrides: [
                    {
                        method: 'popup',
                        minutes: 0,
                    },
                ],
                useDefault: false,
            },
            start: { dateTime: time },
            end: { dateTime: time },
        };
    }

    override async remove(id: string) {
        await this.client.deleteEvent(this.calendarId, id);
    }
}
