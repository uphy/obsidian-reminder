import { Feature, Plugin } from 'features/feature';
import { Notice } from 'obsidian';

export class SyncBaseFeature extends Feature {
    override async init(plugin: Plugin): Promise<void> {
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
}
