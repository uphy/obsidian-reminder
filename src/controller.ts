import { ReminderEdit } from "model/format";
import {
  MarkdownView,
  TAbstractFile,
  TFile,
  Vault,
  WorkspaceLeaf,
} from "obsidian";
import { SETTINGS } from "settings";
import { Content } from "./model/content";
import { Reminders, Reminder } from "./model/reminder";
import { ReminderListItemViewProxy } from "./ui/reminder-list";

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
    leaf.view.editor.setSelection(
      {
        line: reminder.rowNumber,
        ch: 0,
      },
      {
        line: reminder.rowNumber,
        // End of the line
        ch: 1000,
      }
    );
  }

  async removeFile(path: string) {
    console.debug("Remove file: path=%s", path);
    this.reminders.removeFile(path);
    this.reloadUI();
  }

  async reloadFile(file: TAbstractFile, reloadUI: boolean = false) {
    console.debug(
      "Reload file and collect reminders: file=%s, forceReloadUI=%s",
      file.path,
      reloadUI
    );
    if (!(file instanceof TFile)) {
      console.debug("Cannot read file other than TFile: file=%o", file);
      return;
    }
    if (!this.isMarkdownFile(file)) {
      console.debug("Not a markdown file: file=%o", file);
      return;
    }
    const content = new Content(file.path, await this.vault.cachedRead(file));
    const reminders = content.getReminders();
    if (reminders.length > 0) {
      this.reminders.replaceFile(file.path, reminders);
    } else {
      this.reminders.removeFile(file.path);
    }
    if (reloadUI) {
      this.reloadUI();
    }
  }

  async convertDateTimeFormat(dateFormat: string, dateTimeFormat: string): Promise<number> {
    let updated = 0;
    for (const file of this.vault.getMarkdownFiles()) {
      const content = new Content(file.path, await this.vault.read(file));
      content.modifyReminderLines(reminder => {
        const edit = new ReminderEdit();
        let converted: string;
        if (reminder.time.hasTimePart) {
          converted = reminder.time.format(dateTimeFormat);
        } else {
          converted = reminder.time.format(dateFormat);
        }
        edit.rawTime = converted;
        updated++;
        return edit;
      })
      await this.vault.modify(file, content.getContent())
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

  async updateReminder(reminder: Reminder, checked: boolean) {
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("file is not instance of TFile: %o", file);
      return;
    }
    const content = new Content(file.path, await this.vault.read(file));
    const edit = new ReminderEdit();
    edit.checked = checked;
    edit.time = reminder.time;
    content.updateReminder(reminder, edit);
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
