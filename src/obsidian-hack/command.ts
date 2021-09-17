import { App, Command, Editor, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { findLeafByFile } from "./leaf";

class AbstractCommand {
    constructor(protected command: Command) { }

    protected tryCheckCallback() {
        if (!this.command.checkCallback) {
            return false;
        }
        const checkResult = this.command.checkCallback(true);
        if (checkResult !== undefined && !checkResult) {
            console.info("The command is not available by checking: %o", this.command);
            return true;
        }
        this.command.checkCallback(false);
        return true;
    }

    protected tryCallback() {
        if (!this.command.callback) {
            return false;
        }
        this.command.callback();
        return true;
    }

    protected tryEditorCheckCallback(editor: Editor, view: MarkdownView): boolean | void {
        if (!this.command.editorCheckCallback) {
            return false;
        }
        const checkResult = this.command.editorCheckCallback(true, editor, view);
        if (checkResult !== undefined && !checkResult) {
            console.info("The editor command is not available by checking: %o", this.command);
            return true;
        }
        this.command.editorCheckCallback(false, editor, view);
    }

    protected tryEditorCallback(editor: Editor, view: MarkdownView): boolean {
        if (!this.command.editorCallback) {
            return false;
        }
        this.command.editorCallback(editor, view);
        return true;
    }
}

class RunnableCommand extends AbstractCommand {

    run() {
        if (this.tryCheckCallback()) {
            return;
        }
        if (this.tryCallback()) {
            return;
        }
        console.warn("Expected command callback doens't exist: %o", this.command);
    }

}

class RunnableEditorCommand extends AbstractCommand {
    constructor(private app: App, command: Command) {
        super(command);
    }

    runInCurrentLeaf() {
        const leaf = this.app.workspace.activeLeaf;
        this.runInLeaf(leaf);
    }

    async openAndRun(file: TFile) {
        const leaf = await findLeafByFile(this.app, file, true);
        this.runInLeaf(leaf);
    }

    runInLeaf(leaf: WorkspaceLeaf) {
        if (!(leaf.view instanceof MarkdownView)) {
            console.warn(leaf.view);
            throw `invalid state.  should be markdown view`;
        }
        const markdownView = leaf.view;
        this.run(markdownView.editor, markdownView);
    }


    run(editor: Editor, view: MarkdownView) {
        if (this.tryEditorCheckCallback(editor, view)) {
            return;
        }
        if (this.tryEditorCallback(editor, view)) {
            return;
        }
        if (this.tryCheckCallback()) {
            return;
        }
        if (this.tryCallback()) {
            return;
        }
    }
}

export function findCommand(app: App, id: string): RunnableCommand | null {
    const command = (app as any).commands.commands[id];
    if (command) {
        return new RunnableCommand(command as Command);
    }
    return null;
}

export function findEditorCommand(app: App, id: string): RunnableEditorCommand | null {
    const command = (app as any).commands.commands[id];
    if (command) {
        return new RunnableEditorCommand(app, command as Command);
    }
    return null;
}
