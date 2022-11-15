import type { GoogleAuthClient } from '../google-api/client';

export type GoogleTaskList = {
    kind: string;
    id: string;
    etag: string;
    title: string;
    updated: string;
    selfLink: string;
};

export const GoogleTasksStatus = {
    NEEDS_ACTION: 'needsAction',
    COMPLETED: 'completed',
};

export type GoogleTask = {
    kind: string;
    id: string;
    etag: string;
    title: string;
    updated: string;
    selfLink: string;
    parent: string;
    position: string;
    notes?: string;
    status: string;
    due: string;
    completed: string;
    deleted: boolean;
    hidden: boolean;
    links: [
        {
            type: string;
            description: string;
            link: string;
        },
    ];
};

export type GoogleTaskListsResponse = {
    items: Array<GoogleTaskList>;
};

export type GoogleTasksResponse = {
    kind: string;
    etag: string;
    nextPageToken: string;
    items: Array<GoogleTask>;
};

export class GoogleTasksApi {
    private static readonly BASE = 'https://tasks.googleapis.com/tasks/v1';
    constructor(private client: GoogleAuthClient) {}

    public isReady(): boolean {
        return this.client.isReady();
    }

    public async fetchTaskList(): Promise<GoogleTaskListsResponse> {
        return this.client
            .get(`${GoogleTasksApi.BASE}/users/@me/lists`)
            .then((resp) => resp as GoogleTaskListsResponse);
    }

    public async createTaskList(title: string): Promise<GoogleTaskList> {
        return this.client
            .post(`${GoogleTasksApi.BASE}/users/@me/lists`, {
                title,
            })
            .then((resp) => resp as GoogleTaskList);
    }

    public async fetchAllTasks(taskListId: string): Promise<Array<GoogleTask>> {
        const tasks: Array<GoogleTask> = [];
        let pageToken;
        do {
            const resp: GoogleTasksResponse = await this.fetchTasks(taskListId, pageToken);
            pageToken = resp.nextPageToken;
            tasks.push(...resp.items);
        } while (pageToken != null);
        return tasks;
    }

    private async fetchTasks(taskListId: string, pageToken?: string): Promise<GoogleTasksResponse> {
        const param = new Map<string, string>();
        param.set('showHidden', 'true');
        param.set('maxResults', '100');
        if (pageToken != null) {
            param.set('pageToken', pageToken);
        }
        return (
            this.client
                .get(`${GoogleTasksApi.BASE}/lists/${taskListId}/tasks`, param)
                // TODO pagination
                .then((resp) => resp as GoogleTasksResponse)
        );
    }

    public async createTask(taskListId: string, task: GoogleTask): Promise<GoogleTask> {
        return this.client.post(`${GoogleTasksApi.BASE}/lists/${taskListId}/tasks`, task);
    }

    public async deleteTask(taskListId: string, id: string): Promise<void> {
        this.client.delete(`${GoogleTasksApi.BASE}/lists/${taskListId}/tasks/${id}`);
    }
}
