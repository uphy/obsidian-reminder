import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { Reminders } from "model/reminder";
import type { App } from "obsidian";
import { SETTINGS } from "settings";
import { showDateTimeChooserModal } from "./date-chooser-modal";
import { Panel, showPanel } from "@codemirror/view";

export function buildCodeMirrorPlugin(app: App, reminders: Reminders) {
    const popupPos = StateEffect.define<number | undefined>();
    // TODO popupのinline表示
    // - ポップアップ表示位置(coords)を表すStateField作成 (?)
    //   - EditorViewが必要だが、取得できなさそう。obsidian-apiのeditorViewStateを使えば取れそうだけど、codemirror的にいいのか
    // - viewPlugin内からそれに基づいて座標を更新
    // - panelは、使わなくて実現できそうなら削除
    const viewPlugin = ViewPlugin.fromClass(
        class {
            private dom: HTMLElement;
            constructor(view: EditorView) {
                this.dom = view.dom.appendChild(document.createElement("div"))
                this.dom.style.cssText =
                    "position: fixed;"
                this.dom.textContent = "Test DOM";
            }
            update(update: ViewUpdate) {
                if (!update.docChanged) {
                    return;
                }
                this.dom.style.top = "100px";
                this.dom.style.left = "100px";
                update.state.update({
                    effects: popupPos.of(0)
                });
                update.view.posAtCoords({ x: 0, y: 0 });
                update.changes.iterChanges((_fromA, _toA, _fromB, toB, inserted) => {
                    const doc = update.state.doc;
                    const text = doc.sliceString(toB - 2, toB);
                    if (inserted.length === 0) {
                        return;
                    }
                    const trigger = SETTINGS.autoCompleteTrigger.value;
                    const timeStep = SETTINGS.reminderTimeStep.value;
                    if (trigger === text) {
                        showDateTimeChooserModal(app, reminders, timeStep).then(value => {
                            const format = SETTINGS.primaryFormat.value.format;
                            try {
                                const line = doc.lineAt(toB);

                                // remove trigger character from the line
                                const triggerStart = line.text.lastIndexOf(trigger);
                                let triggerEnd = triggerStart + trigger.length;
                                if (trigger.startsWith("(") && line.text.charAt(triggerEnd) === ")") {
                                    // Obsidian complement `)` when user input `(`.
                                    // To remove the end of the brace, adjust the trigger end index.
                                    triggerEnd++;
                                }
                                const triggerExcludedLine = line.text.substring(0, triggerStart) + line.text.substring(triggerEnd);

                                // insert/update a reminder of the line
                                const reminderInsertion = format.appendReminder(triggerExcludedLine, value, triggerStart);
                                if (reminderInsertion == null) {
                                    console.error("Cannot append reminder time to the line: line=%s, date=%s", line.text, value);
                                    return;
                                }

                                // overwrite the line
                                const updateTextTransaction = update.view.state.update({
                                    changes: { from: line.from, to: line.to, insert: reminderInsertion.insertedLine },
                                    // Move the cursor to the last of date string to make it easy to input time part.
                                    selection: EditorSelection.cursor(line.from + reminderInsertion.caretPosition),
                                });
                                update.view.update([updateTextTransaction]);
                            } catch (ex) {
                                console.error(ex);
                            }
                        }).catch(() => {
                            /* do nothing on cancel */
                        });
                    }
                });
            }
            destroy() {
                this.dom.remove();
            }
        }
    );
    function createPanel(view: EditorView, popupPos: number | undefined): Panel {
        const dom = document.createElement("div")
        dom.textContent = "F1: Toggle the help panel"
        dom.className = "cm-help-panel"
        return { dom }
    }
    const popupState = StateField.define<number | undefined>({
        create: () => 0,
        update(value, tr) {
            for (const effect of tr.effects) {
                if (effect.is(popupPos)) {
                    value = effect.value;
                }
            }
            return value;
        },
        provide: f => showPanel.from(f, popupPos => {
            if (popupPos == null) {
                return null;
            }
            return (view: EditorView): Panel => {
                return createPanel(view, popupPos);
            }
        })
    });

    return [viewPlugin, popupState];
}
