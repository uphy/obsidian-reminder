import type ReminderPlugin from 'main';
import { Content } from 'model/content';
import type { Reminder, Reminders } from 'model/reminder';
import { TAbstractFile, TFile, Vault } from 'obsidian';

export class ReminderPluginFileSystem {
  constructor(private vault: Vault, private reminders: Reminders, private onRemindersChanged: () => void) {}

  onload(plugin: ReminderPlugin) {
    [
      this.vault.on('modify', async (file) => {
        if (await this.reloadRemindersInFile(file)) {
          this.onRemindersChanged();
        }
      }),
      this.vault.on('delete', async (file) => {
        if (await this.removeRemindersByFile(file.path)) {
          this.onRemindersChanged();
        }
      }),
      this.vault.on('rename', async (file, oldPath) => {
        // We only reload the file if it CAN be deleted, otherwise this can
        // cause crashes.
        if (await this.removeRemindersByFile(oldPath)) {
          // We need to do the reload synchronously so as to avoid racing.
          await this.reloadRemindersInFile(file);
          this.onRemindersChanged();
        }
      }),
    ].forEach((eventRef) => {
      plugin.registerEvent(eventRef);
    });
  }

  async removeRemindersByFile(path: string): Promise<boolean> {
    console.debug('Remove file: path=%s', path);
    return this.reminders.removeByFile(path);
  }

  async reloadRemindersInFile(file: TAbstractFile) {
    console.debug('Reload file and collect reminders: file=%s', file.path);
    if (!(file instanceof TFile)) {
      console.debug('Cannot read file other than TFile: file=%o', file);
      return false;
    }
    if (!this.isMarkdownFile(file)) {
      console.debug('Not a markdown file: file=%o', file);
      return false;
    }
    const content = new Content(file.path, await this.vault.cachedRead(file));
    const reminders = content.getReminders();
    if (reminders.length > 0) {
      if (!this.reminders.replaceFile(file.path, reminders)) {
        return false;
      }
    } else {
      if (!this.reminders.removeByFile(file.path)) {
        return false;
      }
    }
    return true;
  }

  async reloadRemindersInAllFiles() {
    console.debug('Reload all files and collect reminders');
    this.reminders.clear();
    for (const file of this.vault.getMarkdownFiles()) {
      await this.reloadRemindersInFile(file);
    }
    this.onRemindersChanged();
  }

  isMarkdownFile(file: TFile) {
    return file.extension.toLowerCase() === 'md';
  }

  async updateReminder(reminder: Reminder, checked: boolean) {
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error('file is not instance of TFile: %o', file);
      return;
    }
    const content = new Content(file.path, await this.vault.read(file));
    await content.updateReminder(reminder, {
      checked,
      time: reminder.time,
    });
    await this.vault.modify(file, content.getContent());
  }
}
