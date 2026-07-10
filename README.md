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

If you use the [Natural Language Dates](https://uphy.github.io/obsidian-reminder/guide/interop-nldates.html) plugin, see the guide for how to avoid the `@` autocompletion conflict.

### Guide

https://uphy.github.io/obsidian-reminder/

### FAQ

- Notification in mobile (Android/iOS)
  - System notification in mobile device is not available because Obsidian doesn't provide the feature.

### Development

Requires [mise](https://mise.jdx.dev/) (which provides the pinned Node.js version), or Node.js 22 with plain npm.

```bash
mise run main:init      # install dependencies
mise run dev            # watch build; rebuilds on every save
mise run main:test      # run the test suite
mise run main:lint:fix  # eslint --fix + tsc --noEmit + svelte-check
```

To try your changes in a real vault, symlink this repository into the vault's plugin directory and install the [hot-reload](https://github.com/pjeby/hot-reload) plugin:

```bash
ln -s /path/to/obsidian-reminder /path/to/vault/.obsidian/plugins/obsidian-reminder-plugin
```

With `mise run dev` running, every save rebuilds the plugin and hot-reload reloads it in Obsidian automatically. See [CLAUDE.md](CLAUDE.md) for an overview of the codebase and the release flow.

### Support

<a href="https://www.buymeacoffee.com/uphy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>