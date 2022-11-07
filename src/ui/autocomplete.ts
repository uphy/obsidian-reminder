import type { ReadOnlyReference } from 'model/ref';
import type { Reminders } from 'model/reminder';
import type { DateTime } from 'model/time';
import { App, Editor, EditorPosition, Platform } from 'obsidian';
import { SETTINGS } from 'settings';
import { showDateTimeChooserModal } from './date-chooser-modal';
import { DateTimeChooserView } from './datetime-chooser';

export interface AutoCompletableEditor {
    getCursor(): EditorPosition;

    getLine(line: number): string;

    replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition, origin?: string): void;
}

export class AutoComplete {
    constructor(private trigger: ReadOnlyReference<string>) {}

    isTrigger(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) {
        const trigger = this.trigger.value;
        if (trigger.length === 0) {
            return false;
        }
        if (changeObj.text.contains(trigger.charAt(trigger.length - 1))) {
            const line = cmEditor.getLine(changeObj.from.line).substring(0, changeObj.to.ch) + changeObj.text;
            if (!line.match(/^\s*- \[.\]\s.*/)) {
                // is not a TODO line
                return false;
            }
            if (line.endsWith(trigger)) {
                return true;
            }
        }
        return false;
    }

    show(app: App, editor: AutoCompletableEditor, reminders: Reminders): void {
        let result: Promise<DateTime>;
        if (Platform.isDesktopApp) {
            try {
                const cm: CodeMirror.Editor = (editor as any).cm;
                if (cm == null) {
                    console.error('Cannot get codemirror editor.');
                    return;
                }
                const v = new DateTimeChooserView(cm, reminders);
                result = v.show();
            } catch (e) {
                // Temporary workaround for Live preview mode
                result = showDateTimeChooserModal(app, reminders);
            }
        } else {
            result = showDateTimeChooserModal(app, reminders);
        }

        result
            .then((value) => {
                this.insert(editor, value, true);
            })
            .catch(() => {
                /* do nothing on cancel */
            });
    }

    insert(editor: AutoCompletableEditor, value: DateTime, triggerFromCommand: boolean = false): void {
        const pos = editor.getCursor();
        let line = editor.getLine(pos.line);
        const endPos = {
            line: pos.line,
            ch: line.length,
        };

        // remove trigger string
        if (!triggerFromCommand) {
            line = line.substring(0, pos.ch - this.trigger.value.length);
        }
        // append reminder to the line
        const format = SETTINGS.primaryFormat.value.format;
        try {
            const appended = format.appendReminder(line, value)?.insertedLine;
            if (appended == null) {
                console.error('Cannot append reminder time to the line: line=%s, date=%s', line, value);
                return;
            }
            editor.replaceRange(appended, { line: pos.line, ch: 0 }, endPos);
        } catch (ex) {
            console.error(ex);
        }
    }
}
