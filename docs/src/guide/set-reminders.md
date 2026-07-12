# Set Reminders

## Reminder Format

You can set reminders by putting `(@YYYY-MM-DD HH:mm)` to the TODO list.

```markdown
- [ ] Task 1 (@2021-09-15 20:40)
```

Any of `-`, `*`, or `+` can be used as the list marker.

Time is omittable.

```markdown
- [ ] Task 1 (@2021-09-15)
```

When you omit the time, reminder will be notified at [default reminder time](/setting/#reminder-time).

::: tip
Reminder plugin is interoperable with other plugins which has different date time format.  
For more information on interoperability, please click [here](/guide/interop-tasks).
:::

## Recurring reminders

You can make a reminder recur by appending `🔁` and a recurrence rule inside the parentheses, after the date/time.

```markdown
- [ ] Water plants (@2026-07-13 09:00 🔁every monday)
- [ ] Pay rent (@2026-08-01 🔁every month)
```

The recurrence rule uses the same natural-language vocabulary as the [Tasks plugin format](/guide/interop-tasks.html) (`every day`, `every 2 weeks`, `every month on the 1st`, `every day until 2026-12-31`, `every day for 3 times`, …).

When a recurring reminder is completed (via the [notification's "Mark as Done"](/guide/notification.html) button, or the `Toggle checklist status` command/hotkey), a new unchecked TODO line for the next occurrence is inserted above the completed line, and the recurrence rule is carried over to it.

::: tip
Snoozing ("Remind me later") re-anchors the series: the next occurrence after completion is computed from the snoozed time, not the original one.
:::

::: warning
Recurrence only takes effect when the reminder is completed through this plugin (the notification modal or the `Toggle checklist status` command/hotkey). Clicking the native checkbox directly in the editor (live preview or reading mode) — or having another plugin edit the file — just flips `[ ]` to `[x]` without going through the plugin, so no next occurrence is inserted.
:::

## Date Time Format

You can change time format by setting.
See following settings.

- [Date Format](/setting/#date-format)
- [Date and Time Format](/setting/#date-and-time-format)
- For display formats (how dates/times are shown in the UI), see the [Display](/setting/#display) settings

## Reminder date input support

To make it easy to set reminder times, this plugin provides calendar/time picker popup.  
By clicking on the calendar, the date will be entered into the markdown file.
Also, you can set reminder time with time picker.

::: tip

- You can change the format by [primary reminder format](/setting/#primary-reminder-format) setting.
- Time step in time picker is set by [Reminder time step (minutes)](/setting/#reminder-time-step-minutes) setting.

:::

::: tip
The calendar popup can only insert a reminder into a checklist/task line (e.g. `- [ ] Task`). On other lines, a notice is shown instead.
:::

There are multiple ways to display the calendar popup.

### Key input trigger (Desktop only)

When you input `(@` in TODO list item, you will see calendar/time picker popup. In Live Preview, the popup appears inline, right next to the cursor. It's dismissed with <kbd>Esc</kbd> or by clicking outside of it.

<img :src="$withBase('/images/reminder-input-support.png')" width="400px">

This popup trigger `(@` can be changed with [calendar popup trigger](/setting/#calendar-popup-trigger) setting.

In this popup, you can select date and time by calendar and time picker dropdown.

#### Keybindings

You can use keyboard to select date and time.

##### Calendar

The default focus is on the calendar.

- <kbd>Left</kbd>(or <kbd>Ctrl</kbd>+<kbd>B</kbd>): 1 day ago
- <kbd>Right</kbd>(or <kbd>Ctrl</kbd>+<kbd>F</kbd>): 1 day later
- <kbd>Up</kbd>(or <kbd>Ctrl</kbd>+<kbd>P</kbd>): 1 week ago
- <kbd>Down</kbd>(or <kbd>Ctrl</kbd>+<kbd>N</kbd>): 1 week later
- <kbd>Enter</kbd>: Select date
- <kbd>Esc</kbd>: Cancel input support
- <kbd>(Number)</kbd>: Select date of the current month (1st ~ 9th)
- <kbd>(Number)(Number)</kbd>: Select date of the current month (1th ~ 31st)
- <kbd>(Number)(Number)(Number)(Number)</kbd>: Select date of the current year (e.g. 0115 -> January 15th)

##### Time Picker

You can move focus to time picker by <kbd>Tab</kbd> key.

- <kbd>(Number)</kbd>: Select hour (00 ~ 09)
- <kbd>(Number)(Number)</kbd>: Select hour (00 ~ 23)
- <kbd>(Number)(Number)(Number)(Number)</kbd>: Select hour/minute (00:00 ~ 23:59)

### Command trigger

Open the command palette and search `Show calendar popup`.
It will open the calendar popup.

Unlike the inline popup shown when typing the trigger, this always opens as a dialog — this is also how the calendar popup is shown on mobile.

::: tip
For mobile users, it would be useful to add a button to the toolbar at the bottom of the markdown editor to show the calendar popup.

1. `Options` > `Mobile`
2. `Configure`
3. Select the command named `Show calendar popup`
   :::

### Using the trigger on a non-task line

If you pick a date while the cursor is on a line that isn't a task list item, that line is automatically converted into an unchecked task (`- [ ] `) before the reminder is inserted. Bullets get a checkbox; plain text and empty lines get `- [ ] ` prepended.

Headings, numbered lists, table rows, and code fences are not converted — a notice is shown instead, and nothing is inserted.

This behavior is controlled by [Convert non-task lines when inserting a reminder](/setting/#convert-non-task-lines-when-inserting-a-reminder). If you disable it, a notice is always shown for non-task lines instead of converting them.

## Toggle checklist status

This plugin provides 2 ways to toggle checklist status.

::: tip
If you are using [Tasks Plugin format](/guide/interop-tasks.html), this action do the following additionally:

- Insert done date (`✅ YYYY-MM-DD`)
- Create next recurring task (if you use `🔁 XXX`)
  :::

**By keyboad shortcut**

By default, <kbd>Meta</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> to toggle checklist status.  
You can change it from `Obsidian > Settings > Hotkeys > Reminder: Toggle checklist status`.

**From reminder notification**

You can `Mark as Done` from [reminder notification](/guide/notification.html).

## Link dates to daily notes

Obsidian has a feature to create [daily notes](https://help.obsidian.md/Plugins/Daily+notes).  
You can create links to daily notes in reminder.

First, you have to set [Link dates to daily notes](/setting/#link-dates-to-daily-notes) option ON.

After that, the date part of the reminder will become the link.

```markdown
- [ ] Task 1 (@[[2021-09-15]] 20:40)
```

::: tip
You need to change existing reminder date manually.
:::

## Canceling a reminder

You can create a TODO item that is not a reminder by formatting it as `- [-] xxx`.

```markdown
- [-] Task 1 (@2024-12-24)
```
