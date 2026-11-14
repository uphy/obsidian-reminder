import "./date-chooser-modal.css";
import { t } from "i18n";
import type ReminderPlugin from "main";
import { isPathExcluded } from "model/exclusion";
import {
  hasUnreadableRepeatRule,
  readPropertyReminderState,
  rearmPropertyReminder,
  removePropertyReminder,
  setPropertyReminder,
} from "model/note/property-format";
import type {
  PropertyReminderEdit,
  PropertyReminderState,
} from "model/note/property-format";
import type { NoteReminderSource } from "model/note/sources";
import type { Frontmatter } from "model/note/format";
import { isBeforeDay } from "model/note/value";
import { DateTime } from "model/time";
import { Modal, Notice, Platform, Setting, TFile } from "obsidian";
import NoteReminderEditor from "ui/NoteReminderEditor.svelte";

/** The property the first-use prompt offers to keep note reminders in. */
const DEFAULT_MANAGED_PROPERTY = "reminder";

/**
 * Whether a note can have a reminder set from the dialog: a Markdown file
 * that is not under an excluded path (reminders there are not read, so one
 * set from the dialog would never be shown).
 */
export function canSetNoteReminder(plugin: ReminderPlugin, file: TFile) {
  return (
    file.extension.toLowerCase() === "md" &&
    !isPathExcluded(file.path, plugin.settings.excludedPaths.value)
  );
}

/**
 * Opens the reminder dialog for `file`. The dialog only ever writes to
 * managed properties; with none configured yet, it first offers to set one
 * up.
 */
export function openNoteReminderModal(plugin: ReminderPlugin, file: TFile) {
  const open = async () => {
    let fm: Frontmatter;
    try {
      fm = await plugin.noteReminders.readFrontmatter(file.path);
    } catch (e) {
      console.error("Cannot read note: path=%s, error=%o", file.path, e);
      new Notice(
        t("Could not update the reminder in {file}", { file: file.basename }),
      );
      return;
    }
    new NoteReminderModal(
      plugin,
      file,
      plugin.managedNoteReminderSources(),
      fm,
    ).open();
  };
  if (plugin.managedNoteReminderSources().length > 0) {
    void open();
    return;
  }
  new AddManagedPropertyModal(plugin, () => void open()).open();
}

/**
 * The dialogs that are open now. A dialog left open would outlive the plugin
 * instance that owns it (and keep writing through it) when the plugin is
 * disabled or reloaded, so `closeNoteReminderModals()` closes them at unload.
 */
const openModals = new Set<Modal>();

/** Closes every open note reminder dialog. Called when the plugin unloads. */
export function closeNoteReminderModals() {
  for (const modal of [...openModals]) {
    modal.close();
  }
}

/**
 * Creates, edits, completes or removes the reminder of one note. The
 * counterpart of the calendar popup for task lines.
 */
class NoteReminderModal extends Modal {
  private component?: NoteReminderEditor;

  constructor(
    private plugin: ReminderPlugin,
    private file: TFile,
    private sources: Array<NoteReminderSource>,
    /** The note's frontmatter as read from the file when opening. */
    private fm: Frontmatter,
  ) {
    super(plugin.app);
  }

  override onOpen() {
    openModals.add(this);
    if (Platform.isDesktop) {
      this.modalEl.addClass("reminder-date-chooser-modal");
    }
    const states: Record<string, PropertyReminderState> = {};
    for (const source of this.sources) {
      states[source.property] = readPropertyReminderState(
        this.fm,
        source.property,
        source.since,
      );
    }
    const path = this.file.path;
    const service = this.plugin.noteReminders;
    const write = (
      property: string,
      fn: Parameters<typeof service.write>[1],
    ) => {
      void service.write(path, fn).then((result) => {
        this.plugin.ui.reportNoteWrite(path, property, result);
      });
      this.close();
    };
    this.component = new NoteReminderEditor({
      target: this.contentEl,
      props: {
        noteName: this.file.basename,
        properties: this.sources.map((source) => source.property),
        states,
        reminders: this.plugin.reminders,
        timeStep: this.plugin.settings.reminderTimeStep.value,
        weekStart: Number(this.plugin.settings.weekStart.value),
        onSave: (property: string, edit: PropertyReminderEdit) => {
          write(property, (fm) => setPropertyReminder(fm, property, edit));
          const since =
            this.sources.find((s) => s.property === property)?.since ?? "";
          if (isBeforeDay(edit.time, since)) {
            new Notice(
              t(
                "Saved, but it will not be shown: dates before {date} are ignored for “{property}” (Settings → Note reminders).",
                { date: since, property },
              ),
            );
          }
        },
        onDone: (property: string) => {
          const shown = states[property]?.time;
          if (shown == null) {
            return;
          }
          // The stale check applies here too: the note may have changed
          // since the dialog read it.
          write(property, (fm) =>
            this.plugin.noteReminderReader.apply(
              fm,
              { kind: "note", format: "property", key: property, label: "" },
              { type: "done", expected: shown, now: DateTime.now() },
            ),
          );
          if (hasUnreadableRepeatRule(this.fm, property)) {
            this.plugin.ui.reportUnreadableRepeatRule(path, property);
          }
        },
        onRemindAgain: (property: string) => {
          write(property, (fm) => rearmPropertyReminder(fm, property));
        },
        onRemove: (property: string) => {
          write(property, (fm) => removePropertyReminder(fm, property));
        },
      },
    });
  }

  override onClose() {
    openModals.delete(this);
    this.component?.$destroy();
    this.component = undefined;
    this.contentEl.empty();
  }
}

/** The first-use prompt: offers to keep note reminders in a property. */
class AddManagedPropertyModal extends Modal {
  constructor(
    private plugin: ReminderPlugin,
    private onAdded: () => void,
  ) {
    super(plugin.app);
  }

  override onOpen() {
    openModals.add(this);
    this.setTitle(t("Set reminder for this note"));
    this.contentEl.createEl("p", {
      text: t(
        "Note reminders are kept in a property of the note. No property is set up for this yet. Use “{property}”?",
        { property: DEFAULT_MANAGED_PROPERTY },
      ),
    });
    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText(
            t("Use “{property}”", { property: DEFAULT_MANAGED_PROPERTY }),
          )
          .setCta()
          .onClick(() => {
            this.close();
            if (
              this.plugin.addManagedNoteReminderSource(DEFAULT_MANAGED_PROPERTY)
            ) {
              this.onAdded();
            } else {
              // A listed property already uses this name for its done or
              // title value; the user has to pick a name in the settings.
              new Notice(
                t(
                  "“{property}” can't be used: another listed property uses that name. Add a property under Settings → Note reminders and turn on “Managed”.",
                  { property: DEFAULT_MANAGED_PROPERTY },
                ),
              );
            }
          }),
      )
      .addButton((button) =>
        button.setButtonText(t("Cancel")).onClick(() => this.close()),
      );
  }

  override onClose() {
    openModals.delete(this);
    this.contentEl.empty();
  }
}
