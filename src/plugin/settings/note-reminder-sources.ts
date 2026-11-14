import { t } from "i18n";
import { normalizeSources, validateSourceName } from "model/note/sources";
import type { NoteReminderSource } from "model/note/sources";
import { DateTime } from "model/time";
import { Setting } from "obsidian";
import type { SettingInitializer } from "./helper";

export type NoteReminderSourceStats = {
  /** Notes whose value is dated before the source's cut-off. */
  ignored: number;
  /** Notes whose `<property>-done` holds something that is not a date. */
  foreignDone: number;
};

/**
 * Builds the "Properties to remind from" setting. The value is always
 * replaced by a new list (never edited in place), because saving and the
 * rescan are triggered by the assignment.
 *
 * The controls are: one line to add a
 * property, then one row per configured property with its "managed" switch,
 * its cut-off date and a remove button. The rows live in an element placed
 * after the setting and are redrawn on every change.
 */
export function renderNoteReminderSources(
  stats: (source: NoteReminderSource) => NoteReminderSourceStats,
): SettingInitializer<unknown> {
  return ({ setting, rawValue }) => {
    const rowsEl = createDiv("reminder-note-sources");
    setting.settingEl.insertAdjacentElement("afterend", rowsEl);

    const rows = () => normalizeSources(rawValue.value);
    const update = (next: Array<NoteReminderSource>) => {
      rawValue.value = next;
      renderRows();
    };

    let newName = "";
    const errorEl = setting.descEl.createDiv("reminder-note-sources-error");
    const add = () => {
      const problem = validateSourceName(rows(), -1, newName);
      if (problem != null) {
        errorEl.setText(problemText(problem));
        return;
      }
      errorEl.setText("");
      update([
        ...rows(),
        {
          property: newName.trim(),
          managed: false,
          since: DateTime.now().format("YYYY-MM-DD"),
        },
      ]);
      newName = "";
      input?.setValue("");
    };
    let input: { setValue(value: string): unknown } | undefined;
    setting.addText((text) => {
      input = text;
      text.setPlaceholder(t("Property name")).onChange((value) => {
        newName = value;
      });
      text.inputEl.addEventListener("keydown", (e) => {
        // The Enter that confirms an IME conversion is not a request to add.
        if (e.key === "Enter" && !e.isComposing) {
          add();
        }
      });
    });
    setting.addButton((button) =>
      button.setButtonText(t("Add")).setCta().onClick(add),
    );

    const renderRows = () => {
      rowsEl.empty();
      rows().forEach((source, index) => {
        const counted = stats(source);
        const row = new Setting(rowsEl)
          .setName(source.property)
          .setClass("reminder-note-source");
        const notes: Array<string> = [
          source.managed
            ? t(
                'Managed: "Set reminder for this note" creates and edits this property.',
              )
            : t("Read only: its value is never created or removed here."),
        ];
        if (counted.ignored > 0) {
          notes.push(
            t("{count} earlier values in the vault are ignored.", {
              count: String(counted.ignored),
            }),
          );
        }
        row.setDesc(notes.join(" "));
        if (counted.foreignDone > 0) {
          row.descEl.createDiv({
            cls: "reminder-note-sources-error",
            text: t(
              '"{property}" already holds other values in {count} notes, so "Done" can\'t be recorded there.',
              {
                property: source.property + "-done",
                count: String(counted.foreignDone),
              },
            ),
          });
        }
        // A visible label: a bare switch does not say what it switches.
        row.controlEl.createSpan({
          cls: "reminder-note-source-label",
          text: t("Managed"),
        });
        row.addToggle((toggle) =>
          toggle
            .setTooltip(
              t(
                'Managed: "Set reminder for this note" creates and edits this property.',
              ),
            )
            .setValue(source.managed)
            .onChange((managed) => {
              update(replaceAt(rows(), index, { ...source, managed }));
            }),
        );
        row.addText((text) => {
          text.inputEl.type = "date";
          text.inputEl.ariaLabel = t("Ignore dates before");
          text.setValue(source.since);
          // `change`, not `input`: every accepted value triggers a rescan.
          text.inputEl.addEventListener("change", () => {
            update(
              replaceAt(rows(), index, {
                ...source,
                since: text.inputEl.value,
              }),
            );
          });
        });
        row.addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip(t("Remove"))
            .onClick(() => {
              update(rows().filter((_, i) => i !== index));
            }),
        );
      });
    };
    renderRows();
  };
}

function replaceAt<T>(list: Array<T>, index: number, value: T): Array<T> {
  return list.map((item, i) => (i === index ? value : item));
}

function problemText(problem: "empty" | "duplicate" | "companion"): string {
  switch (problem) {
    case "empty":
      return t("Enter a property name.");
    case "duplicate":
      return t("This property is already listed.");
    case "companion":
      return t(
        "This name is used by another listed property for its done or title value.",
      );
  }
}
