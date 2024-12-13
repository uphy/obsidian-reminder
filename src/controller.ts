import {
  MarkdownView,
  TAbstractFile,
  TFile,
  Vault,
  WorkspaceLeaf,
} from "obsidian";
import { SETTINGS } from "settings";
import { Content } from "model/content";
import type { Reminders, Reminder } from "model/reminder";
import type { ReminderListItemViewProxy } from "ui/reminder-list";
import { ReminderStatus } from "model/format/reminder-base";

export class RemindersController {

  constructor(private vault: Vault, private viewProxy: ReminderListItemViewProxy, private reminders: Reminders) { }

  async openReminder(reminder: Reminder, leaf: WorkspaceLeaf) {
    console.log("Open reminder: ", reminder);
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("Cannot open file because it isn't a TFile: %o", file);
      return;
    }

    // Open the reminder file and select the reminder
    await leaf.openFile(file);
    if (!(leaf.view instanceof MarkdownView)) {
      return;
    }
    const line = leaf.view.editor.getLine(reminder.rowNumber);
    leaf.view.editor.setSelection(
      {
        line: reminder.rowNumber,
        ch: 0,
      },
      {
        line: reminder.rowNumber,
        ch: line.length,
      }
    );
  }

  async removeFile(path: string): Promise<boolean> {
    console.debug("Remove file: path=%s", path);
    const result = this.reminders.removeFile(path);
    this.reloadUI();
    return result;
  }

  async reloadFile(file: TAbstractFile, reloadUI: boolean = false) {
    console.debug(
      "Reload file and collect reminders: file=%s, forceReloadUI=%s",
      file.path,
      reloadUI
    );
    if (!(file instanceof TFile)) {
      console.debug("Cannot read file other than TFile: file=%o", file);
      return false;
    }
    if (!this.isMarkdownFile(file)) {
      console.debug("Not a markdown file: file=%o", file);
      return false;
    }
    const content = new Content(file.path, await this.vault.cachedRead(file));
    const reminders = content.getReminders();
    if (reminders.length > 0) {
      if (!this.reminders.replaceFile(file.path, reminders)) {
        return false;
      }
    } else {
      if (!this.reminders.removeFile(file.path)) {
        return false;
      }
    }
    if (reloadUI) {
      this.reloadUI();
    }
    return true;
  }

  async convertDateTimeFormat(dateFormat: string, dateTimeFormat: string): Promise<number> {
    let updated = 0;
    for (const file of this.vault.getMarkdownFiles()) {
      const content = new Content(file.path, await this.vault.read(file));
      let updatedInFile = 0;
      await content.modifyReminderLines(reminder => {
        let converted: string;
        if (reminder.time.hasTimePart) {
          converted = reminder.time.format(dateTimeFormat);
        } else {
          converted = reminder.time.format(dateFormat);
        }
        updated++;
        updatedInFile++;
        return {
          rawTime: converted
        };
      })
      if (updatedInFile > 0) {
        await this.vault.modify(file, content.getContent())
      }
    }
    SETTINGS.dateFormat.rawValue.value = dateFormat;
    SETTINGS.dateTimeFormat.rawValue.value = dateTimeFormat;
    if (updated > 0) {
      await this.reloadAllFiles();
    }
    return updated;
  }

  private isMarkdownFile(file: TFile) {
    return file.extension.toLowerCase() === "md";
  }

  async reloadAllFiles() {
    console.debug("Reload all files and collect reminders");
    this.reminders.clear();
    for (const file of this.vault.getMarkdownFiles()) {
      await this.reloadFile(file, false);
    }
    this.reloadUI();
  }

  async updateReminder(reminder: Reminder, status: ReminderStatus) {
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("file is not instance of TFile: %o", file);
      return;
    }
    const content = new Content(file.path, await this.vault.read(file));
    await content.updateReminder(reminder, {
      status,
      time: reminder.time
    });
    await this.vault.modify(file, content.getContent());
  }

  async toggleCheck(file: TFile, lineNumber: number) {
    if (!this.isMarkdownFile(file)) {
      return;
    }
    const content = new Content(file.path, await this.vault.read(file));

    const reminder = content.getReminders(false).find(r => r.rowNumber === lineNumber);
    if (reminder) {
      await content.updateReminder(reminder, {
        status: reminder.status === ReminderStatus.Done ? ReminderStatus.Todo : ReminderStatus.Done
      });
    } else {
      const todo = content.getTodos().find(t => t.lineIndex === lineNumber);
      console.log(todo);
      if (!todo) {
        return;
      }
      if (todo.getStatus() === ReminderStatus.Done) {
        todo.setStatus(ReminderStatus.Todo);
      } else {
        todo.setStatus(ReminderStatus.Done);
      }
    }
    await this.vault.modify(file, content.getContent());
  }

  private reloadUI() {
    console.debug("Reload reminder list view");
    if (this.viewProxy === null) {
      console.debug("reminder list is null.  Skipping UI reload.");
      return;
    }
    this.viewProxy.reload(true);
  }
}
