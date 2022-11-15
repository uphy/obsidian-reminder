import { AbstractPluginDataHolder } from 'data';
import type { GoogleApiFeature } from 'features/sync/google-api/feature';
import { GoogleTaskList, GoogleTasksApi } from './client';
import { GoogleTasksSynchronizer } from './synchronizer';
import { AbstractGoogleFeature } from 'features/sync/sync-base/google';

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
export class GoogleTasksFeature extends AbstractGoogleFeature<
    GoogleTasksSynchronizer,
    GoogleTasksDataHolder,
    GoogleTaskList
> {
    private googleTasksApi: GoogleTasksApi;

    constructor(googleApiFeature: GoogleApiFeature) {
        super(googleApiFeature, new GoogleTasksDataHolder(), {
            synchronizeCommand: {
                id: 'synchronize-google-tasklist',
                name: 'Synchronize with Google Tasks',
            },
            selectTaskList: {
                listName: 'tasklist',
            },
        });
        this.googleTasksApi = new GoogleTasksApi(googleApiFeature.googleAuthClient);
    }

    createSynchronizer(data: GoogleTasksDataHolder): GoogleTasksSynchronizer {
        return new GoogleTasksSynchronizer(this.googleTasksApi, data.taskListId);
    }
    resetList(data: GoogleTasksDataHolder): void {
        data.taskListId = '';
    }
    setList(data: GoogleTasksDataHolder, id: string): void {
        data.taskListId = id;
    }
    fetchList(): Promise<GoogleTaskList[]> {
        return this.googleTasksApi.fetchTaskList().then((resp) => resp.items);
    }
    getListName(list: GoogleTaskList): string {
        return list.title;
    }
    getListId(list: GoogleTaskList): string {
        return list.id;
    }
    createList(name: string): Promise<string> {
        return this.googleTasksApi.createTaskList(name).then((resp) => resp.id);
    }
}
