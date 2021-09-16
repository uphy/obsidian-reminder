# Quick Start

You can [set reminders](/guide/set-reminders.html) by putting `(@YYYY-MM-DD HH:mm)` to the TODO list.

```markdown
- [ ] Task 1 (@2021-09-15 20:40)
```

Reminders set for all files can be viewed in a [list view](/guide/list-reminders.md).

<img :src="$withBase('/images/reminder-list.png')" width="300px">

When the reminder time comes, you will be [notified](/guide/notification.md) of the contents of the reminder.

<img :src="$withBase('/images/notification.png')" width="400px">

This plugin is also interoperable with the date formats of other plugins.

- [Obsidian Tasks Plugin](/guide/interop-tasks.md)
- [Obsidian Kanban Plugin](/guide/interop-kanban.md)
- [Natural Language Dates Plugin](/guide/interop-nldates.md)