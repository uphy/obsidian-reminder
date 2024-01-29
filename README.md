## Obsidian Reminder Plugin

[Reminder plugin](https://uphy.github.io/obsidian-reminder/) for Obsidian. This plugin adds feature to manage markdown TODOs with reminder.

### Features

#### Set Reminders

You can [set reminders](https://uphy.github.io/obsidian-reminder/guide/set-reminders.html) for TODO list items with the following format.

```markdown
- [ ] This is a sample task with reminder (@2021-08-14)
- [ ] Also you can specify time (@2021-08-14 09:37)
- [x] You will not be notified about the reminders you have already checked. (@2021-08-14)
```

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/input-reminder-time.gif" width="600" />

#### List Reminders

You can [view the list of reminders](https://uphy.github.io/obsidian-reminder/guide/list-reminders.html) contained in all files.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-list.png" width="600" />

If you click the reminder list item, the source markdown file will be appeared.

#### Reminder Notification

Reminder will be [notified](https://uphy.github.io/obsidian-reminder/guide/notification.html) on Obsidian when the time comes.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-notification1.png" width="600" />

If you click `Mark as Done`, your check list item will be checked.
Alternatively, you can postpone the reminder by selecting `Remind Me Later`.

<img src="https://raw.githubusercontent.com/uphy/obsidian-reminder/master/images/reminder-notification2.png" width="600" />


#### Interoperability with other plugins

In addition to original format `@YYYY-MM-DD`, this plugin also supports following plugin formats.

- [Obsidian Tasks](https://uphy.github.io/obsidian-reminder/guide/interop-tasks.html) (e.g. `📅 2021-05-02`)
- [Kanban](https://uphy.github.io/obsidian-reminder/guide/interop-kanban.html) (e.g. `@{YYYY-MM-DD}`)

### Guide

https://uphy.github.io/obsidian-reminder/

### FAQ

- Notification in mobile (Android/iOS)
  - System notification in mobile device is not available because Obsidian doesn't provide the feature.

### Support

<a href="https://www.buymeacoffee.com/uphy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>