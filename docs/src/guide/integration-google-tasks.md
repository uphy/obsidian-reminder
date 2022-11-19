# Google Tasks Integration

## How to synchronize

In the command pallete, run `Start Google Tasks synchronization`. This opens Google authentication page on your browser. After you logged in to the Google, follow the guide and click the `Open Obsidian` button.

When you click the button, Obsidian opens and you will get the notice saying `Successfully logged in to Google`.  After that, select or create a task list to be synchronized.

::: warning
Reminder time will not be applied to the Google Tasks' task.
This is [Google's API limiration](https://issuetracker.google.com/issues/128979662).
:::

## Mark as done reminder by Google Tasks

When you mark as done in Google Tasks, corresponding reminder will also be marked as done automatically.
But this is not real-time. When you forcibly synchronize, the change will be applied.
You can do this with [command](/guide/integration.html#forcibly-synchronize-reminders-to-external-services) or periodically(once an hour).
