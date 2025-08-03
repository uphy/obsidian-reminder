---
sidebar: auto
---

# Config

## Reminder Time

Time when a reminder with no time part will show.

- Type: `string`
- Format: `HH:mm` (HH: hour, mm: minute)
- Default: `09:00`

## Reminder Time Step

Step of time for reminder time.

- Type: `number`
- Default: `15`

## Date format

Format for reminder date without time.

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `YYYY-MM-DD`

## Date and time format

Format for reminder date time.

- Type: `string`
- Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
- Default: `YYYY-MM-DD HH:mm`

## Calendar popup trigger

Trigger to show calendar popup.

- Type: `string`
- Format: Any string. If you make this setting empty string, calendar popup will be disabled.
- Default: `(@`

## Primary reminder format

Reminder format for generated reminder by calendar popup.

- Type: `select`
- Values:
  - [Reminder plugin format](/guide/set-reminders.html#reminder-format)
  - [Tasks plugin format](/guide/interop-tasks.html)
  - [Kanban plugin format](/guide/interop-kanban.html)

## Link dates to daily notes

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

## Remind me later

You can change option which will be shown when you click `Remind Me Later` button in the [notification](/guide/notification.html).

- Type: `string`
- Format: Line-separated following options
  - In N minutes/hours/days/weeks/months/years
  - Next Sunday/Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/day/week/month/year
  - Tomorrow

## Use system notification

Use system notification instead of builtin notification.

Only available on desktop OS.

- Type: `boolean`
- Values:
  - ON: Use system notification. In mobile devices, this setting is ignored and builtin notification is used.
  - OFF: Use builtin notification

## Enable Tasks plugin format

Enable support for [Tasks Plugin](https://github.com/schemar/obsidian-tasks)

- Type: `boolean`
- Values:
  - ON: Enable Tasks plugin format
  - OFF: Disable Tasks plugin format (default)

## Distinguish between reminder date and due date

Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.

- Type: `boolean`
- Values:
  - ON: Reminder is set using ⏰
  - OFF: Reminder is set using 📅 (default)

## Remove tags from reminder title

If checked, the tags (#xxx) will be removed from the reminder title.
This setting affects only tasks plugin format.

- Type: `boolean`
- Values:
  - ON: Tags are removed
  - OFF: Tags are not removed (default)

## Enable Kanban plugin format

Enable support for [Kanban Plugin](https://github.com/mgmeyers/obsidian-kanban)

- Type: `boolean`
- Values:
  - ON: Enable Kanban plugin format
  - OFF: Disable Kanban plugin format (default)

## Edit Detection Time

In order not to interfere with normal Markdown editing, the Reminder Plugin will not show reminders while the user is editing a file.
The value of this setting is the minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable.

- Type: `number`
- Value: The value of this setting is the minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. If this value is set to 0, the reminder will be displayed even if the file is being edited.
- Default: `10`

## Week start

Select which day is considered the first day of the week. This affects the Calendar popup.

- Type: `select`
- Values: Localized weekday names Sunday, Monday, ... Saturday
- Default: `Sunday`

Notes:

- Changing this updates the calendar grid to start on your chosen day.
- Weekend highlighting adapts automatically based on this setting.

## Reminder check interval

Interval(in seconds) to periodically check whether or not you should be notified of reminders.  
You will need to restart Obsidian for this setting to take effect.

- Type: `number`

## Date/Time Display Format

You can customize how dates and times are displayed in the Reminder List and related UI. This affects:

- Group headers such as Year/Month, Today, Tomorrow, and weekday lines
- Time display for each reminder item

Four independent Moment-style display formats are available:

- Year & Month Format

  - Type: `string`
  - Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
  - Default: `YYYY, MMMM`
  - Example: `2025, August`

- Month & Day Format

  - Type: `string`
  - Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
  - Default: `MM/DD`
  - Example: `08/03`

- Short Date with Weekday Format

  - Type: `string`
  - Format: [momentjs format](https://momentjs.com/docs/#/displaying/format/)
  - Default: `M/DD (ddd)`
  - Example: `8/03 (Sun)`

- Time Format
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

- Default: `5`
