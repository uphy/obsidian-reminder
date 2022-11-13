import { monkeyPatchConsole } from 'obsidian-hack/obsidian-debug-mobile';
import { Feature, FeatureId, Plugin } from '../feature';

export class MobileDebugFeature extends Feature {
    get featureId(): FeatureId {
        return FeatureId.MobileDebug;
    }
    override async onload(plugin: Plugin): Promise<void> {
        if (plugin.pluginDataIO.debug.value) {
            monkeyPatchConsole(plugin);
        }
    }
}
