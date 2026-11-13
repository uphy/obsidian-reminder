<script lang="typescript">
  import { t } from "i18n";
  import type { DateTime } from "model/time";
  import type { Reminder } from "model/reminder";
  import Markdown from "ui/common/Markdown.svelte";

  export let reminders: Array<Reminder>;
  export let onOpenReminder: (reminder: Reminder) => void = () => {};
  export let timeToString = (time: DateTime) => time.format("HH:mm");
  export let generateLink: (reminder: Reminder) => string = () => "";

  function displayTitle(reminder: Reminder): string {
    return reminder.source === "tasknotes"
      ? reminder.tasknotes?.taskTitle || reminder.getFileName()
      : reminder.title;
  }

  function tooltip(reminder: Reminder): string {
    const source =
      reminder.source === "tasknotes" ? `${t("TaskNotes")} - ` : "";
    return `[${reminder.effectiveTime.toString()}] ${displayTitle(reminder)} - ${source}${reminder.getFileName()}`;
  }
</script>

<div class="reminder-group">
  {#if reminders.length === 0}
    <div class="reminder-list-item no-reminders">{t("No reminders")}</div>
  {:else}
    <div>
      <!-- Keyed by position, not by `reminder.key()`: that key is
           file + title + time, which two identical task lines in one file
           share. Svelte rejects a duplicate key by throwing, and the throw
           took down the whole list — a single repeated line anywhere in the
           vault left the reminder list empty. A `Reminder` carries no id that
           is unique across the list, so there is nothing better to key on. -->
      {#each reminders as reminder, i (i)}
        <button
          class="reminder-list-item hover-highlight"
          aria-label={tooltip(reminder)}
          draggable="true"
          on:dragstart={(e) => {
            e.dataTransfer?.setData("text/plain", generateLink(reminder));
          }}
          on:click={() => {
            onOpenReminder(reminder);
          }}
        >
          <span class="reminder-time">
            {timeToString(reminder.effectiveTime)}
          </span>
          <div class="reminder-title-container">
            {#if reminder.source === "tasknotes"}
              <span
                class="reminder-source"
                aria-hidden="true"
                title={t("TaskNotes")}>TN</span
              >
            {/if}
            <span class="reminder-title">
              <Markdown
                markdown={displayTitle(reminder)}
                sourcePath={reminder.file}
              />
            </span>
            {#if reminder.source === "markdown"}
              <span class="reminder-file">
                {reminder.getFileName()}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  button {
    background-color: transparent;
    box-shadow: none;
    justify-content: flex-start;
    gap: 0.3rem;
    display: inline-flex;
  }

  .reminder-group {
    margin-bottom: 1rem;
    font-size: 13px;
    color: var(--text-muted);
  }
  .reminder-list-item {
    padding: 3px;
    width: 100%;
  }
  .reminder-list-item:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
  }
  .reminder-time {
    display: inline-block;
    font-size: 14px;
    font-family: var(--font-monospace);
  }
  .reminder-title-container {
    display: inline-flex;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-grow: 1;
    justify-content: flex-start;
    align-items: center;
  }
  .reminder-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-grow: 1;
    text-align: left;
  }
  .reminder-source {
    flex-shrink: 0;
    color: var(--interactive-accent);
    border: 1px solid var(--interactive-accent);
    border-radius: 999px;
    font-size: 0.65em;
    font-weight: 600;
    line-height: 1.4;
    margin-right: 0.35rem;
    padding: 0 0.3em;
  }
  .reminder-file {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color: var(--text-faint);
  }
  .no-reminders {
    font-style: italic;
  }
  .no-reminders:hover {
    color: var(--text-muted);
    background-color: transparent;
  }
</style>
