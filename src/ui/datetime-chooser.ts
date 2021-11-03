import { Calendar } from "model/calendar";
import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import moment from "moment";
import DateTimeChooser from "./components/DateTimeChooser.svelte";

export class DateTimeChooserView {
    private view: HTMLElement;
    private dateTimeChooser: DateTimeChooser;
    private resultResolve?: (result: DateTime) => void;
    private resultReject?: () => void;
    private keyMaps = {
        'Ctrl-P': () => this.dateTimeChooser["moveUp"](),
        'Ctrl-N': () => this.dateTimeChooser["moveDown"](),
        'Ctrl-B': () => this.dateTimeChooser["moveLeft"](),
        'Ctrl-F': () => this.dateTimeChooser["moveRight"](),
        'Enter': () => this.select(),
        Up: () => this.dateTimeChooser["moveUp"](),
        Down: () => this.dateTimeChooser["moveDown"](),
        Right: () => this.dateTimeChooser["moveRight"](),
        Left: () => this.dateTimeChooser["moveLeft"](),
        Esc: () => this.cancel(),
    }

    constructor(private editor: CodeMirror.Editor, reminders: Reminders) {
        this.view = document.createElement("div");
        this.view.addClass("date-time-chooser-popup");
        this.view.style.position = "fixed";
        this.dateTimeChooser = new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.view,
            props: {
                onClick: (time: DateTime) => {
                    this.setResult(time);
                    this.hide();
                },
                reminders,
                undefined
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
        const coords = this.editor.charCoords(cursor);

        const parent = document.body;
        const parentRect = parent.getBoundingClientRect();
        this.view.style.top = `${coords.top - parentRect.top + this.editor.defaultTextHeight()}px`;
        this.view.style.left = `${coords.left - parentRect.left}px`;

        parent.appendChild(this.view);
        this.editor.addKeyMap(this.keyMaps);
        return new Promise<DateTime>((resolve, reject) => {
            this.resultResolve = resolve;
            this.resultReject = reject;
        });
    }

    private select() {
        this.setResult(this.dateTimeChooser["selection"]())
        this.hide();
    }

    public cancel() {
        this.setResult(null);
        this.hide();
    }

    private setResult(result: DateTime | null) {
        if (this.resultReject == null || this.resultResolve == null) {
            return;
        }
        if (result === null) {
            this.resultReject();
        } else {
            this.resultResolve(result);
        }
        this.resultReject = undefined;
        this.resultResolve = undefined;
    }

    private hide() {
        if (this.view.parentNode) {
            this.editor.removeKeyMap(this.keyMaps);
            this.view.parentNode.removeChild(this.view);
        }
    }
}