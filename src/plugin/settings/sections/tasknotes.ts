/**
 * Builds the TaskNotes settings models and adds their ordered page to the tab.
 * The fetch callback is supplied by the plugin integration after construction.
 */
import type { TaskNotesPropertyNames } from "model/tasknotes/types";
import { ExcludedPathsSerde, RawSerde } from "plugin/settings/serdes";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";

export class TaskNotesSettings {
  enabled: SettingModel<boolean, boolean>;
  identificationMode: SettingModel<string, string>;
  tag: SettingModel<string, string>;
  identificationProperty: SettingModel<string, string>;
  identificationValue: SettingModel<string, string>;
  excludedFolders: SettingModel<string, Array<string>>;
  completedStatuses: SettingModel<string, string>;
  skipCompleted: SettingModel<boolean, boolean>;
  skipArchived: SettingModel<boolean, boolean>;
  archiveTag: SettingModel<string, string>;
  skipRecurringInstances: SettingModel<boolean, boolean>;
  dateOnlyAnchorTime: SettingModel<string, string>;
  ignoreOlderThanDays: SettingModel<number, number>;
  properties: Record<
    keyof TaskNotesPropertyNames,
    SettingModel<string, string>
  >;

  private settingsFetcher?: () => Promise<string>;

  constructor(private settings: SettingTabModel) {
    this.enabled = this.settings
      .newSettingBuilder()
      .key("taskNotesEnabled")
      .name("Enable TaskNotes integration")
      .desc(
        "Read TaskNotes reminder metadata from task-note frontmatter. Writing a completed status is optional and controlled by the Done behavior setting.",
      )
      .toggle(false)
      .button("Fetch from TaskNotes", async (context) => {
        context.setValidationError(null);
        context.setInfo("Fetching settings from TaskNotes…");
        try {
          const fetchSettings = this.settingsFetcher;
          if (!fetchSettings) {
            throw new Error("TaskNotes settings fetch is not available.");
          }
          context.setInfo(await fetchSettings());
        } catch (error) {
          console.error("Failed to fetch TaskNotes settings: %o", error);
          context.setInfo(null);
          context.setValidationError(
            error instanceof Error
              ? error.message
              : "Could not fetch TaskNotes settings.",
          );
        }
      })
      .build(new RawSerde());
    const identificationMode = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationMode")
      .name("Task identification mode")
      .desc("Choose which notes are considered TaskNotes tasks.")
      .dropdown("tag")
      .addOption("Task tag", "tag")
      .addOption("Property", "property")
      .addOption("Any note with valid reminders", "reminders");
    this.identificationMode = identificationMode.build(new RawSerde());
    this.tag = this.settings
      .newSettingBuilder()
      .key("taskNotesTag")
      .name("Task tag")
      .desc(
        "Tag used to identify task notes when identification mode is Task tag.",
      )
      .text("task")
      .placeHolder("task")
      .build(new RawSerde());
    this.identificationProperty = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationProperty")
      .name("Task identification property")
      .desc("Property name used to identify task notes in Property mode.")
      .text("type")
      .placeHolder("type")
      .build(new RawSerde());
    this.identificationValue = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationValue")
      .name("Task identification property value")
      .desc(
        "Required property value. Leave empty to identify notes by property presence.",
      )
      .text("task")
      .placeHolder("task")
      .build(new RawSerde());
    this.excludedFolders = this.settings
      .newSettingBuilder()
      .key("taskNotesExcludedFolders")
      .name("Excluded folders")
      .desc(
        "One folder path per line. TaskNotes reminders in these folders are ignored.",
      )
      .textArea("")
      .build(new ExcludedPathsSerde());
    this.completedStatuses = this.settings
      .newSettingBuilder()
      .key("taskNotesCompletedStatuses")
      .name("Completed statuses")
      .desc("One completed status per line.")
      .textArea("done")
      .build(new RawSerde());
    this.skipCompleted = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipCompleted")
      .name("Skip completed tasks")
      .desc(
        "Skip tasks with a completed status, status: true, or a completedDate on a non-recurring task.",
      )
      .toggle(true)
      .build(new RawSerde());
    this.skipArchived = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipArchived")
      .name("Skip archived tasks")
      .desc("Skip tasks carrying the configured archive tag.")
      .toggle(true)
      .build(new RawSerde());
    this.archiveTag = this.settings
      .newSettingBuilder()
      .key("taskNotesArchiveTag")
      .name("Archive tag")
      .desc("Tag used to identify archived tasks.")
      .text("archived")
      .placeHolder("archived")
      .build(new RawSerde());
    this.skipRecurringInstances = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipRecurringInstances")
      .name("Skip completed recurring instances")
      .desc(
        "Skip a reminder when its anchor date appears in complete_instances or skipped_instances.",
      )
      .toggle(true)
      .build(new RawSerde());
    this.dateOnlyAnchorTime = this.settings
      .newSettingBuilder()
      .key("taskNotesDateOnlyAnchorTime")
      .name("Date-only anchor time")
      .desc(
        "Local time used when a due or scheduled date has no time component. TaskNotes specifies 00:00 by default.",
      )
      .text("00:00")
      .placeHolder("00:00")
      .build(new RawSerde());
    this.ignoreOlderThanDays = this.settings
      .newSettingBuilder()
      .key("taskNotesIgnoreOlderThanDays")
      .name("Ignore reminders older than (days)")
      .desc(
        "Ignore TaskNotes reminders whose trigger is older than this many days, preventing a flood when the integration is enabled.",
      )
      .number(1)
      .build(new RawSerde());
    const propertySetting = (
      key: string,
      name: string,
      value: string,
    ): SettingModel<string, string> =>
      this.settings
        .newSettingBuilder()
        .key(key)
        .name(name)
        .text(value)
        .placeHolder(value)
        .build(new RawSerde());
    this.properties = {
      title: propertySetting("taskNotesPropertyTitle", "Title", "title"),
      status: propertySetting("taskNotesPropertyStatus", "Status", "status"),
      due: propertySetting("taskNotesPropertyDue", "Due", "due"),
      scheduled: propertySetting(
        "taskNotesPropertyScheduled",
        "Scheduled",
        "scheduled",
      ),
      reminders: propertySetting(
        "taskNotesPropertyReminders",
        "Reminders",
        "reminders",
      ),
      completedDate: propertySetting(
        "taskNotesPropertyCompletedDate",
        "Completed date",
        "completedDate",
      ),
      recurrence: propertySetting(
        "taskNotesPropertyRecurrence",
        "Recurrence",
        "recurrence",
      ),
      completeInstances: propertySetting(
        "taskNotesPropertyCompleteInstances",
        "Complete instances",
        "complete_instances",
      ),
      skippedInstances: propertySetting(
        "taskNotesPropertySkippedInstances",
        "Skipped instances",
        "skipped_instances",
      ),
    };
  }

  setSettingsFetcher(fetcher: () => Promise<string>): void {
    this.settingsFetcher = fetcher;
  }

  addToTab(): void {
    const page = this.settings.newPage("TaskNotes integration");
    page
      .newGroup()
      .addSettings(
        this.enabled,
        this.identificationMode,
        this.tag,
        this.identificationProperty,
        this.identificationValue,
        this.excludedFolders,
        this.completedStatuses,
        this.skipCompleted,
        this.skipArchived,
        this.archiveTag,
        this.skipRecurringInstances,
        this.dateOnlyAnchorTime,
        this.ignoreOlderThanDays,
      );
    page
      .newGroup("TaskNotes property names", true)
      .addSettings(...Object.values(this.properties));
  }
}
