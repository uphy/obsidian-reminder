import { t } from "i18n";
import type ReminderPlugin from "main";
import { MarkdownView } from "obsidian";
import { muteAllReminders } from "./mute-all-reminders";
import { pauseNotifications } from "./pause-notifications";
import { resumeNotifications } from "./resume-notifications";
import { scanReminders } from "./scan-reminders";
import { showReminderList } from "./show-reminder-list";
import { convertReminderTimeFormat } from "./convert-reminder-time-format";
import { showDateChooser } from "./show-date-chooser";
import { toggleChecklistStatus } from "./toggle-checklist-status";
import { setDateDisplayFormat } from "./set-date-display-format";
import { setNoteReminder } from "./set-note-reminder";

/**
 * The ids of every command this plugin registers, so a language change can
 * re-register them with translated names (see `refreshCommandNames()`).
 * Unprefixed: this is exactly what is passed as `id` to `addCommand()`.
 */
const COMMAND_IDS: ReadonlyArray<string> = [
  "scan-reminders",
  "show-reminders",
  "convert-reminder-time-format",
  "show-date-chooser",
  "toggle-checklist-status",
  "set-date-display-format",
  "pause-notifications",
  "resume-notifications",
  "mute-all-reminders",
  "set-note-reminder",
];

export function registerCommands(plugin: ReminderPlugin) {
  addCommands(plugin);
}

/**
 * Re-registers every command with the names of the language currently
 * selected.
 *
 * Re-registering rather than renaming: Obsidian's API has no way to change a
 * command's name after `addCommand()`, and the command ids stay the same
 * across the round trip, so user-assigned hotkeys keep working.
 */
export function refreshCommandNames(plugin: ReminderPlugin) {
  COMMAND_IDS.forEach((id) => plugin.removeCommand(id));
  addCommands(plugin);
}

function addCommands(plugin: ReminderPlugin) {
  plugin.addCommand({
    id: "scan-reminders",
    name: t("Rescan all files"),
    checkCallback: (checking: boolean) => {
      return scanReminders(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "show-reminders",
    name: t("Open list view"),
    checkCallback: (checking: boolean) => {
      return showReminderList(checking, plugin.ui);
    },
  });

  plugin.addCommand({
    id: "convert-reminder-time-format",
    name: t("Convert time format"),
    checkCallback: (checking: boolean) => {
      return convertReminderTimeFormat(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "show-date-chooser",
    name: t("Show calendar popup"),
    icon: "calendar-with-checkmark",
    editorCheckCallback: (checking, editor): boolean | void => {
      return showDateChooser(checking, editor, plugin.ui);
    },
  });

  plugin.addCommand({
    id: "toggle-checklist-status",
    name: t("Toggle checklist status"),
    editorCheckCallback: (checking, editor, view): boolean | void => {
      if (view instanceof MarkdownView) {
        return toggleChecklistStatus(checking, view, plugin);
      } else {
        return false;
      }
    },
  });

  plugin.addCommand({
    id: "set-date-display-format",
    name: t("Set date display format"),
    checkCallback: (checking: boolean) => {
      return setDateDisplayFormat(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "pause-notifications",
    name: t("Pause notifications"),
    checkCallback: (checking: boolean) => {
      return pauseNotifications(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "resume-notifications",
    name: t("Resume notifications"),
    checkCallback: (checking: boolean) => {
      return resumeNotifications(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "mute-all-reminders",
    name: t("Mute all current notifications"),
    checkCallback: (checking: boolean) => {
      return muteAllReminders(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "set-note-reminder",
    name: t("Set reminder for this note"),
    icon: "bell-plus",
    checkCallback: (checking: boolean) => {
      return setNoteReminder(checking, plugin);
    },
  });
}
