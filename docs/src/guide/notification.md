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
Muted reminders will be in reminder list's [Overdue section](/guide/list-reminders.html#overdue-reminders).
:::

If you click `Mark as Done`, your reminder TODO item will be checked and it will not be shown in the future.

If you click `Remind Me Later`, you can choose how long you want to postpone the task.

<img :src="$withBase('/images/notification-builtin-remind-me-later.png')" width="400px">

The date and time in the markdown will be updated according to your choice.

`Remind Me Later`'s option are customizable with [Remind Me Later](/setting/#remind-me-later) setting.

## System notification



## Mute notification