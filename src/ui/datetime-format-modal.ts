import { App, FuzzySuggestModal } from "obsidian";

export class DateTimeFormatModal extends FuzzySuggestModal<string>{

    constructor(app: App, private suggestions: Array<string>, private onChooseSuggestionFunc: (item: string) => void) {
        super(app);
    }

    getItems(): string[] {
        return this.suggestions;
    }
    getItemText(item: string): string {
        return item;
    }
    onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
        this.onChooseSuggestionFunc(item);
    }

}