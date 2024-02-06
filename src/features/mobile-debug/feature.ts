import { monkeyPatchConsole } from 'obsidian-hack/obsidian-debug-mobile';
import { Feature, Plugin } from '../feature';

export class MobileDebugFeature extends Feature {
    override async onload(plugin: Plugin): Promise<void> {
        if (plugin.pluginDataIO.debug.value) {
            monkeyPatchConsole(plugin);
        }
    }
}
