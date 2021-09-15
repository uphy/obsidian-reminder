# Set Reminders

## Reminder Format

You can set reminders by putting `(@YYYY-MM-DD HH:mm)` to the TODO list.

```markdown
- [ ] Task 1 (@2021-09-15 20:40)
```

Time is omittable.

```markdown
- [ ] Task 1 (@2021-09-15)
```

When you omit the time, reminder will be notified at [default reminder time](/setting/#reminder-time).

## Date Time Format

You can change time format by setting.
See following settings.

- [Date Format](/setting/#date-format)
- [Date and Time Format](/setting/#date-and-time-format)

## Reminder date input support

To make it easy to set reminder times, this plugin provides calendar popup.

When you input `(@` in TODO list item, you will see calendar popup.  

<img :src="$withBase('/images/reminder-input-support.png')" width="400px">

This popup trigger `(@)` can be changed with [calendar popup trigger](/setting/#calendar-popup-trigger) setting.

In this popup, you can select date with keyboard. 

- <kbd>Left</kbd>(or <kbd>Ctrl</kbd>+<kbd>B</kbd>): 1 day ago
- <kbd>Right</kbd>(or <kbd>Ctrl</kbd>+<kbd>F</kbd>): 1 day later
- <kbd>Up</kbd>(or <kbd>Ctrl</kbd>+<kbd>P</kbd>): 1 week ago
- <kbd>Down</kbd>(or <kbd>Ctrl</kbd>+<kbd>N</kbd>): 1 week later
- <kbd>Enter</kbd>: Select date
- <kbd>Esc</kbd>: Cancel input support

When you select date, the selected date will be entered into the file.

You can change the format by [primary reminder format](/setting/#primary-reminder-format) setting.

## Link dates to daily notes

Obsidian has a feature to create [daily notes](https://help.obsidian.md/Plugins/Daily+notes).  
You can create links to daily notes in reminder.

First, you have to set [Link dates to daily notes](/setting/#link-dates-to-daily-notes) option ON.

After that, the time part of the reminder will be the link.

```markdown
- [ ] Task 1 (@[[2021-09-15]] 20:40)
```

::: tip
You need to change existing reminder date manually.
:::
