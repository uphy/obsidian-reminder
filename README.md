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

### FAQ

- Interoperability between this plugin and [nldates-obsidian](https://github.com/argenos/nldates-obsidian)
  - [nldates-obsidian](https://github.com/argenos/nldates-obsidian) also provides auto complete with `@` character.
  - The autocompletion conflicts with this plugin
  - I'm planning to provide a setting to change completion trigger.
  - If you have any opinion, please post it in [#4](https://github.com/uphy/obsidian-reminder/issues/4)

### TODO

- [ ] Reminder input support (develop a CodeMirror plugin)
- [ ] More settings
  - [ ] Date time format
  - [ ] Use system notification
