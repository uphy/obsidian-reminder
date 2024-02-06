# Google Tasks Integration

## How to Sync

To synchronize with Google Tasks, follow these steps:

1. Open the command palette and execute `Start Google Tasks synchronization`. This action will open the Google authentication page in your default web browser.
2. Sign in to your Google account if prompted. Follow the on-screen instructions and grant the necessary permissions.
3. After logging in, click the `Open Obsidian` button. Obsidian will open, and you'll receive a notification confirming that you have successfully logged in to Google.
4. Once logged in, select an existing task list or create a new one that you wish to synchronize with Obsidian.

::: warning
Reminder times set in Obsidian will not be applied to Google Tasks due to a [limitation in Google's API](https://issuetracker.google.com/issues/128979662).
:::

## Marking Tasks as Done in Google Tasks

When you mark a task as done in Google Tasks, the corresponding reminder will also be marked as done automatically. However, this is not in real-time. The changes will be applied when you forcibly synchronize. You can do this using the [command](/guide/integration.html#forcibly-synchronize-reminders-to-external-services) or by setting up periodic synchronization (e.g., once an hour).