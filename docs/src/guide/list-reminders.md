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

If you [mute](/guide/notification.html#mute-notification) the reminders, they will be displayed in `Overdue` section in reminder list view.

<img :src="$withBase('/images/reminder-list-overdue.png')" width="300px">

When you click the overdue reminder, the [reminder notification](/guide/notification.html) will be shown again.

<img :src="$withBase('/images/notification-builtin.png')" width="400px">