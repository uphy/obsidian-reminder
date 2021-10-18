import { Reference } from 'model/ref';
import { Reminder, Reminders } from 'model/reminder';
import { DateTime } from 'model/time';
import type { Plugin_2 } from 'obsidian';
import { SETTINGS, TAG_RESCAN } from 'settings';
import { ReminderSync, ReminderSynchronizer } from 'sync/sync';

interface ReminderData {
    title: string;
    time: string;
    rowNumber: number;
}
export class PluginDataIO {
    private restoring = true;
    private reminderSync = new ReminderSync();
    changed: boolean = false;
    public scanned: Reference<boolean> = new Reference(false);
    public debug: Reference<boolean> = new Reference(false);
    public googleApiRefreshToken: Reference<any> = new Reference(undefined);
    public googleCalendarId: Reference<string | undefined> = new Reference(undefined);

    constructor(private plugin: Plugin_2, private reminders: Reminders) {
        SETTINGS.forEach((setting) => {
            setting.rawValue.onChanged(() => {
                if (this.restoring) {
                    return;
                }
                if (setting.hasTag(TAG_RESCAN)) {
                    console.log(setting);
                    this.scanned.value = false;
                }
                this.changed = true;
            });
        });
        this.googleApiRefreshToken.onChanged(() => {
            this.changed = true;
        });
    }

    addReminderSynchronizer(s: ReminderSynchronizer) {
        this.reminderSync.addSynchronizer(s);
    }

    async load() {
        console.debug('Load reminder plugin data');
        const data = await this.plugin.loadData();
        if (!data) {
            this.scanned.value = false;
            return;
        }
        this.scanned.value = data.scanned;
        if (data.debug != null) {
            this.debug.value = data.debug;
        }
        if (data.googleApi != null) {
            this.googleApiRefreshToken.value = data.googleApi.refreshToken;
            this.googleCalendarId.value = data.googleApi.calendarId;
        }

        const loadedSettings = data.settings;
        SETTINGS.forEach((setting) => {
            setting.load(loadedSettings);
        });

        if (data.reminders) {
            Object.keys(data.reminders).forEach((filePath) => {
                const remindersInFile = data.reminders[filePath] as Array<ReminderData>;
                if (!remindersInFile) {
                    return;
                }
                this.reminders.replaceFile(
                    filePath,
                    remindersInFile.map(
                        (d) => new Reminder(filePath, d.title, DateTime.parse(d.time), d.rowNumber, false),
                    ),
                );
            });
        }
        this.changed = false;
        if (this.restoring) {
            this.restoring = false;
        }
    }

    async synchronizeRemindersIfNeeded() {
        this.reminderSync.synchronizeReminders(this.reminders, SETTINGS.reminderTime.value, false);
    }

    async save(force: boolean = false) {
        if (!force && !this.changed) {
            return;
        }
        if (this.changed) {
            this.reminderSync.invalidate();
        }
        console.debug('Save reminder plugin data: force=%s, changed=%s', force, this.changed);
        const remindersData: any = {};
        this.reminders.fileToReminders.forEach((r, filePath) => {
            remindersData[filePath] = r.map((rr) => ({
                title: rr.title,
                time: rr.time.toString(),
                rowNumber: rr.rowNumber,
            }));
        });
        const settings = {};
        SETTINGS.forEach((setting) => {
            setting.store(settings);
        });
        const googleApi: any = {};
        googleApi.calendarId = this.googleCalendarId.value;
        googleApi.refreshToken = this.googleApiRefreshToken.value;
        await this.plugin.saveData({
            scanned: this.scanned.value,
            reminders: remindersData,
            debug: this.debug.value,
            googleApi,
            settings,
        });
        this.changed = false;
    }
}
