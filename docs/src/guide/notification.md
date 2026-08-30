# Notification

When the reminder time comes, you will be notified of the contents of the reminder.

There are 2 types of reminder notification:
- [Builtin notification modal](#builtin-notification-model)
- [System notification](#system-notification)

## Builtin notification modal

Built-in notification looks like the following:

<img :src="$withBase('/images/notification-builtin.png')" width="400px">

When you click the file name(in the above example, `TODO.md`), the reminder will be [muted](#mute-notification) once, and the file will be opened.

:::tip
Muted reminders will be in the reminder list's [Overdue section](/guide/list-reminders.html#overdue-reminders).
:::

If you click `Mark as Done`, your reminder TODO item will be checked and it will not be shown in the future.

If you click `Remind Me Later`, you can choose how long you want to postpone the task.

<img :src="$withBase('/images/notification-builtin-remind-me-later.png')" width="400px">

The date and time in the markdown will be updated according to your choice.

The `Remind Me Later`'s option is customizable with [Remind Me Later](/setting/#remind-me-later) setting.

### Keyboard shortcuts

Because the popup can appear at any time while you're doing something else, it no longer focuses the `Done` button by default: a keypress you were already mid-typing (like <kbd>Enter</kbd>) could otherwise complete a reminder you never actually read. Enable [Focus Done button on popup](/setting/#focus-done-button-on-popup) to restore the old behavior.

Instead, the popup supports Alt (Option on macOS) or Ctrl mnemonic shortcuts, which can't fire by accident since they require holding a modifier key:

| Shortcut | Action |
| --- | --- |
| <kbd>Alt</kbd>+<kbd>D</kbd> / <kbd>Ctrl</kbd>+<kbd>D</kbd> | Mark as done |
| <kbd>Alt</kbd>+<kbd>M</kbd> / <kbd>Ctrl</kbd>+<kbd>M</kbd> | Mute |
| <kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>S</kbd> | Focus the `Remind Me Later` (snooze) dropdown, then use the arrow keys to choose an option |
| <kbd>Alt</kbd>+<kbd>O</kbd> / <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open the note |

If another app on your system already captures the Option/Alt combination (window managers, launchers), use the Ctrl variant instead.

### Toast style

By default the popup is shown as a small card stacked in the bottom-right corner, which does not take focus or interrupt what you're doing. Set [Reminder popup style](/setting/#reminder-popup-style) to `Modal (center dialog)` to show it instead as a modal dialog centered in the window that takes focus.

Multiple toasts stack when several reminders fire close together. The [keyboard shortcuts](#keyboard-shortcuts) above only apply to the most recently shown toast (the bottom-most card in the stack); older toasts fall back to the buttons on the card (mouse/touch only), since two toasts both reacting to the same keypress would be confusing.

Because toasts don't take focus, they appear immediately even while you're typing — the [Edit Detection Time](/setting/#edit-detection-time) deferral only applies to the modal style.

## System notification

Instead of built-in notification, a system notification is also available by [setting](/setting/#use-system-notification).

<img :src="$withBase('/images/notification-mac.png')" width="400px">

- If you click the notification, the built-in notification will be displayed in the Obsidian app, unless [Open note on reminder click](/setting/#open-note-on-reminder-click) is enabled, in which case the note is opened directly instead.
- If you close the notification, the reminder is [muted](#mute-notification)

Also, if you are using macOS, you can mark it as done or postpone the reminder with the notification options.

If you use the same vault on multiple devices (for example with Obsidian Sync), completing or snoozing a reminder on one device can automatically dismiss its system notification on your other devices. On macOS this already works without any extra setup. On Windows and Linux, the OS only lets the plugin dismiss a notification while it's still on screen, so this also requires enabling [Keep system notification on screen](/setting/#keep-system-notification-on-screen) there -- otherwise the notification may already have moved to the action center/notification tray by the time the dismissal arrives.

### Showing the popup together with the system notification

If you'd rather not lose the popup's actions, enable [Show popup together with system notification](/setting/#show-popup-together-with-system-notification) alongside `Use system notification`. The built-in reminder popup is then shown at the same time as the system notification, and the popup becomes the surface that handles the reminder actions (mark as done/remind me later/mute/open note). The system notification acts as an alert only: clicking it just closes it, or opens the note directly when [Open note on reminder click](/setting/#open-note-on-reminder-click) is enabled.

## Mute notification

The reminder will be muted if you do the following:

- In builtin notification,
    - press <kbd>Esc</kbd>
    - click outside of the notification modal
- Close the system notification

A muted reminder is remembered across Obsidian restarts, so it stays muted even after you close and reopen the app (useful on mobile, where the app restarts frequently).

A muted reminder becomes active again if you:
- click it in [reminder list view](/guide/list-reminders.html), which opens the reminder popup again so you can mark it done or snooze it
- change the reminder's date/time in the markdown
- turn on [Re-notify muted reminders on startup](/setting/#re-notify-muted-reminders-on-startup), which clears every mute flag the next time Obsidian starts

## Muting all reminders at once

If notifications have piled up (for example, after a vacation), you can mute every currently overdue reminder in one action:
- Click `Mute all reminders…` at the bottom of a notification popup.
- Run `Mute all current notifications` from the command palette.

This mutes every reminder that is currently overdue, the same way [muting a single reminder](#mute-notification) does. Unlike [pausing notifications](#pausing-notifications-temporarily-do-not-disturb), which is temporary and lets overdue reminders notify you again once it ends, mute-all is permanent per reminder: each muted reminder stays muted (and survives restarts) until you interact with it as described above.

## Pausing notifications temporarily (do not disturb)

Unlike the [Enable reminder notifications](/setting/#enable-reminder-notifications) setting, which turns notifications off permanently until you turn it back on, do-not-disturb lets you pause notifications for a fixed duration and have them resume automatically.

You can start it from either place:
- Run `Pause notifications` from the command palette. It opens a duration chooser with the same options as the [Remind Me Later](/setting/#remind-me-later) setting.
- Click `Pause all notifications…` at the bottom of a notification popup. This closes the popup (without [muting](#mute-notification) that reminder) and opens the same duration chooser.

While paused:
- No builtin notification popups or system notifications are shown.
- The [reminder list view](/guide/list-reminders.html) keeps updating as usual, including moving reminders into [Overdue](/guide/list-reminders.html#overdue-reminders).
- Reminders are not muted by the pause, so any reminder that's still overdue is notified again shortly after the pause ends.

A status bar item (🔕) shows the time the pause ends; click it to resume notifications immediately. You can also run `Resume notifications` from the command palette, which is only available while paused. The pause is remembered across Obsidian restarts, but it's a transient state rather than a setting, so it doesn't appear in the settings tab.

## Notifications when Obsidian isn't running (mobile)

On mobile, Obsidian can't run plugin code in the background, so none of the notification methods above fire unless the app happens to be open at the reminder's time. [ntfy](https://ntfy.sh) scheduled notifications work around this: this plugin registers upcoming reminders with an ntfy server, and the *server* — not Obsidian — delivers the push notification at the right time, whether or not Obsidian is running.

This is an experimental feature (PoC-level). Enable it under [ntfy settings](/setting/#ntfy).

### Setup

1. Install the [ntfy app](https://ntfy.sh/#step-1-get-the-app) on your phone (available for iOS and Android), or use any other client capable of subscribing to an ntfy topic.
2. Pick a topic name and subscribe to it in the app. Anyone who knows this topic name can subscribe to it and read your reminder titles and note names, so use a long, hard-to-guess name rather than something predictable (e.g. a random string) — see [ntfy's docs on topics](https://ntfy.sh/docs/publish/#topics) for details.
3. In Obsidian, open [ntfy settings](/setting/#ntfy), turn on [Enable ntfy scheduled notifications](/setting/#enable-ntfy-scheduled-notifications-experimental), and set the same [server URL](/setting/#ntfy-server-url) and [topic](/setting/#ntfy-topic) you used in step 2. If you're self-hosting ntfy instead of using `ntfy.sh`, point the server URL at your own instance.
4. If your server requires authentication, paste an access token into [ntfy access token](/setting/#ntfy-access-token) — see below. Leave it empty for a server that doesn't, such as `ntfy.sh`.
5. Press **Test** next to the token field. It makes the same three requests a real sync does and reports what failed, so a wrong token or an unreachable server shows up here instead of silently in the developer console.

#### Servers that require authentication

`ntfy.sh` and a default self-hosted instance let anyone publish to any topic, so no credentials are needed. A server configured with access control (`auth-default-access: "deny-all"`, for example) refuses every request until you supply a token.

Create one on the server with `ntfy token add <user>`, or from the ntfy web app under Account → Access tokens, then paste it into the access token setting. The plugin sends it as an `Authorization: Bearer` header on every request.

The token needs **read-write access to the topic** — this plugin doesn't only publish. Each sync round first reads the topic's scheduled messages to work out what's already registered, then publishes what's missing and deletes what's stale. A read-only token gets as far as the first step and no further; the **Test** button says so explicitly rather than leaving you to guess.

Once configured, the plugin periodically publishes your upcoming reminders (each reminder's title and the name of the note it's in) to that topic as scheduled messages. When a reminder's time comes, the ntfy server pushes the notification to every subscribed device — including phones where Obsidian isn't open. Tapping the notification opens the corresponding note in Obsidian.

Completing, snoozing, or otherwise rescheduling a reminder on one device also clears the ntfy notification that already fired for it on your other devices — so, for example, marking a reminder done on your laptop dismisses the matching push notification still sitting in your phone's notification drawer.

### Constraints

- **Titles and note names are sent to the ntfy server.** Only the reminder's title and the name of the note it's in (not the note's content or its full path) are sent, but they do leave your device and go to whichever server you configured. Don't enable this with a server you don't trust.
- **The access token is stored in plain text.** It lives in this plugin's `data.json` like every other setting, so it's synced along with your vault if you sync your Obsidian configuration folder (`.obsidian` unless you changed it), and readable by anything that can read those files. Prefer a token scoped to just this topic over one with access to your whole ntfy account, so a leak can be revoked without disturbing anything else.
- **Requires ntfy v2.16.0 or later.** This feature relies on ntfy's sequence-ID based scheduled message replacement/deletion, added in that version. `ntfy.sh` (the public hosted service) already runs a recent enough version; if you self-host, make sure your server is updated.
- **Only reminders due within the next 24 hours are registered.** ntfy itself allows scheduling a message at most 3 days ahead, but this plugin only ever registers reminders up to 24 hours out, and periodically re-registers reminders as time passes so that window keeps rolling forward. If Obsidian isn't opened for more than a day, reminders due after that point won't have been registered yet and won't notify you via ntfy until Obsidian runs again.
- **Renaming the topic leaves old schedules behind.** Turning the feature off deletes this plugin's own pending schedules from the currently configured topic, but changing the topic name instead has no way to reach the previous topic afterward, so schedules already registered under the old name are not cleaned up.
- **Clearing an already-delivered notification on other devices requires client support.** Verified working with ntfy's Android app and with the ntfy web app in Chrome. ntfy's own docs list this (`message_delete` / notification cancellation) under `Supported on:` Android and Firefox, so the web app is not actually limited to Firefox, but treat those docs as the authoritative list. The iOS app isn't listed there and most likely keeps showing the notification until you dismiss it by hand.
- **Delivered notifications can only be cleared while ntfy still has them cached.** `ntfy.sh` retains messages for 12 hours after delivery by default; once a message ages out of that cache, there's nothing left on the server to delete, so the notification stays on devices that already received it.

## Overdue count in the status bar

A status bar item (e.g. `⏰ 3`) shows how many reminders are currently overdue, including muted ones. It's hidden whenever there are none. Click it to open the [reminder list view](/guide/list-reminders.html). Controlled by [Show overdue count in status bar](/setting/#show-overdue-count-in-status-bar), which is on by default.
