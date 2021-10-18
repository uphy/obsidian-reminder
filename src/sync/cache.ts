import type { Reminder, Reminders } from 'model/reminder';
import type { DateTime, Time } from 'model/time';
import { ReminderChange, ReminderChangeType, ReminderSynchronizer, SnapshotReminder } from './synchronizer';

function currentTimeInMillis() {
    return new Date().getTime();
}

class SnapshotCache {
    private eventIdToReminder: Map<string, SnapshotReminder> = new Map();

    constructor(private cache: Array<SnapshotReminder>, private expiresAt: number) {
        cache.forEach((r) => {
            if (r.eventId != null) {
                this.eventIdToReminder.set(r.eventId, r);
            }
        });
    }

    get() {
        return this.cache;
    }

    add(r: SnapshotReminder) {
        this.cache.push(r);
        if (r.eventId != null) {
            this.eventIdToReminder.set(r.eventId, r);
        }
    }

    remove(eventId: string) {
        this.eventIdToReminder.delete(eventId);
        this.cache = this.cache.filter((r) => eventId !== r.eventId);
    }

    isExpired() {
        return currentTimeInMillis() > this.expiresAt;
    }
}

/**
 * An ReminderSynchronizer implementation which uses cache for snapshot() method.
 */
export class CachingReminderSynchronizer extends ReminderSynchronizer {
    private cache?: SnapshotCache;

    constructor(private reminderSynchronizer: ReminderSynchronizer, private ttlMillis: number) {
        super();
    }

    setupReady(): boolean {
        return this.reminderSynchronizer.setupReady();
    }

    async snapshot(force: boolean): Promise<SnapshotReminder[]> {
        const cache = this.getCache();
        if (!force && cache != null) {
            return cache.get();
        }

        const snapshot = await this.reminderSynchronizer.snapshot(force);
        this.updateCache(snapshot);
        return snapshot;
    }

    private updateCache(snapshot: Array<SnapshotReminder>) {
        this.cache = new SnapshotCache(snapshot, currentTimeInMillis() + this.ttlMillis);
    }

    private getCache() {
        const c = this.cache;
        if (c != null && !c.isExpired()) {
            return c;
        }
        return undefined;
    }

    override async applyChanges(changes: ReminderChange[], defaultTime: Time): Promise<void> {
        // Update actual service first for getting newly added event's 'eventId'
        await this.reminderSynchronizer.applyChanges(changes, defaultTime);

        // After updating 'eventId', we have to also apply changes to cache.
        const cache = this.getCache();
        if (cache == null) {
            // There are no cache. So no need to apply changes to cache.
            return;
        }
        changes.forEach((change) => {
            switch (change.changeType) {
                case ReminderChangeType.ADD:
                    if (change.reminder != null) {
                        cache.add({
                            id: change.id,
                            eventId: change.eventId,
                            title: change.reminder.title,
                            time: change.reminder.time,
                            status: change.status,
                        });
                    }
                    break;
                case ReminderChangeType.REMOVE:
                    if (change.eventId != null) {
                        cache.remove(change.eventId);
                    }
                    break;
            }
        });
    }

    // TODO this is design failure.  should be more apropriate abstraction.
    // these methods are called from parent class.
    // but in this class, the parent `applyChanges()` method is not called.
    // therefore, these methods are not required.
    add(id: string, reminder: Reminder, defaultTime: Time): Promise<string> {
        throw new Error('do not come here');
    }
    remove(externalId: string): Promise<void> {
        throw new Error('do not come here');
    }
}
