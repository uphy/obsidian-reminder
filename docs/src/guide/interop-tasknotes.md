# TaskNotes

[TaskNotes](https://tasknotes.dev/) stores task details in note frontmatter. This plugin can read TaskNotes v4 reminder entries and deliver them through its regular reminder notifications and list.

## Enable the integration

Open **Settings → TaskNotes integration** and enable the integration. By default, notes are identified by the `#task` tag. You can instead identify tasks by a frontmatter property (default: `type: task`) or include any note with a valid `reminders` array. Excluded folders are ignored in every mode.

The default TaskNotes property names are `title`, `status`, `due`, `scheduled`, `reminders`, `completedDate`, `recurrence`, `complete_instances`, and `skipped_instances`. If your TaskNotes setup uses different names, expand **TaskNotes property names** in the settings and change the mappings.

Use **Fetch from TaskNotes** to import the current property mappings, identification mode/tag/property, excluded folders, archive tag, and completed statuses from the installed TaskNotes plugin. Fetching replaces those matching Reminder Plugin settings; Reminder Plugin-specific behavior such as skip toggles and the date-only anchor time is unchanged. TaskNotes must be installed and enabled.

## Reminder formats

TaskNotes reminders are read from the `reminders` frontmatter property. Relative reminders use a `due` or `scheduled` anchor and an ISO 8601 duration:

```yaml
---
tags:
  - task
due: 2026-11-20T14:30
scheduled: 2026-11-18T09:00
reminders:
  - id: rem_1794200801440_y7l2fwpz5
    type: relative
    description: Remind-at-due
    relatedTo: due
    offset: -P0D
  - id: rem_1794200801440_6bu6366kw
    type: relative
    description: Reminder-at-schedule
    relatedTo: scheduled
    offset: -PT0M
---
```

Negative offsets trigger before the anchor, positive offsets after it, and zero offsets exactly at it. Calendar units such as days and weeks are calculated as calendar time, including across daylight-saving transitions.

Absolute reminders specify their time directly:

```yaml
reminders:
  - id: rem_example_abs
    type: absolute
    absoluteTime: 2026-11-19T08:00:00
```

Absolute times may use `Z` or a numeric UTC offset. A timestamp with no offset is interpreted as local time. Date-only due or scheduled anchors use the **Date-only anchor time** setting, which defaults to `00:00` as specified by TaskNotes.

## Filtering and behavior

- The **Task title** property is used when present; otherwise, the note's filename is shown.
- Completed tasks are skipped by default: a configured completed status (default `done`), `status: true`, or a non-empty `completedDate` on a non-recurring task.
- Archived tasks are skipped by default when they have the configured archive tag (default `archived`).
- Completed or skipped recurring instances are ignored when the anchor date appears in `complete_instances` or `skipped_instances`.
- Triggers older than one day are ignored by default to avoid a burst of historic notifications when enabling the integration. Adjust **Ignore reminders older than (days)** as needed.
- Invalid reminder entries are skipped and warned about once per note and reminder ID. If an ID is duplicated in a note, only its first entry is used.

## Done action

Marking a TaskNotes reminder done dismisses it in Reminder Plugin's `data.json` and opens the TaskNotes edit modal when available. If TaskNotes or its edit-modal API is unavailable, the plugin shows a notice and opens the task note instead. Reminder Plugin never writes TaskNotes frontmatter.

Snoozing and muting remain stored in Reminder Plugin's `data.json`; they do not change TaskNotes YAML. Opening a reminder from the list opens its task note, and the reminder list labels these entries as TaskNotes.

TaskNotes can also display its own reminder notifications. If both plugins notify for the same task, disable notifications in one plugin to avoid duplicate alerts.
