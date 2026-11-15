# Note Reminders

A note reminder belongs to a whole note instead of a task line. Its time is a [property](https://help.obsidian.md/properties) of the note, so you can keep it in a column of an [Obsidian Bases](https://help.obsidian.md/bases) table, let another plugin write it, or set it from a dialog.

```markdown
---
follow-up: 2026-11-20
---

# Acme Corp
```

When November 20 comes, you are notified about the note `Acme Corp`, in the same [notification](/guide/notification.html) and [reminder list](/guide/list-reminders.html) as your task reminders.

Nothing is read until you tell the plugin which properties to use.

## Choose the properties to read

Open the plugin settings and go to the **Note reminders** tab.

1. Type the name of a date or date & time property (for example `follow-up`) and click **Add**.
2. The property appears as a block below, with a line for each of its settings:
   - **Managed**: whether the plugin may create, edit and remove the value. See [Managed and read-only properties](#managed-and-read-only-properties).
   - **Ignore dates before**: values dated before this day are not read. Empty unless the property already had past values when you added it. See [Past dates](#past-dates).

You can add as many properties as you like. Each one holds one date per note. If a note needs several reminders, use several properties or [task lines](/guide/set-reminders.html).

### Accepted values

| Value                 | Read as                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `2026-11-20`          | A date. You are notified at the [Reminder time](/setting/#reminder-time) that day. |
| `2026-11-20T09:00:00` | A date and time. `2026-11-20 09:00` works too.                                     |

These are the values Obsidian writes for the "Date" and "Date & time" property types. Anything else is ignored, including text, numbers, lists, and times with a UTC offset such as `2026-11-20T09:00:00+09:00` or `2026-11-20T09:00:00Z`.

### Managed and read-only properties

|                                              | Read only (default)                   | Managed                                                      |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Who writes the date                          | You, a Bases table, or another plugin | You, or the [reminder dialog](#set-a-reminder-from-a-dialog) |
| Notifications, **Done**, **Remind me later** | Yes                                   | Yes                                                          |
| Dialog, header bell                          | No                                    | Yes                                                          |
| Title from `<property>-title`                | No                                    | Yes                                                          |

Leave a property read-only when something else owns its value: a follow-up column you edit in a table, or a date another plugin maintains. The plugin never creates or removes such a value.

### Past dates

**Ignore dates before** is a day; values dated before it are not read. It is empty unless you need it.

When you add a property that your notes already use, and some of its values are in the past, **Ignore dates before** is set to today. Without it, a property that already holds years of dates across your vault would notify you about all of them at once. The setting tells you how many values it currently ignores. A property with no past values is added with the setting empty.

You can move the date back to be reminded about older values, clear it to read everything, or set one yourself.

Things to know:

- A date before the cut-off is never shown, even if you type it today.
- If you remove a property and add it again, the cut-off is decided again that day. Reminders that were overdue and not yet done are hidden until you move the date back.

## What Done and Remind me later do

Both write to the note's properties and nowhere else, so a reminder you handled stays handled on every device that syncs the note.

### Done

**Done** does not change the date. It records the date you were reminded about in a second property, `<property>-done`:

```markdown
---
follow-up: 2026-11-20
follow-up-done: 2026-11-20
---
```

A reminder is waiting while the two differ. So when you (or a table, or another plugin) write the next date, the note reminds you again without any other step:

```markdown
---
follow-up: 2026-12-05
follow-up-done: 2026-11-20
---
```

To be reminded again about the **same** date, delete `<property>-done` in the note's properties. For a managed property you can also open the dialog and click **Remind again**.

:::tip
If your vault already uses a property named `<property>-done` for something else (a checkbox column, for example), **Done** cannot record anything there: it shows a notice and leaves the note alone. The property's block in the settings warns you when it finds such values. Use a different property name for the reminder, or rename your column.
:::

### Remind me later

**Remind me later** moves the date, as you would by hand. The value keeps its type: a date stays a date, and a date and time stays a date and time.

- For a date without a time, only the options that move by whole days are offered (**Tomorrow**, **Next week**, and so on). "In 30 minutes" cannot be written into a date.
- For a date and time, a whole-day option moves the reminder to that day at the [Reminder time](/setting/#reminder-time).

### When the note changes under an open notification

If the date in the note is no longer the one a notification was shown for (another plugin moved it, or you handled it on another device), **Done** and **Remind me later** on that notification write nothing.

## Set a reminder from a dialog

For a **managed** property, you do not have to type the property yourself.

1. Click the bell in the note's header. You can also run the command **Set reminder for this note**, or right-click a note and choose the same item (it reads **Edit this note's reminder** when the note already has one).
2. The first time, the plugin offers to keep note reminders in a property named `reminder`. Accepting adds it to the settings as a managed property. (You can instead add your own property in the settings and turn on **Managed**.)
3. Pick a date, optionally a time, a title and a [repeat rule](#repeat-a-reminder), and click **OK**.

```markdown
---
reminder: 2026-11-21T09:00:00
reminder-title: Send the report
---
```

The title is used in the notification and the list. Without one, the note's name is used.

The bell in the note's header shows the state of the note and opens the dialog, where you can change the time or title, **Mark as Done**, or **Remove reminder**:

| Bell                  | The note has                                          |
| --------------------- | ----------------------------------------------------- |
| Ringing bell          | A waiting reminder. Hover to see its time.            |
| Faint bell            | A reminder that is done, or dated before the cut-off. |
| Faint bell with a "+" | No reminder yet.                                      |

If you would rather keep note headers empty, turn off [Show a bell in every note's header](/setting/#show-a-bell-in-every-note-s-header): the bell is then shown only while a reminder is waiting.

**OK** saves what the dialog shows. A new reminder starts with the [Reminder time](/setting/#reminder-time); pick another time if you like. For a reminder without a time (a date), untick the box next to the time: you are then notified at the Reminder time, whatever that setting is on the day.

:::tip
Obsidian keeps one type per property name for the whole vault. If `reminder` is typed "Date", a value with a time is shown as plain text in the properties panel and in Bases; if it is typed "Date & time", a date is shown with `00:00`. Reminders work either way. Pick one kind of value per property if you care about how it looks.
:::

## See the state in a Bases table

A note reminder has no checkbox: it is done when the property and its `-done` companion hold the same date. A formula column shows that in a [Bases](https://help.obsidian.md/bases) table.

Create a file named `Follow-ups.base` with this content (replace `follow-up` with your property):

```yaml
filters:
  and:
    - '!note["follow-up"].isEmpty()'
formulas:
  follow_up_state: 'if(note["follow-up"].isEmpty(), "", if(note["follow-up"].toString() == note["follow-up-done"].toString(), "✅ done", if(note["follow-up"] < now(), "🔴 overdue", "⏳ scheduled")))'
properties:
  formula.follow_up_state:
    displayName: State
views:
  - type: table
    name: Follow-ups
    order:
      - file.name
      - note.follow-up
      - formula.follow_up_state
```

| name  | follow-up  | State        |
| ----- | ---------- | ------------ |
| Alice | 2026-11-10 | ✅ done      |
| Bob   | 2026-11-12 | 🔴 overdue   |
| Carol | 2026-12-01 | ⏳ scheduled |

- Edit a date in the `follow-up` column and the row goes back to "scheduled" or "overdue", and the plugin reminds you at the new date.
- Press **Done** on a notification and the row becomes "done".
- A property name that contains a hyphen has to be written as `note["follow-up"]` in a formula.
- The two values are compared as text (`.toString()`), the way the plugin compares them. Compared as dates, a date and a date and time on the same day would count as equal, and the table would say "done" for a reminder that is still waiting.

To add the column to a table you already have, add the `formulas` entry and put `formula.follow_up_state` in the view's `order`.

The formula does not know about [Ignore dates before](#past-dates): an old date that the plugin ignores still shows as "overdue" in the table.

## Use a date another plugin writes

Any plugin that keeps a date in a property can drive a reminder. For example, the [Spaced Repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) plugin stores a note's next review date in `sr-due`:

1. Add `sr-due` in the **Note reminders** tab and leave it read-only.
2. On the review date you are notified about the note.
3. Review the note in Spaced Repetition. It writes the next date into `sr-due`, and the note reminds you again on that date.

**Done** only records `sr-due-done`; it never touches `sr-due`. **Remind me later** changes `sr-due` itself, which Spaced Repetition treats like any other due date.

Notes that were already overdue when you added the property are hidden by [Ignore dates before](#past-dates). Move that date back if you want them too.

## Repeat a reminder

A reminder on a **managed** property can repeat. Type a rule into **Repeat** in the dialog, or write it yourself in `<property>-repeat`:

```markdown
---
reminder: 2026-11-20T09:00:00
reminder-title: Pay the rent
reminder-repeat: every month
---
```

The rule is the same text the [Tasks plugin format](/guide/interop-tasks.html) accepts after 🔁: `every day`, `every week on Monday`, `every 2 weeks`, `every month`, `every month on the 1st`, `every year`, with an optional `until 2027-12-31`. Add `when done` (`every week when done`) to count from the day you press **Done** instead of from the reminder's date.

**Done** on a repeating reminder records the handled time in `reminder-done`, as always, and moves `reminder` to the next occurrence:

```markdown
---
reminder: 2026-12-20T09:00:00
reminder-title: Pay the rent
reminder-repeat: every month
reminder-done: 2026-11-20T09:00:00
---
```

- **Remind me later** postpones one occurrence only. The plugin notes the postponed occurrence in `reminder-occurrence` until you press **Done**, so a monthly reminder snoozed from the 20th to the 21st comes back on the 20th of next month. Changing the date yourself (in the dialog, the properties panel or Bases) is different: the series continues from the date you chose.
- Occurrences that are already in the past when you press **Done** are skipped, as for a repeating task line.
- When the rule has an end (`until ...`) and no occurrence is left, **Done** just completes the reminder.
- A rule the plugin can't read is flagged in the dialog. If such a rule is in the note anyway, **Done** completes the reminder and a notice tells you it will not repeat.
- `-repeat` is ignored on properties that are not managed: there the date belongs to whatever writes it.

## Good to know

- **Writing reformats the note's properties.** **Done**, **Remind me later** and the dialog change properties through Obsidian, exactly as editing a property in the properties panel does. Obsidian rewrites the whole block when it does that: YAML comments are dropped and quoting and list style are normalized.
- **Excluded notes are not read.** Notes under [Excluded files/folders](/setting/#excluded-files-folders) have no note reminders, and the command is unavailable there.
- **Half-typed properties.** While a note's properties are not valid YAML (for instance, in the middle of an edit in source mode), the note has no note reminders. They come back when it is valid again.
- **Several devices.** The list of properties and their cut-off dates are plugin settings. Devices that should show the same reminders need the same settings, as with the other settings that decide what is read. This matters most with [ntfy](/setting/#ntfy): a device with different settings can remove notifications another device scheduled.
- **Going back to an older version.** An older version of the plugin does not know this setting and drops it when it saves. Your notes keep their `-done` records, so after upgrading again you only need to add the properties back (and move **Ignore dates before** back if needed).
