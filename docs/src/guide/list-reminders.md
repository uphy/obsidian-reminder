# List Reminders

## Reminder List View

Reminders defined in your all of the markdown files are listed like below:

<img :src="$withBase('/images/reminder-list-view.png')" width="500px">

::: tip
- By default, reminder list view is displayed in the right pane of Obsidian app. You can move it by DnD.
- If you can't find the view, run `Show reminders` from Obsidian's command palette
:::

If you click the reminder, the file in which you defined the reminder will be opened.

## Overdue Reminders

Reminders whose time has passed are displayed in the `Overdue` section in reminder list view, whether or not you [muted](/guide/notification.html#mute-notification) them. This keeps the list meaningful even when [Enable reminder notifications](/setting/#enable-reminder-notifications) is off.

<img :src="$withBase('/images/reminder-list-overdue.png')" width="300px">

When you click the overdue reminder, the [reminder notification](/guide/notification.html) will be shown again.

<img :src="$withBase('/images/notification-builtin.png')" width="400px">

::: tip
If [Open note on reminder click](/setting/#open-note-on-reminder-click) is enabled, clicking an overdue reminder opens the note directly instead.
:::
