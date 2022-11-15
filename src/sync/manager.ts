import type { Reminders } from 'model/reminder';
import type { Time } from 'model/time';
import type { ReminderSynchronizer, ReminderEditor } from '.';
import { CachingReminderSynchronizer } from './cache';

export class ReminderSynchronizerRegistration<T extends ReminderSynchronizer> {
    private synchronizer: T | null = null;
    constructor(private manager: ReminderSynchronizerManager) {}
    start(synchronizer: T) {
        this.stop();
        this.manager.addSynchronizer(synchronizer);
        this.synchronizer = synchronizer;
    }
    stop() {
        if (this.synchronizer != null) {
            this.manager.removeSynchronizer(this.synchronizer);
            this.synchronizer = null;
        }
    }
    get running(): boolean {
        return this.synchronizer != null;
    }
}

export class ReminderSynchronizerManager {
    private synchronizers: Array<ReminderSynchronizer> = [];
    private valid: boolean = false;

    constructor(private editor: ReminderEditor) {}

    register<T extends ReminderSynchronizer>(): ReminderSynchronizerRegistration<T> {
        return new ReminderSynchronizerRegistration<T>(this);
    }

    addSynchronizer(s: ReminderSynchronizer) {
        this.synchronizers.push(s);
    }

    removeSynchronizer(s: ReminderSynchronizer) {
        this.synchronizers.remove(s);
    }

    invalidate() {
        this.valid = false;
    }

    anySynchronizersReady() {
        return this.synchronizers.filter((s) => s.setupReady()).length > 0;
    }

    async synchronizeReminders(reminders: Reminders, defaultTime: Time, force = false): Promise<void> {
        if (!force && this.valid) {
            // no need to sync
            return;
        }

        await Promise.all(
            this.synchronizers.map(async (s) => {
                if (!s.setupReady()) {
                    return;
                }
                try {
                    await s.synchronizeReminders(reminders, defaultTime, this.editor, force);
                } catch (ex) {
                    console.error('Synchronization error: synchronizer=%s', s, ex);
                }
            }),
        );
        this.valid = true;
    }
}
