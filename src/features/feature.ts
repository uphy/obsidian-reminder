import type { RemindersController } from 'controller';
import type { PluginDataIO } from 'data';
import { Reference } from 'model/ref';
import type { Reminders } from 'model/reminder';
import type { Plugin_2 } from 'obsidian';

export type PluginInterface = {
    pluginDataIO: PluginDataIO;
    reminders: Reminders;
    remindersController: RemindersController;
};

export type Plugin = Plugin_2 & PluginInterface;

export abstract class Feature {
    /**
     * Called when all features are registered into the manager only once.
     */
    init(plugin: Plugin): Promise<void> {
        return Promise.resolve();
    }
    /**
     * Called when this feature is loaded(on launch, on enabled, ...).
     *
     * To load again, `onunload` must be called before this.
     */
    onload(plugin: Plugin): Promise<void> {
        return Promise.resolve();
    }
    /**
     * Called when this feature is unloaded(on shutdown, on disabled, ...).
     *
     * onload() must be called before call this method.
     */
    onunload(plugin: Plugin): void {}
}
export class FeatureManager {
    private features: Array<Feature> = [];
    constructor(private plugin: Plugin) {}

    public register(feature: Feature) {
        this.features.push(feature);
    }

    public async init() {
        for (const feature of this.features) {
            feature.init(this.plugin);
        }
    }

    public async load(): Promise<void> {
        for (const feature of this.features) {
            await feature.onload(this.plugin);
        }
    }

    public unload() {
        for (const feature of this.features) {
            feature.onunload(this.plugin);
        }
    }

    public async reload(): Promise<void> {
        this.unload();
        return this.load();
    }
}
