import { Calendar } from "model/calendar";
import { Reminders } from "model/reminder";
import { DateTime, Laters } from "model/time";
import moment from "moment";
import DateTimeChooser from "./components/DateTimeChooser.svelte";

export class DateTimeChooserView {
    private view: HTMLElement;
    private dateTimeChooser: DateTimeChooser;
    private resultResolve: (result: DateTime) => void = null;
    private resultReject: () => void = null;
    private keyMaps = {
        'Ctrl-P': () => this.dateTimeChooser.moveUp(),
        'Ctrl-N': () => this.dateTimeChooser.moveDown(),
        'Ctrl-B': () => this.dateTimeChooser.moveLeft(),
        'Ctrl-F': () => this.dateTimeChooser.moveRight(),
        'Enter': () => this.select(),
        Up: () => this.dateTimeChooser.moveUp(),
        Down: () => this.dateTimeChooser.moveDown(),
        Right: () => this.dateTimeChooser.moveRight(),
        Left: () => this.dateTimeChooser.moveLeft(),
        Esc: () => this.cancel(),
    }

    constructor(private editor: CodeMirror.Editor, reminders: Reminders) {
        this.view = document.createElement("div");
        this.dateTimeChooser = new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.view,
            props: {
                onClick: (time: DateTime) => {
                    this.setResult(time);
                    this.hide();
                },
                reminders
            },
        });
    }

    show() {
        this.setResult(null);
        this.hide();
        this.dateTimeChooser.$set({
            selectedDate: moment(),
            calendar: new Calendar()
        });

        const cursor = this.editor.getCursor();
        this.editor.addWidget({
            ch: cursor.ch,
            line: cursor.line
        }, this.view, true);
        this.editor.addKeyMap(this.keyMaps);
        return new Promise<DateTime>((resolve, reject) => {
            this.resultResolve = resolve;
            this.resultReject = reject;
        });
    }

    private select() {
        this.setResult(this.dateTimeChooser.selection())
        this.hide();
    }

    public cancel() {
        this.setResult(null);
        this.hide();
    }

    private setResult(result: DateTime | null) {
        if (this.resultReject === null || this.resultResolve === null) {
            return;
        }
        if (result === null) {
            this.resultReject();
        } else {
            this.resultResolve(result);
        }
        this.resultReject = null;
        this.resultResolve = null;
    }

    private hide() {
        if (this.view.parentNode) {
            this.editor.removeKeyMap(this.keyMaps);
            this.view.parentNode.removeChild(this.view);
        }
    }
}