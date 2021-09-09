## Obsidian Reminder Plugin

Reminder plugin for Obsidian. This plugin adds feature to manage markdown TODOs with reminder.

### Features

#### Set Reminders

You can set reminders for TODO list items with the following format.

```markdown
- [ ] This is a sample task with reminder (@2021-08-14)
- [ ] Also you can specify time (@2021-08-14 09:37)
- [x] You will not be notified about the reminders you have already checked. (@2021-08-14)
```

If you input `(@` (start of the reminder date time), calendar popup to set the reminder date time will show.
<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/input-reminder-time.gif" width="600" />

Note: This popup trigger can be changed by setting.

#### List Reminders

You can view the list of reminders contained in all files.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-list.png" width="600" />

If you click the reminder list item, the source markdown file will be appeared.

#### Reminder Notification

Reminder will be notified on Obsidian when the time comes.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-notification1.png" width="600" />

If you click `Mark as Done`, your check list item will be checked.
Alternatively, you can postpone the reminder by selecting `Remind Me Later`.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-notification2.png" width="600" />

Also you can receive notification with System Notification.
Check `Use system notification` setting.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/system-notification.png" width="300" />

### Customization

#### Date Format

You can change date time format with command (Command palette > Convert reminder time format).
This command replace all existing markdown files.
Please execute carefully.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/convert-date-time-format.gif" width="300" />

More formats can be set via setting page.

#### Interoperability with other plugins

In addition to original format `@YYYY-MM-DD`, this plugin also supports following plugin formats.

- [Obsidian Tasks](https://github.com/schemar/obsidian-tasks) (e.g. `📅 2021-05-02`)
- [Kanban](https://github.com/mgmeyers/obsidian-kanban) (e.g. `@{YYYY-MM-DD}`)

They can be enabled by `Reminder Format` section in setting.

For [nldates-obsidian](https://github.com/argenos/nldates-obsidian) users, the autocompletion(`@`) conflicts with this plugin.
You can change the popup trigger string to another by setting.

### FAQ

- Notification in mobile (Android/iOS)
  - System notification in mobile device is not available because Obsidian doesn't provide the feature.
