import {
  type DateDisplayFormatPreset,
  dateDisplayFormatPresets,
} from "model/reminder";
import { App, SuggestModal } from "obsidian";

export class DateDisplayFormatPresetModal extends SuggestModal<DateDisplayFormatPreset> {
  constructor(
    app: App,
    private onSelect: (preset: DateDisplayFormatPreset) => void,
  ) {
    super(app);
  }

  // Returns all available suggestions.
  getSuggestions(query: string): DateDisplayFormatPreset[] {
    return dateDisplayFormatPresets.filter((preset) =>
      preset.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  // Renders each suggestion item.
  renderSuggestion(preset: DateDisplayFormatPreset, el: HTMLElement) {
    el.createEl("div", { text: preset.name });
    //el.createEl("small", { text: preset.author });
  }

  // Perform action on the selected suggestion.
  onChooseSuggestion(preset: DateDisplayFormatPreset) {
    this.onSelect(preset);
  }
}
