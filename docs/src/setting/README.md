---
sidebar: auto
---

# Config

## Reminder Time

Time when a reminder with no time part will show.

- Type: `string`
- Format: `HH:mm` (HH: hour, mm: minute)
- Default: `09:00`

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
- Format: Any string.  If you make this setting empty string, calendar popup will be disabled.
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