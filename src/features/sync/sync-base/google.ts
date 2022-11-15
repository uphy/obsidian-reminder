import type { PluginDataHolder } from 'data';
import { Feature, Plugin } from 'features/feature';
import type { GoogleApiFeature, GoogleApiListener } from 'features/sync/google-api/feature';
import { Notice } from 'obsidian';
import { showInputDialog } from 'ui/input-modal';
import { showSelectModal } from 'ui/select-modal';
import type { ReminderSynchronizer, ReminderSynchronizerRegistration } from 'sync';

type GoogleFeatureOptions = {
    synchronizeCommand: {
        id: string;
        name: string;
    };
    selectTaskList: {
        listName: string;
    };
};

/**
 * Abstract class commonizes Google Tasks and Google Calendar.
 */
export abstract class AbstractGoogleFeature<
    S extends ReminderSynchronizer,
    D extends PluginDataHolder,
    L,
> extends Feature {
    private reminderSynchronizerRegistration?: ReminderSynchronizerRegistration<S>;

    constructor(private googleApiFeature: GoogleApiFeature, private data: D, private options: GoogleFeatureOptions) {
        super();
    }

    protected startSynchronizer() {
        this.reminderSynchronizerRegistration?.start(this.createSynchronizer(this.data));
    }

    protected stopSynchronizer() {
        this.reminderSynchronizerRegistration?.stop();
    }

    override async init(plugin: Plugin): Promise<void> {
        this.reminderSynchronizerRegistration = plugin.pluginDataIO.registerSynchronizer<S>();
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
            id: this.options.synchronizeCommand.id,
            name: this.options.synchronizeCommand.name,
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleApiFeature.googleAuthClient.isReady();
                }
                this.selectTasklist()
                    .then((id) => {
                        this.setList(this.data, id);
                        this.startSynchronizer();
                    })
                    .catch((e) => {
                        new Notice(e);
                    });
            },
        });
    }

    private async selectTasklist(): Promise<string> {
        const taskLists = await this.fetchList();
        const selected = await showSelectModal(taskLists, {
            itemToString: (item) => this.getListName(item),
            placeHolder: `Select a ${this.options.selectTaskList.listName} to be synchronized with reminders.  Cancel to create new tasklist.`,
        });
        if (selected != null) {
            return this.getListId(selected);
        } else {
            const name = await showInputDialog();
            return await this.createList(name);
        }
    }

    abstract createSynchronizer(data: D): S;

    abstract resetList(data: D): void;

    abstract setList(data: D, id: string): void;

    abstract fetchList(): Promise<Array<L>>;

    abstract getListName(list: L): string;

    abstract getListId(list: L): string;

    abstract createList(name: string): Promise<string>;
}
