import { OkCancel, showOkCancelDialog } from 'obsidian/ui/util';
import type ReminderPlugin from 'main';
import { SETTINGS } from 'obsidian/settings';
import { Content } from 'model/content';
import { openDateTimeFormatChooser } from '../ui/datetime-format-modal';

async function convertDateTimeFormat(
  plugin: ReminderPlugin,
  dateFormat: string,
  dateTimeFormat: string,
): Promise<number> {
  let updated = 0;
  const vault = plugin.app.vault;
  for (const file of vault.getMarkdownFiles()) {
    const content = new Content(file.path, await vault.read(file));
    let updatedInFile = 0;
    await content.modifyReminderLines((reminder) => {
      let converted: string;
      if (reminder.time.hasTimePart) {
        converted = reminder.time.format(dateTimeFormat);
      } else {
        converted = reminder.time.format(dateFormat);
      }
      updated++;
      updatedInFile++;
      return {
        rawTime: converted,
      };
    });
    if (updatedInFile > 0) {
      await vault.modify(file, content.getContent());
    }
  }
  SETTINGS.dateFormat.rawValue.value = dateFormat;
  SETTINGS.dateTimeFormat.rawValue.value = dateTimeFormat;
  if (updated > 0) {
    await plugin.fileSystem.reloadRemindersInAllFiles();
  }
  return updated;
}

export function convertReminderTimeFormat(checking: boolean, plugin: ReminderPlugin) {
  if (!checking) {
    showOkCancelDialog(
      'Convert reminder time format',
      'This command rewrite reminder dates in all markdown files.  You should make a backup of your vault before you execute this.  May I continue to convert?',
    ).then((res) => {
      if (res !== OkCancel.OK) {
        return;
      }
      openDateTimeFormatChooser(plugin.app, (dateFormat, dateTimeFormat) => {
        convertDateTimeFormat(plugin, dateFormat, dateTimeFormat).catch(() => {
          /* ignore */
        });
      });
    });
  }
  return true;
}
