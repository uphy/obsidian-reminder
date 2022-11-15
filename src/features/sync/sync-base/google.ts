import type { PluginDataHolder } from 'data';
import { Feature, Plugin } from 'features/feature';
import type { GoogleApiFeature, GoogleApiListener } from 'features/sync/google-api/feature';
import { Notice } from 'obsidian';
import { showInputDialog } from 'ui/input-modal';
import { showSelectModal } from 'ui/select-modal';
import type { ReminderSynchronizer, ReminderSynchronizerRegistration } from 'sync';
import { CachingReminderSynchronizer } from 'sync/cache';

type GoogleFeatureOptions = {
    serviceName: string;
    serviceId: string;
    listName: string;
};

/**
 * Abstract class commonizes Google Tasks and Google Calendar.
 */
export abstract class AbstractGoogleFeature<
    S extends ReminderSynchronizer,
    D extends PluginDataHolder,
    L,
> extends Feature {
    private reminderSynchronizerRegistration?: ReminderSynchronizerRegistration<CachingReminderSynchronizer>;

    constructor(private googleApiFeature: GoogleApiFeature, private data: D, private options: GoogleFeatureOptions) {
        super();
    }

    protected startSynchronizer() {
        const s = this.createSynchronizer(this.data);
        if (s != null) {
            this.reminderSynchronizerRegistration?.start(
                new CachingReminderSynchronizer(s, /* 1 hour */ 60 * 60 * 1000),
            );
        }
    }

    protected stopSynchronizer() {
        this.reminderSynchronizerRegistration?.stop();
    }

    override async init(plugin: Plugin): Promise<void> {
        this.reminderSynchronizerRegistration = plugin.pluginDataIO.registerSynchronizer<CachingReminderSynchronizer>();
        {
            const feature = this;
            this.googleApiFeature.addListener(
                new (class implements GoogleApiListener {
                    onConnect(): void {
                        feature.startSynchronizer();
                    }
                    onDisconnect(): void {
                        feature.resetList(feature.data);
                        feature.stopSynchronizer();
                    }
                })(),
            );
        }

        plugin.pluginDataIO.register(this.data);
        plugin.addCommand({
            id: `synchronize-${this.options.serviceId}-select`,
            name: `Start ${this.options.serviceName} synchronization - Select an existing ${this.options.listName} to synchronize`,
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleApiFeature.googleAuthClient.isReady();
                }
                this.selectTasklist()
                    .then((id) => {
                        if (id == null) {
                            new Notice(`Canceled to select ${this.options.listName}.`);
                            return;
                        }
                        this.setList(this.data, id);
                        this.startSynchronizer();
                        plugin.pluginDataIO.synchronizeReminders(true);
                    })
                    .catch((e) => {
                        new Notice(e);
                    });
            },
        });
        plugin.addCommand({
            id: `synchronize-${this.options.serviceId}-create`,
            name: `Start ${this.options.serviceName} synchronization - Create a ${this.options.serviceName} to synchronize`,
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleApiFeature.googleAuthClient.isReady();
                }

                this.createTasklist()
                    .then((id) => {
                        if (id == null) {
                            new Notice(`Canceled to create ${this.options.listName}.`);
                            return;
                        }
                        this.setList(this.data, id);
                        this.startSynchronizer();
                        plugin.pluginDataIO.synchronizeReminders(true);
                    })
                    .catch((e) => {
                        new Notice(e);
                    });
            },
        });
        plugin.addCommand({
            id: `synchronize-${this.options.serviceId}-stop`,
            name: `Stop ${this.options.serviceName} synchronization`,
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.reminderSynchronizerRegistration?.running;
                }

                this.stopSynchronizer();
                this.resetList(this.data);
            },
        });
    }

    private async selectTasklist(): Promise<string | null> {
        const taskLists = await this.fetchList();
        const selected = await showSelectModal(taskLists, {
            itemToString: (item) => this.getListName(item),
            placeHolder: `Select a ${this.options.listName} to be synchronized with reminders.`,
        });
        if (selected == null) {
            return null;
        }
        return this.getListId(selected);
    }

    private async createTasklist(): Promise<string | null> {
        const name = await showInputDialog(`Create new ${this.options.listName}`, `${this.options.listName} name`);
        if (name == null) {
            return null;
        }
        return await this.createList(name);
    }

    abstract createSynchronizer(data: D): S | null;

    abstract resetList(data: D): void;

    abstract setList(data: D, id: string): void;

    abstract fetchList(): Promise<Array<L>>;

    abstract getListName(list: L): string;

    abstract getListId(list: L): string;

    abstract createList(name: string): Promise<string>;
}
