# Service Integration

Obsidian Reminder Plugin supports to synchronize the reminders to external services.

## Single-directional Synchronization

The synchronization is single-directional; Obsidian Reminder Plugin to external services.
For example, when you insert/modify/remove the reminders in your markdown file, the changes will
be applied to the external services. In contrast, even if you insert/modify/remove the tasks in the
external services, the changes will not be applied to your markdown files.

::: tip
Exceptionally, Google Tasks integration has check status synchronization.  See [Google Tasks](/guide/integration-google-tasks) for more details.
:::

## Limitations

For performance and memory efficiency, Obsidian Reminder Plugin removes external services' tasks
when you mark as done the reminders in markdown files. The behavior seems a bit strange but this reduces the memory usage, network usage(getting all tasks from external services), synchronization computing cost.

Also, Obsidian Reminder Plugin caches the external task list.
Obsidian Reminder Plugin checks differences between the internal reminder list and external service's task list periodically. To reduce external service's API call, Obsidian Reminder Plugin caches the external task list on memory.
This may cause a synchronization failure when you modify external services task list manually. To avoid this problem, I recommend you to create a task list of the external service only for Obsidian Reminder Plugin and you shouldn't modify it manually.

## Common commands

Some common commands which can be ran via command pallete.

### Forcibly synchronize reminders to external services

Fetch all tasks from external services and completely synchronize the reminders without using cache.
This is convenient when something is wrong with the external services synchronization status.

### Stop all Google synchronization

You can remove all authentication tokens and selected task list information by this command.

## Usecases

- Getting notification even when you are not using Obsidian
- Checking your reminders with your familiar (and Obsidian Reminder Plugin supported) tools.

## Supported Services

- [Google Tasks](/guide/integration-google-tasks)
- [Google Calendar](/guide/integration-google-calendar)
