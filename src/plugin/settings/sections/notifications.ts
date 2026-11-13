/**
 * Builds the Notifications settings models and adds their ordered page to the tab.
 */
import { Later, Time } from "model/time";
import { LatersSerde, RawSerde, TimeSerde } from "plugin/settings/serdes";
import { SettingContext } from "plugin/settings/setting-model";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";

export class NotificationsSettings {
  reminderTime: SettingModel<string, Time>;
  reminderTimeStep: SettingModel<number, number>;
  laters: SettingModel<string, Array<Later>>;
  enableNotification: SettingModel<boolean, boolean>;
  reNotifyMutedOnStartup: SettingModel<boolean, boolean>;
  notificationPopupStyle: SettingModel<string, string>;
  openNoteOnReminderClick: SettingModel<boolean, boolean>;
  useSystemNotification: SettingModel<boolean, boolean>;
  showPopupWithSystemNotification: SettingModel<boolean, boolean>;
  keepSystemNotificationOnScreen: SettingModel<boolean, boolean>;
  focusDoneButtonOnPopup: SettingModel<boolean, boolean>;
  showOverdueCountInStatusBar: SettingModel<boolean, boolean>;

  constructor(private settings: SettingTabModel) {
    this.reminderTime = this.settings
      .newSettingBuilder()
      .key("reminderTime")
      .name("Reminder time")
      .desc("Time when a reminder with no time part will show")
      .tag("re-scan")
      .text("09:00")
      .placeHolder("Time (hh:mm)")
      .build(new TimeSerde());

    this.reminderTimeStep = this.settings
      .newSettingBuilder()
      .key("reminderTimeStep")
      .name("Reminder time step (minutes)")
      .desc("Step of time for reminder time (minutes)")
      .number(15)
      .build(new RawSerde());

    this.enableNotification = this.settings
      .newSettingBuilder()
      .key("enableNotification")
      .name("Enable reminder notifications")
      .desc(
        "If disabled, reminder popups and system notifications are not shown. The reminder list view keeps working.",
      )
      .toggle(true)
      .build(new RawSerde());

    this.reNotifyMutedOnStartup = this.settings
      .newSettingBuilder()
      .key("reNotifyMutedOnStartup")
      .name("Re-notify muted reminders on startup")
      .desc(
        "When enabled, reminders you previously muted are notified again the next time Obsidian starts. " +
          "Useful if you rely on startup notifications to review overdue reminders. " +
          'If many reminders are overdue, they are shown one after another — use the "Mute all current notifications" command to silence them again.',
      )
      .toggle(false)
      .build(new RawSerde());

    this.notificationPopupStyle = this.settings
      .newSettingBuilder()
      .key("notificationPopupStyle")
      .name("Reminder popup style")
      .desc(
        "Toast: a card in the corner of the window that does not interrupt your work. Modal: a dialog in the center of the window that takes focus.",
      )
      .dropdown("toast")
      .addOption("Toast (corner card)", "toast")
      .addOption("Modal (center dialog)", "modal")
      .build(new RawSerde());

    this.openNoteOnReminderClick = this.settings
      .newSettingBuilder()
      .key("openNoteOnReminderClick")
      .name("Open note on reminder click")
      .desc(
        "When clicking a reminder in the reminder list or a system notification, open the note directly instead of showing the reminder popup.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.useSystemNotification = this.settings
      .newSettingBuilder()
      .key("useSystemNotification")
      .name("Use system notification")
      .desc("Use system notification for reminder notifications")
      .toggle(false)
      .build(new RawSerde());

    this.showPopupWithSystemNotification = this.settings
      .newSettingBuilder()
      .key("showPopupWithSystemNotification")
      .name("Show popup together with system notification")
      .desc(
        "When using system notification, also show the built-in reminder popup at the same time. The popup handles the reminder actions; the system notification acts as an alert only.",
      )
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(this.useSystemNotification.value);
      })
      .build(new RawSerde());

    this.keepSystemNotificationOnScreen = this.settings
      .newSettingBuilder()
      .key("keepSystemNotificationOnScreen")
      .name("Keep system notification on screen")
      .desc(
        "Keep the system notification on screen until you interact with it, instead of it disappearing after a few seconds. Only effective on Windows and Linux; ignored on macOS. Enable this if you use the same vault on multiple devices (e.g. via Obsidian Sync): it allows the plugin to dismiss the notification when you complete or snooze the reminder on another device.",
      )
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(this.useSystemNotification.value);
      })
      .build(new RawSerde());

    this.focusDoneButtonOnPopup = this.settings
      .newSettingBuilder()
      .key("focusDoneButtonOnPopup")
      .name("Focus Done button on popup")
      .desc(
        "Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.laters = this.settings
      .newSettingBuilder()
      .key("laters")
      .name("Remind me later")
      .desc("Line-separated list of remind me later items")
      .textArea("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .placeHolder("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .build(new LatersSerde());

    this.showOverdueCountInStatusBar = this.settings
      .newSettingBuilder()
      .key("showOverdueCountInStatusBar")
      .name("Show overdue count in status bar")
      .desc(
        "Show the number of overdue reminders in the status bar. Click it to open the reminder list.",
      )
      .toggle(true)
      .build(new RawSerde());
  }

  addToTab(): void {
    this.settings
      .newPage("Notifications")
      .newGroup()
      .addSettings(
        this.reminderTime,
        this.reminderTimeStep,
        this.laters,
        this.enableNotification,
        this.reNotifyMutedOnStartup,
        this.notificationPopupStyle,
        this.openNoteOnReminderClick,
        this.useSystemNotification,
        this.showPopupWithSystemNotification,
        this.keepSystemNotificationOnScreen,
        this.focusDoneButtonOnPopup,
        this.showOverdueCountInStatusBar,
      );
  }
}
