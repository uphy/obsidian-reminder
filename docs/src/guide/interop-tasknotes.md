# TaskNotes Plugin

[TaskNotes](https://tasknotes.dev/) keeps each task as a note and stores the task's reminders in the note's `reminders` property. This plugin can show those reminders with everything else it reminds you of: in the reminder list, as a popup or system notification, and through [ntfy](/setting/#ntfy).

```markdown
---
title: Send the report
tags:
  - task
status: open
due: 2026-11-20T10:00
reminders:
  - id: rem_1
    type: relative
    relatedTo: due
    offset: -PT15M
    description: 15 min before
  - id: rem_2
    type: absolute
    absoluteTime: 2026-11-18T09:00:00
---
```

With this note, you get one reminder on November 18 at 09:00 and one on November 20 at 09:45, both titled "Send the report".

## Turn it on

Reading is off by default. Turn on [Read TaskNotes reminders](/setting/#read-tasknotes-reminders) under **Settings → Note reminders**.

::: warning Two plugins, one reminder
TaskNotes shows its own notification for the same reminders. With both on, you are notified twice, and **Done** here does not dismiss TaskNotes' notice. Turn notifications off in one of the two plugins.
:::

## Which notes and reminders are read

- The note is a TaskNotes task: it has the task tag (`task`, or a tag nested under it such as `task/work`), or, when TaskNotes identifies tasks by a property, it has that property with that value.
- Its status is not a completed one, and it does not have the archive tag (`archived`).
- It is not a recurring task (no `recurrence`). A recurring task moves its own dates when it is completed, so its reminders are left to TaskNotes.
- A relative reminder needs the date it refers to (`due` or `scheduled`). A date without a time counts from midnight, so `-PT15M` before `due: 2026-11-20` is November 19 at 23:45.
- Reminders dated before [Ignore TaskNotes reminders before](/setting/#ignore-tasknotes-reminders-before) are not read. The date is set to the day you turn reading on, so that reminders already in the past do not all notify at once.

A time written with a UTC offset or `Z` is not read.

## When you changed TaskNotes' settings

TaskNotes lets you rename its properties (**Task properties**), choose how a task note is identified (**Task identification**: a tag or a property), and define your own statuses. This plugin follows those settings, so there is nothing to set up: rename `due` to `deadline` in TaskNotes, and a reminder "15 minutes before due" counts from `deadline` here as well.

Each of these also has a setting here: [Identify tasks by](/setting/#identify-tasks-by), [Task tag](/setting/#task-tag), [Task property](/setting/#task-property), [Completed statuses](/setting/#completed-statuses), [Archive tag](/setting/#archive-tag) and the [TaskNotes property names](/setting/#tasknotes-property-names). Left empty, a setting uses TaskNotes' value, which is shown greyed in the field. Fill one in only to use another value than TaskNotes does.

Where TaskNotes' values come from, in this order:

1. The TaskNotes plugin running in this vault.
2. What TaskNotes said the last time it was running. This is saved with this plugin's settings, so a device that syncs the vault without TaskNotes reads the task notes the same way.
3. TaskNotes' factory defaults (`task`, `done`, `archived`, `due`, `reminders`, …), when TaskNotes was never seen.

With a renamed reminders property, handled reminders are recorded under that name: `alerts` gets `alerts-done`.

## What Done and Remind me later write

TaskNotes owns the `reminders` list, so this plugin changes as little of it as it can.

**Done** leaves the reminder as it is and records it in a list property of its own, `reminders-done`:

```markdown
---
reminders:
  - id: rem_1
    type: relative
    relatedTo: due
    offset: -PT15M
reminders-done:
  - rem_1@2026-11-20T09:45:00
---
```

The record holds the time the reminder was shown for. When you move the task's due date in TaskNotes, the reminder's time changes, the record no longer matches, and you are reminded again at the new time.

**Remind me later** records the reminder the same way and adds one reminder of its own to the list, at the time you chose:

```markdown
---
reminders:
  - id: rem_1
    type: relative
    relatedTo: due
    offset: -PT15M
  - id: obsidian-reminder-snooze-rem_1
    type: absolute
    absoluteTime: 2026-11-20T10:15:00
reminders-done:
  - rem_1@2026-11-20T09:45:00
---
```

TaskNotes lists the added reminder with the task's other reminders. **Done** on it removes it again. If the due date moves while it is waiting, the added reminder no longer applies: it is ignored, and removed the next time the plugin writes to the note.

## Good to know

- Completing the task in TaskNotes removes its reminders here, because completed tasks are not read.
- If `reminders-done` already holds something else in your vault, **Done** writes nothing and a notice tells you.
- The [reminder dialog](/guide/note-reminders.html#set-a-reminder-from-a-dialog) and the header bell are for managed properties. Create and edit TaskNotes reminders in TaskNotes.
- The rest of [what applies to note reminders](/guide/note-reminders.html#good-to-know) applies here too.
