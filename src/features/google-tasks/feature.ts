import { AbstractPluginDataHolder, PluginDataHolder } from 'data';
import { Feature, FeatureId, Plugin } from 'features/feature';
import type { GoogleApiFeature, GoogleApiListener } from 'features/google-api/feature';
import { Notice } from 'obsidian';
import { GoogleTasksApi } from './client';
import { showInputDialog } from 'ui/input-modal';
import { showSelectModal } from 'ui/select-modal';
import { GoogleTasksSynchronizer } from './synchronizer';
import type { ReminderSynchronizerRegistration } from 'sync';

type GoogleTasksData = {
    taskListId: string;
};

class GoogleTasksDataHolder extends AbstractPluginDataHolder<GoogleTasksData> {
    constructor() {
        super('googleTasks', {
            taskListId: '',
        });
    }
    get taskListId() {
        return this.data.taskListId;
    }
    set taskListId(s: string) {
        this.data.taskListId = s;
        this.notifyChanged();
    }
}

export class GoogleTasksFeature extends Feature {
    private googleTasksApi: GoogleTasksApi;
    private googleTasksData = new GoogleTasksDataHolder();
    private reminderSynchronizerRegistration?: ReminderSynchronizerRegistration<GoogleTasksSynchronizer>;

    constructor(private googleApiFeature: GoogleApiFeature) {
        super();
        this.googleTasksApi = new GoogleTasksApi(googleApiFeature.googleAuthClient);
    }

    get featureId(): FeatureId {
        return FeatureId.GoogleTasks;
    }

    private startSynchronizer() {
        this.reminderSynchronizerRegistration?.start(
            new GoogleTasksSynchronizer(this.googleTasksApi, this.googleTasksData.taskListId),
        );
    }
    private stopSynchronizer() {
        this.reminderSynchronizerRegistration?.stop();
    }

    override async init(plugin: Plugin): Promise<void> {
        this.reminderSynchronizerRegistration = plugin.pluginDataIO.registerSynchronizer<GoogleTasksSynchronizer>();
        {
            const feature = this;
            this.googleApiFeature.addListener(
                new (class implements GoogleApiListener {
                    onConnect(): void {
                        feature.startSynchronizer();
                    }
                    onDisconnect(): void {
                        feature.googleTasksData.taskListId = '';
                        feature.stopSynchronizer();
                    }
                })(),
            );
        }

        plugin.pluginDataIO.register(this.googleTasksData);
        plugin.addCommand({
            id: 'synchronize-google-tasklist',
            name: 'Synchronize with Google Tasks',
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleApiFeature.googleAuthClient.isReady();
                }
                this.selectTasklist()
                    .then((id) => {
                        this.googleTasksData.taskListId = id;
                        this.startSynchronizer();
                    })
                    .catch((e) => {
                        new Notice(e);
                    });
            },
        });
        plugin.addCommand({
            id: 'synchronize-reminders-force',
            name: 'Forcibly synchronize reminders to external services',
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return plugin.pluginDataIO.anySynchronizersReady();
                }
                plugin.pluginDataIO
                    .synchronizeReminders(true)
                    .then(() => {
                        new Notice('Successfully synchronized.');
                    })
                    .catch((e) => {
                        new Notice(e);
                    });
            },
        });
    }

    private async selectTasklist(): Promise<string> {
        const taskLists = await this.googleTasksApi.fetchTaskList();
        const selected = await showSelectModal(taskLists.items, {
            itemToString: (item) => item.title,
            placeHolder: 'Select a tasklist to be synchronized with reminders.  Cancel to create new tasklist.',
        });
        if (selected != null) {
            this.googleTasksData.taskListId = selected.id;
            return selected.id;
        } else {
            const name = await showInputDialog();
            const created = await this.googleTasksApi.createTaskList(name);
            this.googleTasksData.taskListId = created.id;
            return created.id;
        }
    }
}
