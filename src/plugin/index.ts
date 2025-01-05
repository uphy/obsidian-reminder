/**
 * This module contains the Obsidian Plugin depended modules.
 * This was introduced to avoid huge main.ts file.
 *
 * Some modules has a dependency on ReminderPlugin which causes the circular dependency but we accept it currently to improve the readability of the code.
 * In the future, we will refactor the code to remove the circular dependency.
 *
 * @module plugin
 */
export { NotificationWorker } from './notification-worker';
export { ReminderPluginUI } from './ui';
export { ReminderPluginFileSystem } from './filesystem';
export { PluginData } from './data';
