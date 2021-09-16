# Tasks Plugin

[Tasks Plugin](https://github.com/schemar/obsidian-tasks) track tasks across your entire vault and helps users to manage tasks.

## Tasks Plugin's Task Format

If you enable [setting](/setting/#enable-tasks-plugin-format), following format recognized as reminder.

```markdown
- [ ] Task 📅 2021-09-16
```

In this case, reminder will be notified on 2021-09-16.  
Reminder time is based on the [default reminder time](/setting/#reminder-time).

When you [toggle checklist status](/guide/set-reminders.html#toggle-checklist-status), done date will be inserted like following.

```markdown
- [x] Task 📅 2021-09-16 ✅ 2021-09-17
```

::: warning Note
- You cannot change this time format for interoperability with Tasks Plugin
- If you want to specify the reminder time separately from the due date in the Tasks Plugin, you can use [reminder emoji](#distinguish-due-date-and-reminder-date).
:::

## Recurring tasks

Tasks plugin supports recurring tasks.

```markdown
- [ ] Task 🔁 every Sunday 📅 2021-09-16
```

Reminder plugin also supports this feature.

When you [toggle checklist status](/guide/set-reminders.html#toggle-checklist-status), next recurring task will be created.

## Distinguish due date and reminder date

If you want to specify the reminder time separately from the due date in the Tasks Plugin, enable this [setting](/setting/#distinguish-between-reminder-date-and-due-date).

When you enable this option, the following task's reminder date will be 2021-09-16 (Not 2021-09-17).

```markdown
- [ ] Task ⏰ 2021-09-16 📅 2021-09-17
```

Also you can specify time:

```markdown
- [ ] Task ⏰ 2021-09-16 10:00 📅 2021-09-17
```

::: tip
You can change date/time format.  See [Date Time Format](/guide/set-reminders.html#date-time-format).
:::

::: warning
You can't insert any characters other than date/time between ⏰ and 📅.
- (OK) `- [ ] Task ⏰ 2021-09-16 📅 2021-09-17`
- (NG) `- [ ] Task ⏰ 2021-09-16 #Tag 📅 2021-09-17`
:::