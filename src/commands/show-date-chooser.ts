import type ReminderPlugin from 'main';
import type { Reminders } from 'model/reminder';
import type { Editor } from 'obsidian';
import type { AutoComplete } from 'ui/autocomplete';

export function showDateChooser(
  checking: boolean,
  editor: Editor,
  plugin: ReminderPlugin,
  autoComplete: AutoComplete,
  reminders: Reminders,
): boolean | void {
  if (checking) {
    return true;
  }

  autoComplete.show(plugin.app, editor, reminders);
}
