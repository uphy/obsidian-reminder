import type { GoogleAuthClient } from 'features/sync/google-api/client';

export type GoogleCalendar = {
    kind: 'calendar#calendarListEntry';
    etag: string;
    id: string;
    summary: string;
    description: string;
    location: string;
    timeZone: string;
    summaryOverride: string;
    colorId: string;
    backgroundColor: string;
    foregroundColor: string;
    hidden: boolean;
    selected: boolean;
    accessRole: string;
    defaultReminders: [
        {
            method: string;
            minutes: number;
        },
    ];
    notificationSettings: {
        notifications: [
            {
                type: string;
                method: string;
            },
        ];
    };
    primary: boolean;
    deleted: boolean;
    conferenceProperties: {
        allowedConferenceSolutionTypes: [string];
    };
};

type GoogleCalendarResponse = {
    kind: string;
    etag: string;
    nextPageToken: string;
    nextSyncToken: string;
    items: Array<GoogleCalendar>;
};

export type GoogleCalendarEventForInsert = {
    start: {
        date?: string;
        dateTime?: string;
        timeZone?: string;
    };
    end: {
        date?: string;
        dateTime?: string;
        timeZone?: string;
    };
    summary?: string;
    description?: string;
    reminders?: {
        useDefault: boolean;
        overrides: [
            {
                method: string;
                minutes: number;
            },
        ];
    };
    iCalUID?: string;
    extendedProperties?: {
        private?: any;
        shared?: any;
    };
};

export type GoogleCalendarEvent = {
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

type GoogleCalendarEventListResponse = {
    kind: 'calendar#events';
    etag: string;
    summary: string;
    description: string;
    updated: string;
    timeZone: string;
    accessRole: string;
    defaultReminders: [
        {
            method: string;
            minutes: number;
        },
    ];
    nextPageToken: string;
    nextSyncToken: string;
    items: Array<GoogleCalendarEvent>;
};

export type GenerateAuthorizationCodeFunc = (url: string) => Promise<string>;

export class GoogleCalendarClient {
    private static readonly BASE = 'https://www.googleapis.com/calendar/v3/calendars';
    private static readonly CALENDAR_LIST_BASE = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    constructor(private client: GoogleAuthClient) {}

    isReady() {
        return this.client.isReady();
    }

    async listCalendars(): Promise<Array<GoogleCalendar>> {
        return this.client
            .get(`${GoogleCalendarClient.CALENDAR_LIST_BASE}`)
            .then((resp) => (resp as GoogleCalendarResponse).items);
    }

    async insertCalendar(title: string): Promise<GoogleCalendar> {
        return this.client.post(GoogleCalendarClient.BASE, {
            summary: title,
        });
    }

    async insertEvent(calendarId: string, event: GoogleCalendarEventForInsert): Promise<GoogleCalendarEvent> {
        return await this.client.post(`${GoogleCalendarClient.BASE}/${calendarId}/events/`, event);
    }

    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
        await this.client.delete(`${GoogleCalendarClient.BASE}/${calendarId}/events/${eventId}`);
    }

    async listEvents(
        calendarId: string,
        maxResults = 100,
        pageToken?: string,
    ): Promise<GoogleCalendarEventListResponse> {
        const params = new Map<string, string>();
        params.set('maxResults', maxResults.toString());
        if (pageToken != null) {
            params.set('pageToken', pageToken);
        }
        return this.client.get(`${GoogleCalendarClient.BASE}/${calendarId}/events`, params);
    }
}
