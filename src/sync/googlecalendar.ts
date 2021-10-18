import type { Reference } from 'model/ref';
import type { Reminder } from 'model/reminder';
import { DateTime, Time } from 'model/time';
import moment from 'moment';
import { RequestParam, request } from 'obsidian';
import { ReminderChange, ReminderChangeType, ReminderSynchronizer, SnapshotReminder } from './sync';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const GOOGLE_API_CLIENT_ID = 'xxx';
const GOOGLE_API_CLIENT_SECRET = 'xxx';
const GOOGLE_API_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const extendedSharedProperty = {
    reminderEventMark: {
        key: 'app',
        value: 'obsidian-reminder-plugin',
    },
    reminderIdKey: 'reminder-id',
};
export type GoogleApiAccessToken = {
    access_token: string;
    expiry_date: number;
    refresh_token: string;
    scope: string;
    token_type: string;
};

type GoogleCalendarEvent = {
    id: string;
    summary: string;
    description: string;
    start: {
        date: string;
        dateTime: string;
        timeZone: string;
    };
    end: {
        date: string;
        dateTime: string;
        timeZone: string;
    };
    iCalUID: string;
    extendedProperties: {
        private: any;
        shared: any;
    };
};

export type GenerateAuthorizationCodeFunc = (url: string) => Promise<string>;

export class GoogleCalendarClient extends ReminderSynchronizer {
    private accessToken?: string;

    constructor(private refreshToken: Reference<any>, private calendarId: Reference<string | undefined>) {
        super();
    }

    setupReady() {
        return this.refreshToken.value != null && this.calendarId.value != null && this.calendarId.value.length > 0;
    }

    async restoreAuthorization(): Promise<boolean> {
        if (this.refreshToken.value != null && this.calendarId.value != null) {
            try {
                await this.generateAccessToken(this.refreshToken.value);
                return true;
            } catch (e) {
                console.error('Failed to generate access token', e);
                this.disconnect();
                return false;
            }
        }
        return false;
    }

    generateAuthUrl(): string {
        const scopes = window.encodeURIComponent(SCOPES.join(' '));
        return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_API_CLIENT_ID}&redirect_uri=${GOOGLE_API_REDIRECT_URI}&scope=${scopes}&access_type=offline`;
    }

    private async httpRequest(requestParam: RequestParam): Promise<any> {
        if (this.accessToken != null) {
            if (requestParam.headers == null) {
                requestParam.headers = {};
            }
            requestParam.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        const resp = await request(requestParam);
        const body = JSON.parse(resp);
        const error = body['error'];
        if (error) {
            throw new Error('failed to request:' + resp);
        }
        return body;
    }

    async authorize(code: string, calendarId: string) {
        const resp = await this.httpRequest({
            url: 'https://www.googleapis.com/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code,
                client_id: GOOGLE_API_CLIENT_ID,
                client_secret: GOOGLE_API_CLIENT_SECRET,
                redirect_uri: GOOGLE_API_REDIRECT_URI,
                grant_type: 'authorization_code',
                access_type: 'offline',
            }),
        });
        const refreshToken = resp['refresh_token'];
        if (refreshToken == null) {
            throw new Error('Cannot get refresh token.');
        }
        await this.generateAccessToken(refreshToken);

        this.refreshToken.value = refreshToken;
        this.calendarId.value = calendarId;
    }

    private async generateAccessToken(refreshToken: string) {
        const resp = await this.httpRequest({
            url: 'https://www.googleapis.com/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: refreshToken,
                client_id: GOOGLE_API_CLIENT_ID,
                client_secret: GOOGLE_API_CLIENT_SECRET,
                grant_type: 'refresh_token',
                access_type: 'offline',
            }),
        });
        const accessToken = resp['access_token'];
        if (accessToken == null) {
            throw new Error(
                'Access Token cannot be generated from refresh token.  Maybe the refresh token is invalid or expired.',
            );
        }
        this.accessToken = accessToken;

        if (!(await this.verify())) {
            throw new Error('Access token was generated but not be verified.');
        }
    }

    private async verify(): Promise<boolean> {
        try {
            const resp = await this.httpRequest({
                url: `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId.value}/events?maxResults=1`,
                method: 'GET',
            });
            const events = resp['items'];
            if (events == null) {
                return false;
            }
            return true;
        } catch (ex) {
            return false;
        }
    }

    async snapshot(): Promise<SnapshotReminder[]> {
        console.debug('Get all google calendar events');
        const snapshot: Array<SnapshotReminder> = [];
        let nextPageToken: string | null | undefined;
        do {
            let url: string;
            if (nextPageToken == null) {
                url = `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId.value}/events?maxResults=100`;
            } else {
                url = `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId.value}/events?maxResults=100&pageToken=${nextPageToken}`;
            }
            const resp = await this.httpRequest({ url, method: 'GET' });
            const events = resp['items'] as Array<GoogleCalendarEvent>;
            if (events == null) {
                throw new Error('Cannot get events: ' + resp);
            }

            nextPageToken = resp['nextPageToken'];
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
                            console.info('Ignoring non-managed event. : %o', event);
                            return null;
                        }
                        const reminderId: string | undefined =
                            event.extendedProperties.shared[extendedSharedProperty.reminderIdKey];
                        if (reminderId == null) {
                            console.info('Ignoring non-managed event. : %o', event);
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

    async applyChanges(changes: ReminderChange[], defaultTime: Time): Promise<void> {
        for (const change of changes) {
            switch (change.changeType) {
                case ReminderChangeType.ADD:
                    // For caching "snapshot()" result, we have to get eventId here.
                    change.eventId = await this.add(change.id, change.reminder!, defaultTime);
                    break;
                case ReminderChangeType.REMOVE:
                    await this.remove(change.eventId!);
                    break;
            }
        }
    }

    private async add(id: string, reminder: Reminder, defaultTime: Time) {
        if (id == null) {
            console.error('event id == null: id=%s, reminder=%o, defaultTime=%o', id, reminder, defaultTime);
            return;
        }
        console.debug('Add event to google calendar: id=%s, reminder=%o, defaultTime=%s', id, reminder, defaultTime);
        const resp = await this.httpRequest({
            url: `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId.value}/events/`,
            method: 'POST',
            body: JSON.stringify(this.requestBody(id, reminder, defaultTime)),
        });
        return resp.id;
    }

    private requestBody(id: string, reminder: Reminder, defaultTime: Time) {
        const time = reminder.time
            .add(new Date().getTimezoneOffset(), 'minutes', defaultTime)
            .format('YYYY-MM-DD[T]HH:mm:ss[Z]', defaultTime);

        return {
            summary: reminder.title,
            description: `<h1>Reminder</h1>

<h2>Info</h2>
<ul>
<li>File: ${reminder.file}</li>
<li>Title: ${reminder.title}</li>
</ul>
<h2>Actions</h2>
<ul>
<li><a href="obsidian://show-reminder?file=${window.encodeURIComponent(
                reminder.file,
            )}&title=${window.encodeURIComponent(reminder.title)}">Open the reminder</a></li>
</ul>
obsidian://show-reminder?file=${window.encodeURIComponent(reminder.file)}&title=${window.encodeURIComponent(
                reminder.title,
            )}
`,
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

    private async remove(id: string) {
        console.debug('Remove event from google calendar: id=%s', id);
        try {
            await this.httpRequest({
                url: `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId.value}/events/${id}`,
                method: 'DELETE',
            });
        } catch (ex) {
            if (ex == null) {
                // Ignore.
                // According to the Google Calendar API, this returns empty string.
                // The content type is `text/html`.
                // Obsidian doesn't appear to be able to process it.
            }
        }
    }

    disconnect() {
        this.calendarId.value = undefined;
        this.refreshToken.value = undefined;
    }
}
