import { t } from "i18n";
import "plugin/ui/date-display-format-preset-chooser.css";
import {
  type DateDisplayFormatPreset,
  dateDisplayFormatPresets,
} from "model/reminder-grouping";
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
      t(preset.name).toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(preset: DateDisplayFormatPreset, el: HTMLElement) {
    // Container for name and previews
    const container = el.createDiv({ cls: "reminder-preset-suggestion" });

    // Title
    container.createDiv({
      text: t(preset.name),
      cls: "reminder-preset-title",
    });

    // Preview using "now" (with defaultTime omitted: previews are independent of default time)
    const now = DateTime.now();

    const previewsEl = container.createDiv({
      cls: "reminder-preset-previews",
    });

    // Year & Month example
    previewsEl.createDiv({
      cls: "reminder-preset-preview-line",
      text: t("Year/Month: {value}", {
        value: now.formatForDisplay(preset.format.yearMonthFormat),
      }),
    });

    // Month & Day example
    previewsEl.createDiv({
      cls: "reminder-preset-preview-line",
      text: t("Month/Day: {value}", {
        value: now.formatForDisplay(preset.format.monthDayFormat),
      }),
    });

    // Short date with weekday example
    previewsEl.createDiv({
      cls: "reminder-preset-preview-line",
      text: t("Short: {value}", {
        value: now.formatForDisplay(preset.format.shortDateWithWeekdayFormat),
      }),
    });

    // Time example
    previewsEl.createDiv({
      cls: "reminder-preset-preview-line",
      text: t("Time: {value}", {
        value: now.formatForDisplay(preset.format.timeFormat),
      }),
    });
  }

  onChooseSuggestion(preset: DateDisplayFormatPreset) {
    this.onSelect(preset);
  }
}
