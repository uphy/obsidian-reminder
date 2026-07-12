import { EditorSelection } from "@codemirror/state";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import { Platform } from "obsidian";
import type { App } from "obsidian";
import type { Settings } from "plugin/settings";
import { CM6DateTimeChooserPopup } from "./cm6-datetime-chooser";
import { showDateTimeChooserModal } from "./date-chooser-modal";
import {
  appendReminderOrConvert,
  showReminderInsertionFailureNotice,
} from "./util";

export function buildCodeMirrorPlugin(
  app: App,
  reminders: Reminders,
  settings: Settings,
) {
  return ViewPlugin.fromClass(
    class {
      // The currently open inline popup, if any. Tracked so it can be
      // cancelled when a new trigger fires or the editor view is destroyed.
      private activePopup?: CM6DateTimeChooserPopup;
      // Set by destroy(). Guards the deferred popup opening below so a
      // popup never opens after the editor view has been torn down.
      private destroyed = false;

      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }
        update.changes.iterChanges((_fromA, _toA, _fromB, toB, inserted) => {
          const doc = update.state.doc;
          const text = doc.sliceString(toB - 2, toB);
          if (inserted.length === 0) {
            return;
          }
          const trigger = settings.autoCompleteTrigger.value;
          const timeStep = settings.reminderTimeStep.value;
          const weekStart = Number(settings.weekStart.value);
          if (trigger === text) {
            let result: Promise<DateTime>;
            if (Platform.isDesktopApp) {
              // Defer opening the popup out of the CM6 update cycle:
              // coordsAtPos() (and DOM reads in general) throws
              // "Reading the editor layout isn't allowed during an update"
              // when called synchronously inside ViewPlugin.update().
              result = new Promise<DateTime>((resolve, reject) => {
                setTimeout(() => {
                  if (this.destroyed) {
                    reject();
                    return;
                  }
                  this.activePopup?.cancel();
                  const popup = new CM6DateTimeChooserPopup(
                    update.view,
                    reminders,
                    timeStep,
                    weekStart,
                  );
                  this.activePopup = popup;
                  popup
                    .show(toB)
                    .finally(() => {
                      if (this.activePopup === popup) {
                        this.activePopup = undefined;
                      }
                    })
                    .then(resolve, reject);
                }, 0);
              });
            } else {
              result = showDateTimeChooserModal(
                app,
                reminders,
                timeStep,
                weekStart,
              );
            }

            result
              .then((value) => {
                const format = settings.primaryFormat.value.format;
                try {
                  const line = doc.lineAt(toB);

                  // remove trigger character from the line
                  const triggerStart = line.text.lastIndexOf(trigger);
                  let triggerEnd = triggerStart + trigger.length;
                  if (
                    trigger.startsWith("(") &&
                    line.text.charAt(triggerEnd) === ")"
                  ) {
                    // Obsidian complement `)` when user input `(`.
                    // To remove the end of the brace, adjust the trigger end index.
                    triggerEnd++;
                  }
                  const triggerExcludedLine =
                    line.text.substring(0, triggerStart) +
                    line.text.substring(triggerEnd);

                  // insert/update a reminder of the line
                  const reminderInsertion = appendReminderOrConvert(
                    format,
                    triggerExcludedLine,
                    value,
                    triggerStart,
                    settings.convertNonTaskLines.value,
                  );
                  if (reminderInsertion == null) {
                    showReminderInsertionFailureNotice();
                    console.error(
                      "Cannot append reminder time to the line: line=%s, date=%s",
                      line.text,
                      value,
                    );
                    return;
                  }

                  // overwrite the line
                  const updateTextTransaction = update.view.state.update({
                    changes: {
                      from: line.from,
                      to: line.to,
                      insert: reminderInsertion.insertedLine,
                    },
                    // Move the cursor to the last of date string to make it easy to input time part.
                    selection: EditorSelection.cursor(
                      line.from + reminderInsertion.caretPosition,
                    ),
                  });
                  update.view.update([updateTextTransaction]);
                } catch (ex) {
                  console.error(ex);
                }
              })
              .catch(() => {
                /* do nothing on cancel */
              });
          }
        });
      }

      destroy() {
        this.destroyed = true;
        this.activePopup?.cancel();
      }
    },
  );
}
