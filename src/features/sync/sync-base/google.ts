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
            console.debug('Start synchronizer: feature=%s', this.featureName);
            this.reminderSynchronizerRegistration?.start(
                new CachingReminderSynchronizer(s, /* 1 hour */ 60 * 60 * 1000),
            );
        }
    }

    protected stopSynchronizer() {
        console.debug('Stop synchronizer: feature=%s', this.featureName);
        this.reminderSynchronizerRegistration?.stop();
    }

    override async init(plugin: Plugin): Promise<void> {
        this.reminderSynchronizerRegistration = plugin.pluginDataIO.registerSynchronizer<CachingReminderSynchronizer>();
        {
            const feature = this;
            this.googleApiFeature.addListener(
                new (class implements GoogleApiListener {
                    async onConnect(): Promise<void> {
                        feature.startSynchronizer();
                    }
                    async onDisconnect(): Promise<void> {
                        feature.resetList(feature.data);
                        feature.stopSynchronizer();
                    }
                    async onAuthCallback(state: string, scopes: string[]): Promise<void> {
                        if (state !== feature.featureName) {
                            return;
                        }
                        if (!feature.isScopesReady()) {
                            new Notice('Insufficient scopes');
                            return;
                        }
                        feature.selectOrCreateList(plugin);
                    }
                })(),
            );
        }

        plugin.pluginDataIO.register(this.data);
        plugin.addCommand({
            id: `synchronize-${this.options.serviceId}`,
            name: `Start ${this.options.serviceName} synchronization`,
            checkCallback: (checking: boolean): boolean | void => {
                const scopesReady = this.isScopesReady();
                if (checking) {
                    return true;
                }

                console.debug('Synchronize with %s', this.options.serviceName);
                if (!scopesReady) {
                    console.debug(
                        'Scopes are insufficient, opening auth url: feature=%s, requestedScopes=%o, currentScopes=%o',
                        this.featureName,
                        this.scopes,
                        this.googleApiFeature.googleAuthClient.scopes,
                    );
                    const requestingScopes = [...this.scopes];
                    for (const scope of this.googleApiFeature.googleAuthClient.scopes) {
                        requestingScopes.push(scope);
                    }
                    this.googleApiFeature.openAuthUrl(this.featureName, ...requestingScopes);
                    return;
                }

                console.debug('Select or create list');
                this.selectOrCreateList(plugin);
            },
        });
        plugin.addCommand({
            id: `synchronize-${this.options.serviceId}-stop`,
            name: `Stop ${this.options.serviceName} synchronization`,
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.reminderSynchronizerRegistration?.running;
                }

                console.debug('Stop synchronization: feature=%s', this.featureName);
                this.stopSynchronizer();
                this.resetList(this.data);
            },
        });
    }

    private selectOrCreateList(plugin: Plugin) {
        this.selectOrCreateListAsync(plugin).catch((e) => {
            new Notice(e);
        });
    }

    private async selectOrCreateListAsync(plugin: Plugin): Promise<void> {
        const selectOrCreate = await showSelectModal<'create' | 'select'>(['create', 'select'], {
            itemToString: (item: string) => {
                switch (item) {
                    case 'create':
                        return `Create a new ${this.options.listName} (Recommended)`;
                    case 'select':
                        return `Select an existing ${this.options.listName}`;
                }
                return '';
            },
            placeholder: `Select a method to choose the synchronization target ${this.options.listName}`,
        });

        let id: string | null;
        switch (selectOrCreate) {
            case 'create':
                const name = await showInputDialog(
                    `Create new ${this.options.listName}`,
                    `${this.options.listName} name`,
                );
                if (name != null) {
                    id = await this.createList(name);
                } else {
                    id = null;
                }
                break;
            case 'select':
                const taskLists = await this.fetchList();
                const selected = await showSelectModal<L>(taskLists, {
                    itemToString: (item) => this.getListName(item),
                    placeholder: `Select a ${this.options.listName} to be synchronized with reminders.  Cancel to create a new ${this.options.listName}`,
                });
                if (selected != null) {
                    id = this.getListId(selected);
                } else {
                    id = null;
                }
                break;
            default:
                id = null;
                break;
        }

        if (id == null) {
            new Notice(`Canceled synchronization of ${this.options.listName}.`);
            return;
        }

        this.setList(this.data, id);
        this.startSynchronizer();
        plugin.pluginDataIO.synchronizeReminders(true);
    }

    private isScopesReady() {
        const currentScopes = this.googleApiFeature.googleAuthClient.scopes;
        for (const scope of this.scopes) {
            if (!currentScopes.contains(scope)) {
                return false;
            }
        }
        return true;
    }

    private get featureName() {
        return this.constructor.name;
    }

    abstract createSynchronizer(data: D): S | null;

    abstract resetList(data: D): void;

    abstract setList(data: D, id: string): void;

    abstract getList(data: D): string;

    abstract fetchList(): Promise<Array<L>>;

    abstract getListName(list: L): string;

    abstract getListId(list: L): string;

    abstract createList(name: string): Promise<string>;

    abstract get scopes(): Array<string>;
}
