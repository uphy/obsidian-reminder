import {
  type DateDisplayFormatPreset,
  dateDisplayFormatPresets,
} from "model/reminder";
import { App, SuggestModal } from "obsidian";
import { DateTime } from "model/time";

export class DateDisplayFormatPresetModal extends SuggestModal<DateDisplayFormatPreset> {
  constructor(
    app: App,
    private onSelect: (preset: DateDisplayFormatPreset) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): DateDisplayFormatPreset[] {
    return dateDisplayFormatPresets.filter((preset) =>
      preset.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(preset: DateDisplayFormatPreset, el: HTMLElement) {
    // Container for name and previews
    const container = el.createDiv({ cls: "reminder-preset-suggestion" });

    // Title
    const titleEl = container.createEl("div", {
      text: preset.name,
      cls: "reminder-preset-title",
    });

    // Preview using "now" (with defaultTime omitted: previews are independent of default time)
    const now = DateTime.now();

    const previewsEl = container.createDiv({
      cls: "reminder-preset-previews",
    });

    // Year & Month example
    previewsEl.createEl("div", {
      cls: "reminder-preset-preview-line",
      text: "Year/Month: " + now.format(preset.format.yearMonthFormat),
    });

    // Month & Day example
    previewsEl.createEl("div", {
      cls: "reminder-preset-preview-line",
      text: "Month/Day: " + now.format(preset.format.monthDayFormat),
    });

    // Short date with weekday example
    previewsEl.createEl("div", {
      cls: "reminder-preset-preview-line",
      text: "Short: " + now.format(preset.format.shortDateWithWeekdayFormat),
    });

    // Time example
    previewsEl.createEl("div", {
      cls: "reminder-preset-preview-line",
      text: "Time: " + now.format(preset.format.timeFormat),
    });

    // Basic inline styles added via element classes to avoid global CSS edits.
    // Obsidian applies its own styling; these classes allow modest spacing.
    titleEl.style.fontWeight = "600";
    titleEl.style.marginBottom = "4px";
    previewsEl.style.opacity = "0.8";
    previewsEl.style.fontSize = "12px";
    previewsEl.style.display = "grid";
    previewsEl.style.gridAutoRows = "min-content";
    previewsEl.style.rowGap = "2px";
  }

  onChooseSuggestion(preset: DateDisplayFormatPreset) {
    this.onSelect(preset);
  }
}
