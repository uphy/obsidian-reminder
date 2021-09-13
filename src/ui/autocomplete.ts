import { ReadOnlyReference } from "model/ref";
import { DATE_TIME_FORMATTER } from "model/time";
import { SETTINGS } from "settings";
import { DateTimeChooserView } from "./datetime-chooser";

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

    show(cmEditor: CodeMirror.Editor, dateTimeChooserView: DateTimeChooserView): void {
        dateTimeChooserView.show()
            .then(value => {
                const pos = cmEditor.getCursor();
                let line = cmEditor.getLine(pos.line);
                const endPos = {
                    line: pos.line,
                    ch: line.length
                };

                // remove trigger string
                line = line.substring(0, pos.ch - 2);
                // append reminder to the line
                const format = SETTINGS.primaryFormat.value.format;
                try {
                    line = format.appendReminder(line, value);
                    cmEditor.replaceRange(line, { line: pos.line, ch: 0 }, endPos);
                } catch (ex) {
                    console.error(ex);
                }
            })
            .catch(() => { /* do nothing on cancel */ });
    }

}
