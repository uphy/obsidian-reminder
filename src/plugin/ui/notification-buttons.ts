import type { Later } from "model/time";

/**
 * The most `<action>` buttons a Windows toast may declare (the toast XML
 * schema allows `action{0,5}`). Windows rejects a toast with more and shows
 * a blank "New notification" in its place.
 */
const WINDOWS_MAX_TOAST_BUTTONS = 5;

/**
 * Returns the "Remind me later" items to offer as system notification
 * buttons, alongside the "Mark as Done" button that always comes first.
 *
 * Since Electron 40, Windows toasts render `actions` (earlier versions
 * ignored them), so the full list -- "Mark as Done" plus every later, 6
 * buttons with the default settings -- can exceed the Windows limit. On
 * Windows the list is truncated to fit; the dropped laters stay reachable
 * from the builtin popup. macOS has no such limit: it shows the first button
 * and tucks the rest into a menu.
 *
 * Truncating keeps a prefix, so a button's index still maps to the same
 * later (`laters[index - 1]`).
 */
export function systemNotificationLaters(
  laters: Array<Later>,
  isWindows: boolean,
  keepOnScreen: boolean,
): Array<Later> {
  if (!isWindows) {
    return laters;
  }
  // "Mark as Done" takes one slot. With `timeoutType: "never"` (keep on
  // screen), Electron also prepends its own "Close" button.
  const reserved = keepOnScreen ? 2 : 1;
  return laters.slice(0, WINDOWS_MAX_TOAST_BUTTONS - reserved);
}
