import { AbstractPluginDataHolder } from 'data';
import { GoogleAuthClient } from '../google-api/client';
import type { GoogleApiFeature } from '../google-api/feature';
import { AbstractGoogleFeature } from '../sync-base/google';
import { GoogleCalendar, GoogleCalendarClient, GoogleCalendarEvent } from './client';
import { GoogleCalendarSynchronizer } from './synchronizer';

type GoogleCalendarData = {
    calendarId: string;
};

class GoogleCalendarDataHolder extends AbstractPluginDataHolder<GoogleCalendarData> {
    constructor() {
        super('googleCalendar', {
            calendarId: '',
        });
    }
    get calendarId() {
        return this.data.calendarId;
    }
    set calendarId(s: string) {
        this.data.calendarId = s;
        this.notifyChanged();
    }
}

export class GoogleCalendarFeature extends AbstractGoogleFeature<
    GoogleCalendarSynchronizer,
    GoogleCalendarDataHolder,
    GoogleCalendar
> {
    private googleCalendarClient: GoogleCalendarClient;

    constructor(googleApiFeature: GoogleApiFeature) {
        super(googleApiFeature, new GoogleCalendarDataHolder(), {
            serviceId: 'google-calendar',
            serviceName: 'Google Calendar',
            listName: 'calendar',
        });
        this.googleCalendarClient = new GoogleCalendarClient(googleApiFeature.googleAuthClient);
    }

    createSynchronizer(data: GoogleCalendarDataHolder): GoogleCalendarSynchronizer | null {
        if (data.calendarId.length === 0) {
            return null;
        }
        return new GoogleCalendarSynchronizer(this.googleCalendarClient, data.calendarId);
    }

    get scopes(): string[] {
        return [GoogleAuthClient.SCOPE_CALENDAR, GoogleAuthClient.SCOPE_CALENDAR_EVENTS];
    }

    getList(data: GoogleCalendarDataHolder): string {
        return data.calendarId;
    }
    resetList(data: GoogleCalendarDataHolder): void {
        data.calendarId = '';
    }
    setList(data: GoogleCalendarDataHolder, id: string): void {
        data.calendarId = id;
    }
    fetchList(): Promise<GoogleCalendar[]> {
        return this.googleCalendarClient.listCalendars();
    }
    getListName(list: GoogleCalendar): string {
        return list.summary;
    }
    getListId(list: GoogleCalendar): string {
        return list.id;
    }
    createList(name: string): Promise<string> {
        return this.googleCalendarClient.insertCalendar(name).then((resp) => resp.id);
    }
}
