import { Completion } from "src/model/autocomplete";
import AutoComplete from "./components/AutoComplete.svelte";

export class AutoCompleteView {
    private view: HTMLElement;
    private autoComplete: AutoComplete;
    private resultResolve: (result: Completion) => void = null;
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
        this.autoComplete = new AutoComplete({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.view,
            props: {
                completions: [],
                onClick: (completion: Completion) => {
                    this.setResult(completion);
                    this.hide();
                }
            },
        });
    }

    show(completions: Array<Completion>) {
        this.setResult(null);
        this.hide();
        this.autoComplete.$set({
            completions,
            selectedIndex: 0
        });

        const cursor = this.editor.getCursor();
        this.editor.addWidget({
            ch: cursor.ch,
            line: cursor.line
        }, this.view, true);
        this.editor.addKeyMap(this.keyMaps);
        return new Promise<Completion>((resolve, reject) => {
            this.resultResolve = resolve;
            this.resultReject = reject;
        });
    }

    private up() {
        this.autoComplete.up();
    }

    private down() {
        this.autoComplete.down();
    }

    private select() {
        this.setResult(this.autoComplete.selection())
        this.hide();
    }

    public cancel() {
        this.setResult(null);
        this.hide();
    }

    private setResult(result: Completion | null) {
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