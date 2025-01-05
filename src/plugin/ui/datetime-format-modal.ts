import { App, FuzzySuggestModal } from 'obsidian';

class DateTimeFormatModal extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private suggestions: Array<string>,
    private onChooseSuggestionFunc: (item: string) => void,
  ) {
    super(app);
  }

  getItems(): string[] {
    return this.suggestions;
  }
  getItemText(item: string): string {
    return item;
  }
  onChooseItem(item: string): void {
    this.onChooseSuggestionFunc(item);
  }
}

export function openDateTimeFormatChooser(
  app: App,
  onSelectFormat: (dateFormat: string, dateTimeFormat: string) => void,
) {
  new DateTimeFormatModal(app, ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD-MM-YYYY', 'DD/MM/YYYY'], (dateFormat) => {
    new DateTimeFormatModal(
      app,
      ['YYYY-MM-DD HH:mm', 'YYYY/MM/DD HH:mm', 'DD-MM-YYYY HH:mm', 'DD/MM/YYYY HH:mm', 'YYYY-MM-DDTHH:mm:ss:SSS'],
      (dateTimeFormat) => {
        onSelectFormat(dateFormat, dateTimeFormat);
      },
    ).open();
  }).open();
}
