import { TasksPluginSymbols } from 'model/format/reminder-tasks-plugin-symbols';
import { Reference } from 'model/ref';
import { Reminder, Reminders } from 'model/reminder';
import { DateTime } from 'model/time';
import type { Plugin_2 } from 'obsidian';
import { SETTINGS, TAG_RESCAN } from 'settings';
import type { ReminderSynchronizerManager, ReminderSynchronizer } from 'sync';

interface ReminderData {
    title: string;
    time: string;
    rowNumber: number;
}
export abstract class PluginDataHolder {
    public changed = false;
    abstract load(root: any): void;
    abstract save(root: any): void;
}

type OnChangeFunction<T> = (value: T) => {};

export abstract class AbstractPluginDataHolder<T> extends PluginDataHolder {
    protected data: T;
    private onChangeFunctions: Array<OnChangeFunction<T>> = [];
    constructor(private name: string, initData: T) {
        super();
        this.data = initData;
    }
    load(root: any): void {
        const d = root[this.name];
        if (d != null) {
            this.data = root[this.name] as T;
        }
    }
    save(root: any): void {
        root[this.name] = this.data;
    }
    onChange(f: OnChangeFunction<T>) {
        this.onChangeFunctions.push(f);
    }
    protected notifyChanged() {
        this.changed = true;
        this.onChangeFunctions.forEach((f) => {
            f(this.data);
        });
    }
}
export class PluginDataIO {
    private restoring = true;
    changed: boolean = false;

    // migrate to plugin data
    public scanned: Reference<boolean> = new Reference(false);
    public debug: Reference<boolean> = new Reference(false);

    private dataList: Array<PluginDataHolder> = [];
    private data: any;

    constructor(
        private plugin: Plugin_2,
        private reminders: Reminders,
        private reminderSynchronizerManager: ReminderSynchronizerManager,
    ) {
        SETTINGS.forEach((setting) => {
            setting.rawValue.onChanged(() => {
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

    register(holder: PluginDataHolder) {
        this.dataList.push(holder);
        if (this.data != null) {
            holder.load(this.data);
        }
    }

    registerSynchronizer<T extends ReminderSynchronizer>() {
        return this.reminderSynchronizerManager.register<T>();
    }

    anySynchronizersReady() {
        return this.reminderSynchronizerManager.anySynchronizersReady();
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

        const loadedSettings = data.settings;
        SETTINGS.forEach((setting) => {
            setting.load(loadedSettings);
        });
        this.migrateSettings();
        for (const d of this.dataList) {
            d.load(data);
        }

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
        this.data = data;
        this.changed = false;
        if (this.restoring) {
            this.restoring = false;
        }
    }

    private migrateSettings() {
        if (SETTINGS.useCustomEmojiForTasksPlugin.value) {
            SETTINGS.tasksPluginEmoji.rawValue.value = TasksPluginSymbols.reminder.primary;
            SETTINGS.useCustomEmojiForTasksPlugin.rawValue.value = false;
        }
    }

    async synchronizeReminders(force?: boolean) {
        this.reminderSynchronizerManager.synchronizeReminders(
            this.reminders,
            SETTINGS.reminderTime.value,
            force ?? false,
        );
    }

    isChanged(): boolean {
        if (this.changed) {
            return true;
        }
        for (const d of this.dataList) {
            if (d.changed) {
                return true;
            }
        }
        return false;
    }

    async save(force: boolean = false) {
        const changed = this.isChanged();
        if (!force && !changed) {
            return;
        }
        if (changed) {
            this.reminderSynchronizerManager.invalidate();
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
        const data = {
            scanned: this.scanned.value,
            reminders: remindersData,
            debug: this.debug.value,
            settings,
        };
        for (const d of this.dataList) {
            d.save(data);
        }
        await this.plugin.saveData(data);
        this.changed = false;
    }
}
