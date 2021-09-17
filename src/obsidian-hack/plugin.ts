import type { App } from "obsidian";

type Plugin = {
    settings: any
}

export function findPlugin(app: App, pluginId: string): Plugin | null {
    const plugin = (app as any).plugins.plugins[pluginId];
    if (plugin) {
        return plugin;
    }
    return null;
}

export function isPluginInstalled(app: App, pluginId: string) {
    const plugin = findPlugin(app, pluginId);
    if (plugin) {
        return true;
    }
    return false;
}