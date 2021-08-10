import {
  MarkdownView,
  TAbstractFile,
  TFile,
  Vault,
  WorkspaceLeaf,
} from "obsidian";
import { Content } from "./model/content";
import { Reminders, Reminder } from "./model/reminder";
import { ReminderListItemView } from "./ui/reminder-list";

export class RemindersController {
  private view: ReminderListItemView | null = null;

  constructor(private vault: Vault, private reminders: Reminders) {}

  async openReminder(reminder: Reminder, leaf: WorkspaceLeaf) {
    console.log("Open reminder: ", reminder);
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("Cannot open file because it isn't a TFile: %o", file);
      return;
    }
    // Open the reminder file and select the reminder
    leaf.openFile(file).then(() => {
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
    });
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
    const content = new Content(file.path, await this.vault.read(file));
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

  async reloadAllFiles() {
    console.debug("Reload all files and collect reminders");
    this.reminders.clear();
    Vault.recurseChildren(this.vault.getRoot(), (file) => {
      // Vault.recurseChildren() doesn't accept `async` function.
      this.reloadFile(file, false);
    });
    // No means to reload because the above reloadFile() executions are async function.
    // this.reloadUI();
  }

  setView(view: ReminderListItemView) {
    this.view = view;
    this.reloadUI();
  }

  async updateReminder(reminder: Reminder, checked: boolean) {
    const file = this.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("file is not instance of TFile: %o", file);
      return;
    }
    const content = new Content(file.path, await this.vault.read(file));
    content.updateReminder(reminder, checked);
    await this.vault.modify(file, content.getContent());
  }

  private reloadUI() {
    console.debug("Reload reminder list view");
    if (this.view === null) {
      console.debug("reminder list is null.  Skipping UI reload.");
      return;
    }
    this.view.reload(true);
  }
}
