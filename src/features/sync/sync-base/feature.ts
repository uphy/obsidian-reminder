import { Feature, Plugin } from 'features/feature';
import { Notice } from 'obsidian';

export class SyncBaseFeature extends Feature {
    override async init(plugin: Plugin): Promise<void> {
        plugin.addCommand({
            id: 'synchronize-reminders-force',
            name: 'Force synchronization of reminders to external services',
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

    override async onload(plugin: Plugin): Promise<void> {
        let syncRunning = false;
        let lastForceSync = new Date().getTime();
        plugin.registerInterval(
            window.setInterval(() => {
                if (syncRunning) {
                    console.info('Skipping reminder synchronization because the task is already running.');
                    return;
                }
                syncRunning = true;
                let force = false;
                const time = new Date().getTime();
                if ((time - lastForceSync) / 1000 > 60 * 60 * 1000) {
                    // force sync once an hour
                    force = true;
                    lastForceSync = time;
                }
                plugin.pluginDataIO
                    .synchronizeReminders(force)
                    .catch((ex) => {
                        new Notice('Failed to synchronize reminders: ' + ex);
                    })
                    .finally(() => {
                        syncRunning = false;
                    });
            }, 10 * 1000),
        );
    }
}
