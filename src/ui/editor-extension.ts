import { EditorSelection } from "@codemirror/state";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { Reminders } from "model/reminder";
import type { App } from "obsidian";
import { SETTINGS } from "settings";
import { showDateTimeChooserModal } from "./date-chooser-modal";

export function buildCodeMirrorPlugin(app: App, reminders: Reminders) {
    return ViewPlugin.fromClass(
        class {
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
                    const trigger = SETTINGS.autoCompleteTrigger.value;
                    if (trigger === text) {
                        showDateTimeChooserModal(app, reminders).then(value => {
                            const format = SETTINGS.primaryFormat.value.format;
                            try {
                                const line = doc.lineAt(toB);
                                const triggerStart = line.text.lastIndexOf(trigger);
                                const triggerExcludedLine = line.text.substring(0, triggerStart);

                                const appended = format.appendReminder(triggerExcludedLine, value);
                                if (appended == null) {
                                    console.error("Cannot append reminder time to the line: line=%s, date=%s", line.text, value);
                                    return;
                                }

                                const updateTextTransaction = update.view.state.update({
                                    changes: { from: line.from, to: line.to, insert: appended },
                                    // Move the cursor to the last of date string to make it easy to input time part.
                                    selection: EditorSelection.cursor(line.from + appended.length - 1),
                                });
                                update.view.update([updateTextTransaction]);
                            } catch (ex) {
                                console.error(ex);
                            }
                        });
                    }
                });
            }
        }
    );
}
