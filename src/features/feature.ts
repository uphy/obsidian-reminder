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
export enum FeatureId {
    GoogleApi,
    GoogleTasks,
}
export abstract class Feature {
    abstract get featureId(): FeatureId;

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

type FeatureState = {
    enable: boolean;
};

type FeaturesState = { [featureId: string]: FeatureState };

class FeatureWrapper extends Feature {
    private _loaded: boolean = false;
    private _enable: boolean = true;
    constructor(private feature: Feature) {
        super();
    }

    get featureId() {
        return this.feature.featureId;
    }

    getState(): FeatureState {
        return {
            enable: this._enable,
        };
    }

    setState(state: FeatureState) {
        this._enable = state.enable;
    }

    override init(plugin: Plugin): Promise<void> {
        return this.feature.init(plugin);
    }

    override async onload(plugin: Plugin): Promise<void> {
        if (this._enable && !this._loaded) {
            await this.feature.onload(plugin);
            this._loaded = true;
        }
    }

    override onunload(plugin: Plugin): void {
        if (this._loaded) {
            this.feature.onunload(plugin);
            this._loaded = false;
        }
    }

    async enable(plugin: Plugin): Promise<void> {
        this._enable = true;
        await this.onload(plugin);
    }

    disable(plugin: Plugin) {
        this.onunload(plugin);
        this._enable = false;
    }
}

export class FeatureManager {
    private features: Array<FeatureWrapper> = [];
    private state: Reference<FeaturesState> = new Reference({});
    constructor(private plugin: Plugin) {}

    public register(feature: Feature) {
        this.features.push(new FeatureWrapper(feature));
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

    public async enable(featureId: FeatureId): Promise<void> {
        this.getFeature(featureId).enable(this.plugin);
    }

    public disable(featureId: FeatureId) {
        this.getFeature(featureId).disable(this.plugin);
    }

    private getFeature(featureId: FeatureId): FeatureWrapper {
        for (const feature of this.features) {
            if (feature.featureId === featureId) {
                return feature;
            }
        }
        throw 'feature not found';
    }
}
