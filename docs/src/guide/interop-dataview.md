# Dataview Format

The Tasks plugin's "dataview format" (also usable on its own, without the
Tasks plugin, since [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
inline fields are plain text) writes task metadata as inline fields instead
of emoji:

```markdown
- [ ] Buy milk [due:: 2025-05-17]
```

If you enable [this setting](/setting/#enable-dataview-format), the above
line is recognized as a reminder, firing on 2025-05-17 at the [default
reminder time](/setting/#reminder-time).

Neither the Tasks plugin nor Dataview needs to be installed: this plugin
only reads and writes the `[key:: value]` text, so enabling this format
never depends on any other plugin.

## Field table

| Field | Meaning |
| --- | --- |
| `due` | Due date. Used as the reminder date when no reminder field (below) is present. |
| [reminder field name](/setting/#reminder-field-name) (default `reminder`) | A reminder date/time distinct from `due`. When present on a line, it wins over `due` for that line — no global toggle needed, unlike the Tasks plugin's own ⏰/📅 distinction. |
| `completion` | Written automatically when the task is marked done. |
| `repeat` | Recurrence text (e.g. `every week`), same syntax as the Tasks plugin's 🔁. |
| `scheduled`, `start` | Recognized so they're stripped from the notification title, but otherwise unused. |

Fields can be written with either delimiter style:

```markdown
- [ ] Buy milk [due:: 2025-05-17]
- [ ] Buy milk (due:: 2025-05-17)
```

Any other inline field (e.g. `[priority:: high]`) is left untouched in the
notification title.

## Time part

Like the [Tasks plugin format](/guide/interop-tasks.html), a time can be
added to the due date or the reminder field:

```markdown
- [ ] Buy milk [due:: 2025-05-17T09:00]
- [ ] Buy milk [due:: 2025-05-17 09:00]
```

Both the `T`-separated (Dataview's native datetime shape) and the
space-separated shapes are accepted when reading. When the plugin itself
writes a value back (snooze, calendar popup, recurrence), it always uses
the `T`-separated shape so the value stays parsable by Dataview as a real
datetime.

::: warning Note
Field values are parsed strictly as `YYYY-MM-DDTHH:mm`, `YYYY-MM-DD HH:mm`,
or `YYYY-MM-DD`. Any other value (including trailing garbage) is ignored —
that line simply won't produce a reminder. This format isn't affected by
the [Strict Date format](/setting/#strict-date-format) setting, since these
values are machine-formatted to begin with.
:::

## Distinguish due date and reminder date

Set the [reminder field name](/setting/#reminder-field-name) (default
`reminder`) and add that field to a line that also has `due`:

```markdown
- [ ] Buy milk [reminder:: 2025-05-16 18:00] [due:: 2025-05-17]
```

The reminder fires on 2025-05-16 18:00 (not 2025-05-17). Snoozing this
reminder rewrites the `reminder` field, leaving `due` untouched.

## Recurring tasks

```markdown
- [ ] Buy milk [repeat:: every week] [due:: 2025-05-17]
```

When you [toggle checklist status](/guide/set-reminders.html#toggle-checklist-status),
the next occurrence is inserted above (with `due`, and the reminder field
when present, both advanced), and the completed line gets a `completion`
field:

```markdown
- [ ] Buy milk [repeat:: every week] [due:: 2025-05-24]
- [x] Buy milk [repeat:: every week] [due:: 2025-05-17] [completion:: 2025-05-17]
```

## Works with the Tasks plugin's Dataview task format

This is the same syntax the Tasks plugin itself writes when its own [Task
format setting](https://publish.obsidian.md/tasks/Reference/Task+Formats/About+Task+Formats)
is set to "Dataview". If you already use the Tasks plugin in that mode,
enabling this format is all that's needed for its tasks to also produce
reminders — see the [Tasks plugin
guide](/guide/interop-tasks.html#using-the-tasks-plugin-s-dataview-task-format)
for the reverse pointer.
