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

## System notification

Instead of built-in notification, a system notification is also available by [setting](/setting/#use-system-notification).

<img :src="$withBase('/images/notification-mac.png')" width="400px">

- If you click the notification, the built-in notification will be displayed in the Obsidian app, unless [Open note on reminder click](/setting/#open-note-on-reminder-click) is enabled, in which case the note is opened directly instead.
- If you close the notification, the reminder is [muted](#mute-notification)

Also, if you are using macOS, you can mark it as done or postpone the reminder with the notification options.

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

## Muting all reminders at once

If notifications have piled up (for example, after a vacation), you can mute every currently overdue reminder in one action:
- Click `Mute all reminders…` at the bottom of a notification popup.
- Run `Mute all current reminders` from the command palette.

This mutes every reminder that is currently overdue, the same way [muting a single reminder](#mute-notification) does. Unlike [pausing notifications](#pausing-notifications-temporarily-do-not-disturb), which is temporary and lets overdue reminders notify you again once it ends, mute-all is permanent per reminder: each muted reminder stays muted (and survives restarts) until you interact with it as described above.

## Pausing notifications temporarily (do not disturb)

Unlike the [Enable reminder notifications](/setting/#enable-reminder-notifications) setting, which turns notifications off permanently until you turn it back on, do-not-disturb lets you pause notifications for a fixed duration and have them resume automatically.

You can start it from either place:
- Run `Pause reminder notifications` from the command palette. It opens a duration chooser with the same options as the [Remind Me Later](/setting/#remind-me-later) setting.
- Click `Pause all notifications…` at the bottom of a notification popup. This closes the popup (without [muting](#mute-notification) that reminder) and opens the same duration chooser.

While paused:
- No builtin notification popups or system notifications are shown.
- The [reminder list view](/guide/list-reminders.html) keeps updating as usual, including moving reminders into [Overdue](/guide/list-reminders.html#overdue-reminders).
- Reminders are not muted by the pause, so any reminder that's still overdue is notified again shortly after the pause ends.

A status bar item (🔕) shows the time the pause ends; click it to resume notifications immediately. You can also run `Resume reminder notifications` from the command palette, which is only available while paused. The pause is remembered across Obsidian restarts, but it's a transient state rather than a setting, so it doesn't appear in the settings tab.

## Overdue count in the status bar

A status bar item (e.g. `⏰ 3`) shows how many reminders are currently overdue, including muted ones. It's hidden whenever there are none. Click it to open the [reminder list view](/guide/list-reminders.html). Controlled by [Show overdue count in status bar](/setting/#show-overdue-count-in-status-bar), which is on by default.
