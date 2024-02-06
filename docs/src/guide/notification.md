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

## System notification

Instead of built-in notification, a system notification is also available by [setting](/setting/#use-system-notification).

<img :src="$withBase('/images/notification-mac.png')" width="400px">

- If you click the notification, the built-in notification will be displayed in the Obsidian app.
- If you close the notification, the reminder is [muted](#mute-notification)

Also, if you are using macOS, you can mark it as done or postpone the reminder with the notification options.

## External Service Notifications

You have the option to integrate reminders with external services, allowing you to receive notifications on mobile devices and other platforms. For more information, refer to the [Service Integration page](/guide/integration).

## Mute notification

The reminder will be muted if you do the following:

- In builtin notification,
    - press <kbd>Esc</kbd>
    - click outside of the notification modal
- Close the system notification

A muted reminder will not be notified again until
- you restart the Obsidian app
- you click muted reminder in [reminder list view](/guide/list-reminders.html)
