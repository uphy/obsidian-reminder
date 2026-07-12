---
sidebar: auto
---

# Config

## Notifications

### Reminder time

Time when a reminder with no time part will show.

- Type: `string`
- Format: `HH:mm` (HH: hour, mm: minute)
- Default: `09:00`

### Reminder time step (minutes)

Step of time for reminder time.

- Type: `number`
- Default: `15`

### Remind me later

You can change option which will be shown when you click `Remind Me Later` button in the [notification](/guide/notification.html).

- Type: `string`
- Format: Line-separated following options
  - In N minutes/hours/days/weeks/months/years
  - Next Sunday/Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/day/week/month/year
  - Tomorrow

### Enable reminder notifications

Show reminder popups and system notifications when a reminder is due.

- Type: `boolean`
- Values:
  - ON: Reminder popups/system notifications are shown when due (default)
  - OFF: Reminder popups/system notifications are suppressed. The [reminder list view](/guide/list-reminders.html) keeps updating, and expired reminders still move to the [Overdue section](/guide/list-reminders.html#overdue-reminders).
- Default: ON

### Reminder popup style

Choose how the [builtin notification popup](/guide/notification.html#builtin-notification-modal) is presented.

- Type: `select`
- Values:
  - Toast (corner card): a card stacked in the bottom-right corner of the window that does not take focus or interrupt what you're doing (default). Multiple toasts stack when several reminders fire close together. Keyboard shortcuts apply only to the most recently shown toast; older toasts are mouse/touch only. Toasts appear immediately, even while you're typing — see [Edit Detection Time](#edit-detection-time).
  - Modal (center dialog): a dialog in the center of the window that takes focus.
- Default: Toast (corner card)

### Open note on reminder click

Open the note directly instead of showing the reminder popup when you click a reminder.

- Type: `boolean`
- Values:
  - ON: Clicking a reminder in the [reminder list](/guide/list-reminders.html), or clicking a system notification, opens the note directly.
  - OFF: Clicking an overdue/muted reminder shows the [reminder popup](/guide/notification.html) again. Clicking a system notification shows the builtin notification in Obsidian.
- Default: OFF

### Use system notification

Use system notification instead of builtin notification.

Only available on desktop OS.

- Type: `boolean`
- Values:
  - ON: Use system notification. In mobile devices, this setting is ignored and builtin notification is used.
  - OFF: Use builtin notification

### Show popup together with system notification

Show the built-in reminder popup at the same time as the system notification.

Only takes effect while [Use system notification](#use-system-notification) is enabled.

- Type: `boolean`
- Values:
  - ON: Both surfaces are shown at once. The popup handles the reminder actions (mark as done/remind me later/mute/open note); the system notification acts as an alert only, so clicking it just closes it, or opens the note when [Open note on reminder click](#open-note-on-reminder-click) is enabled.
  - OFF: Only the system notification is shown, and it handles the reminder actions itself.
- Default: OFF

### Focus Done button on popup

Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.

- Type: `boolean`
- Values:
  - ON: The Done button is focused when the popup opens; pressing Enter immediately marks the reminder as done.
  - OFF: Nothing is focused when the popup opens, so a stray Enter/Space keypress does nothing (default). Use the [keyboard shortcuts](/guide/notification.html#builtin-notification-modal) to operate the popup quickly instead.
- Default: OFF

### Show overdue count in status bar

Show the number of overdue reminders in the status bar (e.g. `⏰ 3`). Muted overdue reminders are still counted. Click the status bar item to open the [reminder list view](/guide/list-reminders.html).

- Type: `boolean`
- Values:
  - ON: The status bar item is shown whenever there is at least one overdue reminder (default)
  - OFF: The status bar item is never shown
- Default: ON

## Editor

### Calendar popup trigger

Trigger to show calendar popup.

- Type: `string`
- Format: Any string. If you make this setting empty string, calendar popup will be disabled.
- Default: `(@`

### Convert non-task lines when inserting a reminder

When inserting a reminder from the [calendar popup](/guide/set-reminders.html#reminder-date-input-support) on a line that is not a task, the line is automatically converted into a task list item (`- [ ] `). Bullets (`- `, `* `, `+ `) get a checkbox inserted after the marker, and plain text or empty lines get `- [ ] ` prepended. Headings, numbered lists, tables, and code fences are not converted; a notice is shown instead.

- Type: `boolean`
- Values:
  - ON: Non-task lines are converted into tasks automatically (default)
  - OFF: A notice is always shown for non-task lines
- Default: ON

### Primary reminder format

Reminder format for generated reminder by calendar popup.

- Type: `select`
- Values:
  - [Reminder plugin format](/guide/set-reminders.html#reminder-format)
  - [Tasks plugin format](/guide/interop-tasks.html)
  - [Kanban plugin format](/guide/interop-kanban.html)
  - [Dataview format](/guide/interop-dataview.html)

### Show reminder pills in editor

Render each reminder's time as a clickable pill (⏰) in [Live Preview](https://help.obsidian.md/Editing+and+formatting/Editing+modes). Clicking a pill opens the date/time chooser to change it, only available on desktop.

- Type: `boolean`
- Values:
  - ON: Reminder times are shown as clickable pills in Live Preview (default)
  - OFF: Reminder times are shown as raw text
- Default: ON

## Reminder formats

### Date format

Format for reminder date without time.

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `YYYY-MM-DD`

### Date and time format

Format for reminder date time.

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `YYYY-MM-DD HH:mm`

### Link dates to daily notes

You can link dates to daily notes with this option.

- Type: `boolean`
- Values:
  - ON: Reminder date links to daily notes
  - OFF: Reminder date doesn't link to daily notes
- Default: OFF

Example (OFF)

```markdown
- [ ] Task (@2021-09-15 10:00)
```

Example (ON)

```markdown
- [ ] Task ([[@2021-09-15]] 10:00)
```

### Enable Tasks plugin format

Enable support for [Tasks Plugin](https://github.com/schemar/obsidian-tasks)

- Type: `boolean`
- Values:
  - ON: Enable Tasks plugin format
  - OFF: Disable Tasks plugin format (default)

### Distinguish between reminder date and due date

Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.

- Type: `boolean`
- Values:
  - ON: Reminder is set using ⏰
  - OFF: Reminder is set using 📅 (default)

### Remove tags from reminder title

If checked, the tags (#xxx) will be removed from the reminder title.
This setting affects only tasks plugin format.

- Type: `boolean`
- Values:
  - ON: Tags are removed
  - OFF: Tags are not removed (default)

### Enable Dataview format

Enable support for the [Dataview format](/guide/interop-dataview.html)
(`[due:: 2021-09-08]`), including the Tasks plugin's own Dataview task
format.

- Type: `boolean`
- Values:
  - ON: Enable Dataview format
  - OFF: Disable Dataview format (default)

### Reminder field name

The name of the inline field (e.g. `[reminder:: 2021-09-08]`) read as the
reminder date. On a line that also has a `due` field, this field takes
precedence — see [Distinguish due date and reminder
date](/guide/interop-dataview.html#distinguish-due-date-and-reminder-date).

- Type: `string`
- Default: `reminder`

### Enable Kanban plugin format

Enable support for [Kanban Plugin](https://github.com/mgmeyers/obsidian-kanban)

- Type: `boolean`
- Values:
  - ON: Enable Kanban plugin format
  - OFF: Disable Kanban plugin format (default)

## Display

You can customize how dates and times are displayed in the Reminder List and related UI. This affects:

- Group headers such as Year/Month, Today, Tomorrow, and weekday lines
- Time display for each reminder item

Four independent Moment-style display formats are available, plus the first day of the week used by the calendar popup.

### Year & month format

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `YYYY, MMMM`
- Example: `2025, August`

### Month & day format

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `MM/DD`
- Example: `08/03`

### Short date with weekday format

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `M/DD (ddd)`
- Example: `8/03 (Sun)`

### Time format

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `HH:mm`
- Example: `09:30`

### Presets

You can quickly apply a preset via the command palette:

- Command: “Set date display format”
- Presets include typical regional styles, e.g.:
  - US Style (12h): `MMMM YYYY`, `MM/DD`, `M/DD (ddd)`, `h:mm A`
  - US Style (24h): `MMMM YYYY`, `MM/DD`, `M/DD (ddd)`, `HH:mm`
  - EU Style (24h): `MMMM YYYY`, `DD/MM`, `D/MM (ddd)`, `HH:mm`
  - EU Style (12h): `MMMM YYYY`, `DD/MM`, `D/MM (ddd)`, `h:mm A`
  - JP Style (24h): `YYYY年MM月`, `MM/DD`, `M月D日 (ddd)`, `HH:mm`

Running the command opens a chooser with live examples. Selecting a preset immediately saves settings and refreshes the Reminder List.

### Week start

Select which day is considered the first day of the week. This affects the Calendar popup.

- Type: `select`
- Values: Localized weekday names Sunday, Monday, ... Saturday
- Default: `Sunday`

Notes:

- Changing this updates the calendar grid to start on your chosen day.
- Weekend highlighting adapts automatically based on this setting.

## Advanced

### Excluded files/folders

Reminders in these files/folders are ignored when scanning the vault, and any reminders already found in them are removed.

- Type: `string`
- Format: Line-separated list of vault-relative paths. One path per line.
  - An entry matches the file/folder itself and everything under it, on a path-segment boundary. For example, `Templates` excludes `Templates/Daily.md`, but not `Templates2/Daily.md`.
  - Leading/trailing slashes are ignored.
  - Matching is case-sensitive.
- Default: (empty)

Example

```
Templates
Archive/2020
```

Takes effect immediately; you don't need to restart Obsidian.

### Edit detection time

In order not to interfere with normal Markdown editing, the Reminder Plugin will not show reminders while the user is editing a file.
The value of this setting is the minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable.

This only applies to the [Modal popup style](#reminder-popup-style), which takes focus and would otherwise interrupt typing. The Toast popup style is not focus-stealing, so toasts appear immediately regardless of this setting.

- Type: `number`
- Value: The value of this setting is the minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. If this value is set to 0, the reminder will be displayed even if the file is being edited.
- Default: `10`

### Reminder check interval

Interval(in seconds) to periodically check whether or not you should be notified of reminders.  
You will need to restart Obsidian for this setting to take effect.

- Type: `number`
- Default: `5`
