import { App } from "obsidian";

export function isPluginInstalled(app: App, pluginId: string) {
    const plugin = (app as any).plugins.plugins[pluginId];
    if (plugin) {
        return true;
    }
    return false;
}