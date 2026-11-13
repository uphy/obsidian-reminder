/**
 * Builds the ntfy settings models and their connection-test action.
 * The server settings are registered as the ntfy page when added to the tab.
 */
import { t } from "i18n";
import { isValidNtfyTopic } from "model/ntfy";
import { requestUrl } from "obsidian";
import { testNtfyConnection } from "plugin/ntfy/connection-test";
import { RawSerde } from "plugin/settings/serdes";
import { SettingContext } from "plugin/settings/setting-model";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";

export class NtfySettings {
  enabled: SettingModel<boolean, boolean>;
  serverUrl: SettingModel<string, string>;
  topic: SettingModel<string, string>;
  accessToken: SettingModel<string, string>;

  constructor(private settings: SettingTabModel) {
    this.enabled = this.settings
      .newSettingBuilder()
      .key("ntfyEnabled")
      .name("Enable ntfy scheduled notifications (experimental)")
      .desc(
        "Publish upcoming reminders to the ntfy server below as scheduled push notifications, so you're notified even when Obsidian isn't running (useful on mobile, where plugins can't run in the background). " +
          "This sends reminder titles to that server, so only enable this if you trust it. " +
          "Requires an ntfy server running v2.16.0 or later (needed for sequence-ID based scheduled message replacement/deletion). " +
          "Only reminders due within the next 24 hours are registered — ntfy itself allows scheduling at most 3 days ahead, and this plugin periodically re-registers reminders to roll that 24-hour window forward.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.serverUrl = this.settings
      .newSettingBuilder()
      .key("ntfyServerUrl")
      .name("ntfy server URL")
      .desc("The ntfy server to publish scheduled notifications to.")
      .text("https://ntfy.sh")
      .placeHolder("https://ntfy.sh")
      .build(new RawSerde());

    this.topic = this.settings
      .newSettingBuilder()
      .key("ntfyTopic")
      .name("ntfy topic")
      .desc(
        "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. " +
          "May only contain letters, digits, dashes and underscores (1-64 characters).",
      )
      .text("")
      .placeHolder("a-long-random-topic-name")
      // Validated here rather than in a Serde that throws: a Serde rejection
      // also makes `value` throw when the persisted value is invalid. The
      // controller repeats this check before sending any request.
      .onAnyValueChanged((context: SettingContext) => {
        const topic = this.topic.value.trim();
        context.setValidationError(
          topic.length === 0 || isValidNtfyTopic(topic)
            ? null
            : t(
                "A topic may only contain letters, digits, dashes and underscores (1-64 characters).",
              ),
        );
      })
      .build(new RawSerde());

    this.accessToken = this.settings
      .newSettingBuilder()
      .key("ntfyAccessToken")
      .name("ntfy access token")
      .desc(
        "Only needed for a server that requires authentication (a self-hosted instance with access control, for example); leave it empty otherwise. " +
          "Create one with `ntfy token add <user>` or from the ntfy web app under Account → Access tokens. The token needs read-write access to the topic above, because this plugin reads, publishes and deletes scheduled messages. " +
          "It is stored in plain text in this plugin's data.json, which is synced along with your vault if you sync your Obsidian configuration folder.",
      )
      .text("")
      .masked()
      .placeHolder("tk_...")
      .button("Test", async (context) => {
        context.setValidationError(null);
        context.setInfo(t("Testing…"));
        const result = await testNtfyConnection(
          async (request) => requestUrl({ ...request, throw: false }),
          {
            serverUrl: this.serverUrl.value,
            topic: this.topic.value,
            accessToken: this.accessToken.value,
          },
        );
        context.setInfo(result.ok ? result.message : null);
        context.setValidationError(result.ok ? null : result.message);
      })
      .onAnyValueChanged((context: SettingContext) => {
        context.setInfo(null);
      })
      .build(new RawSerde());
  }

  addToTab(): void {
    this.settings
      .newPage("ntfy")
      .newGroup()
      .addSettings(this.enabled, this.serverUrl, this.topic, this.accessToken);
  }
}
