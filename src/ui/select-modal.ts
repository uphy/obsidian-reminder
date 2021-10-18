import { App, SuggestModal } from 'obsidian';

type SelectModalOptions<T> = {
    placeHolder?: string;
    itemToString?: (item: T) => string;
};

export function showSelectModal<T>(items: Array<T>, options?: SelectModalOptions<T>): Promise<T | null> {
    return new Promise((resolve) => {
        const suggest = new SelectModal(
            app,
            items,
            options?.itemToString ?? ((v: T) => v as any),
            options?.placeHolder ?? 'Select an item',
            (selected) => {
                resolve(selected);
            },
            () => {
                resolve(null);
            },
        );
        suggest.open();
    });
}

export class SelectModal<T> extends SuggestModal<T> {
    private selected?: T;
    constructor(
        app: App,
        private items: Array<T>,
        private itemToString: (item: T) => string,
        placeHolder: string,
        private onChoose: (taskList: T) => void,
        private onCancel: () => void,
    ) {
        super(app);
        this.setPlaceholder(placeHolder);
    }
    getSuggestions(query: string): T[] | Promise<T[]> {
        return this.items.filter((t) => this.itemToString(t).contains(query));
    }
    renderSuggestion(value: T, el: HTMLElement) {
        el.innerText = this.itemToString(value);
    }
    override selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
        this.selected = value;
        super.selectSuggestion(value, evt);
    }
    onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(item);
    }
    override onClose(): void {
        if (this.selected == null) {
            this.onCancel();
        }
    }
}
