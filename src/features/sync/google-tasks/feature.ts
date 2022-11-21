import { AbstractPluginDataHolder } from 'data';
import type { GoogleApiFeature } from 'features/sync/google-api/feature';
import { AbstractGoogleFeature } from 'features/sync/sync-base/google';
import { GoogleAuthClient } from '../google-api/client';
import { GoogleTaskList, GoogleTasksApi } from './client';
import { GoogleTasksSynchronizer } from './synchronizer';

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
            serviceId: 'google-tasks',
            serviceName: 'Google Tasks',
            listName: 'task list',
        });
        this.googleTasksApi = new GoogleTasksApi(googleApiFeature.googleAuthClient);
    }

    createSynchronizer(data: GoogleTasksDataHolder): GoogleTasksSynchronizer | null {
        if (data.taskListId.length === 0) {
            return null;
        }
        return new GoogleTasksSynchronizer(this.googleTasksApi, data.taskListId);
    }

    get scopes(): string[] {
        return [GoogleAuthClient.SCOPE_TASKS];
    }

    resetList(data: GoogleTasksDataHolder): void {
        data.taskListId = '';
    }
    setList(data: GoogleTasksDataHolder, id: string): void {
        data.taskListId = id;
    }
    getList(data: GoogleTasksDataHolder): string {
        return data.taskListId;
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
