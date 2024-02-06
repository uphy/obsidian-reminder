# Service Integration

The Obsidian Reminder Plugin supports synchronizing reminders to external services.

## Single-directional Synchronization

The synchronization is single-directional: from Obsidian Reminder Plugin to external services. For instance, when you insert, modify, or remove reminders in your markdown files, the changes will be applied to the external services. However, if you insert, modify, or remove tasks in the external services, these changes will not be reflected in your markdown files.

::: tip
An exception to this rule is the Google Tasks integration, which supports check status synchronization. Refer to [Google Tasks](/guide/integration-google-tasks) for more details.
:::

## Limitations

For performance and memory efficiency reasons, Obsidian Reminder Plugin removes tasks from external services when you mark reminders as done in markdown files. Although this behavior may seem counterintuitive, it helps reduce memory usage, network usage (by avoiding fetching all tasks from external services), and synchronization computing costs.

Additionally, Obsidian Reminder Plugin caches the external task list. It periodically checks for differences between the internal reminder list and the external service's task list. To minimize the number of API calls to external services, Obsidian Reminder Plugin caches the external task list in memory. However, manually modifying the external services' task list may cause synchronization failures. To prevent this issue, it's recommended to create a dedicated task list for Obsidian Reminder Plugin within the external service and avoid manual modifications.

## Common Commands

Here are some common commands that can be executed via the command palette:

### Forcibly Synchronize Reminders to External Services

This command fetches all tasks from external services and completely synchronizes the reminders without using cache. It's useful when there are issues with the synchronization status of external services.

### Stop All Google Synchronization

This command removes all authentication tokens and selected task list information associated with Google synchronization.

## Use Cases

- Receive notifications even when not using Obsidian.
- Manage reminders using familiar tools supported by Obsidian Reminder Plugin.

## Supported Services

- [Google Tasks](/guide/integration-google-tasks)
- [Google Calendar](/guide/integration-google-calendar)