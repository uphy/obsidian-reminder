import type ReminderPlugin from "main";
import { DateDisplayFormatPresetModal } from "plugin/ui/date-display-format-preset-chooser";

export function setDateDisplayFormat(
  checking: boolean,
  plugin: ReminderPlugin,
) {
  if (!checking) {
    new DateDisplayFormatPresetModal(plugin.app, (preset) => {
      plugin.data.settings.monthDayDisplayFormat.rawValue.value =
        preset.format.monthDayFormat;
      plugin.data.settings.yearMonthDisplayFormat.rawValue.value =
        preset.format.yearMonthFormat;
      plugin.data.settings.shortDateWithWeekdayDisplayFormat.rawValue.value =
        preset.format.shortDateWithWeekdayFormat;
      plugin.ui.reload(true);
    }).open();
  }
  return true;
}
