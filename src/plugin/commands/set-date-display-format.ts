import type ReminderPlugin from "main";
import { DateDisplayFormatPresetModal } from "plugin/ui/date-display-format-preset-chooser";

export function setDateDisplayFormat(
  checking: boolean,
  plugin: ReminderPlugin,
) {
  if (!checking) {
    new DateDisplayFormatPresetModal(plugin.app, (preset) => {
      // Persist selected preset formats into settings
      plugin.data.settings.monthDayDisplayFormat.rawValue.value =
        preset.format.monthDayFormat;
      plugin.data.settings.yearMonthDisplayFormat.rawValue.value =
        preset.format.yearMonthFormat;
      plugin.data.settings.shortDateWithWeekdayDisplayFormat.rawValue.value =
        preset.format.shortDateWithWeekdayFormat;
      plugin.data.settings.timeDisplayFormat.rawValue.value =
        preset.format.timeFormat;

      // Save data and refresh UI to reflect changes immediately
      plugin.data.save(true);
      plugin.ui.invalidate();
      plugin.ui.reload(true);
    }).open();
  }
  return true;
}
