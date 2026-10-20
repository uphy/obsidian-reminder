import type Electron from "electron";

/**
 * Access to Obsidian's bundled Electron, typed down to the members this
 * plugin actually uses.
 *
 * Obsidian exposes Electron through `remote`, which Electron itself moved out
 * to the separate `@electron/remote` package, so `@types/electron` no longer
 * describes it. Rather than reach through `any`, the shape is declared here --
 * anything not listed stays unavailable instead of silently untyped.
 */
export interface ObsidianElectron {
  remote: {
    Notification: new (
      options: ElectronNotificationOptions,
    ) => ElectronNotification;
    dialog: {
      showMessageBox(
        options: Electron.MessageBoxOptions,
      ): Promise<Electron.MessageBoxReturnValue>;
    };
  };
}

interface ElectronNotificationOptions {
  title: string;
  body: string;
  /**
   * "never" keeps the notification on screen until the user interacts with
   * it. Windows and Linux only; ignored on macOS.
   */
  timeoutType?: "default" | "never";
}

/** The part of Electron's Notification this plugin drives. */
export interface ElectronNotification {
  /** Buttons shown on the notification. macOS only. */
  actions: Array<{ type: string; text: string }>;
  on(event: "click" | "close", listener: () => void): void;
  on(event: "action", listener: (event: unknown, index: number) => void): void;
  show(): void;
  close(): void;
}

/**
 * undefined on mobile, where Obsidian runs without Electron. Every caller has
 * to handle that.
 */
export const electron: ObsidianElectron | undefined = window.require
  ? (window.require("electron") as ObsidianElectron)
  : undefined;
