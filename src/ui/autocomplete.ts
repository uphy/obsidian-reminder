import type { ReadOnlyReference } from "model/ref";
import { SETTINGS } from "settings";
import type { DateTimeChooserView } from "./datetime-chooser";

export class AutoComplete {

    constructor(private trigger: ReadOnlyReference<string>) { };

    isTrigger(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) {
        const trigger = this.trigger.value;
        if (trigger.length === 0) {
            return false;
        }
        if (changeObj.text.contains(trigger.charAt(trigger.length - 1))) {
            const line = cmEditor.getLine(changeObj.from.line).substring(0, changeObj.to.ch) + changeObj.text;
            if (!line.match(/^\s*\- \[.\]\s.*/)) {
                // is not a TODO line
                return false;
            }
            if (line.endsWith(trigger)) {
                return true;
            }
        }
        return false;
    }

    show(cmEditor: CodeMirror.Editor, dateTimeChooserView: DateTimeChooserView, triggerFromCommand: boolean = false): void {
        dateTimeChooserView.show()
            .then(value => {
                const pos = cmEditor.getCursor();
                let line = cmEditor.getLine(pos.line);
                const endPos = {
                    line: pos.line,
                    ch: line.length
                };

                // remove trigger string
                if (!triggerFromCommand) {
                    line = line.substring(0, pos.ch - this.trigger.value.length);
                }
                // append reminder to the line
                const format = SETTINGS.primaryFormat.value.format;
                try {
                    const appended = format.appendReminder(line, value);
                    if (appended == null) {
                        console.error("Cannot append reminder time to the line: line=%s, date=%s", line, value);
                        return;
                    }
                    cmEditor.replaceRange(appended, { line: pos.line, ch: 0 }, endPos);
                } catch (ex) {
                    console.error(ex);
                }
            })
            .catch(() => { /* do nothing on cancel */ });
    }

}
