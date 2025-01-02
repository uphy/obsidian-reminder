import type ReminderPlugin from 'main';
import type { Reminders } from 'model/reminder';
import type { AutoComplete } from 'ui/autocomplete';
import { scanReminders } from './scan-reminders';
import { showReminderList } from './show-reminder-list';
import { convertReminderTimeFormat } from './convert-reminder-time-format';
import { showDateChooser } from './show-date-chooser';
import { toggleChecklistStatus } from './toggle-checklist-status';

export function registerCommands(plugin: ReminderPlugin, autoComplete: AutoComplete, reminders: Reminders) {
  plugin.addCommand({
    id: 'scan-reminders',
    name: 'Scan reminders',
    checkCallback: (checking: boolean) => {
      return scanReminders(checking, plugin);
    },
  });

  plugin.addCommand({
    id: 'show-reminders',
    name: 'Show reminders',
    checkCallback: (checking: boolean) => {
      return showReminderList(checking, plugin);
    },
  });

  plugin.addCommand({
    id: 'convert-reminder-time-format',
    name: 'Convert reminder time format',
    checkCallback: (checking: boolean) => {
      return convertReminderTimeFormat(checking, plugin);
    },
  });

  plugin.addCommand({
    id: 'show-date-chooser',
    name: 'Show calendar popup',
    icon: 'calendar-with-checkmark',
    hotkeys: [
      {
        modifiers: ['Meta', 'Shift'],
        key: '2', // Shift + 2 = `@`
      },
    ],
    editorCheckCallback: (checking, editor): boolean | void => {
      return showDateChooser(checking, editor, plugin, autoComplete, reminders);
    },
  });

  plugin.addCommand({
    id: 'toggle-checklist-status',
    name: 'Toggle checklist status',
    hotkeys: [
      {
        modifiers: ['Meta', 'Shift'],
        key: 'Enter',
      },
    ],
    editorCheckCallback: (checking, editor, view): boolean | void => {
      return toggleChecklistStatus(checking, view, plugin);
    },
  });
}
