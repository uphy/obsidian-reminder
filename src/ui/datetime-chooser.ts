import { DateTime, Laters } from "model/time";
import DateTimeChooser from "./components/DateTimeChooser.svelte";

export class DateTimeChooserView {
    private view: HTMLElement;
    private dateTimeChooser: DateTimeChooser;
    private resultResolve: (result: DateTime) => void = null;
    private resultReject: () => void = null;
    private keyMaps = {
        'Ctrl-P': () => this.up(),
        'Ctrl-N': () => this.down(),
        'Enter': () => this.select(),
        Up: () => this.up(),
        Down: () => this.down(),
        Right: () => this.cancel(),
        Left: () => this.cancel(),
        Esc: () => this.cancel(),
    }

    constructor(private editor: CodeMirror.Editor) {
        this.view = document.createElement("div");
        this.dateTimeChooser = new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.view,
            props: {
                relativeDateTimes: [],
                onClick: (time: DateTime) => {
                    this.setResult(time);
                    this.hide();
                }
            },
        });
    }

    show() {
        this.setResult(null);
        this.hide();
        this.dateTimeChooser.$set({
            selectedIndex: 0
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

    private up() {
        this.dateTimeChooser.up();
    }

    private down() {
        this.dateTimeChooser.down();
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