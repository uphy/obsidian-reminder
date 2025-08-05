<script lang="typescript">
  import type { DateTime } from "../model/time";
  import type { Reminder } from "../model/reminder";
  import Markdown from "./Markdown.svelte";

  export let reminders: Array<Reminder>;
  export let onOpenReminder: (reminder: Reminder) => void = () => {};
  // Fix incorrect Moment.js token: use mm for minutes (MM is month)
  export let timeToString = (time: DateTime) => time.format("HH:mm");
  export let generateLink: (reminder: Reminder) => string = () => "";
</script>

<div class="reminder-group">
  {#if reminders.length === 0}
    <div class="reminder-list-item no-reminders">No reminders</div>
  {:else}
    <div>
      {#each reminders as reminder}
        <button
          class="reminder-list-item hover-highlight"
          aria-label={`[${reminder.time.toString()}] ${
            reminder.title
          } - ${reminder.getFileName()}`}
          draggable="true"
          tabindex="-1"
          on:dragstart={(e) => {
            e.dataTransfer?.setData("text/plain", generateLink(reminder));
          }}
          on:click={() => {
            onOpenReminder(reminder);
          }}
        >
          <span class="reminder-time">
            {timeToString(reminder.time)}
          </span>
          <div class="reminder-title-container">
            <span class="reminder-title">
              <Markdown markdown={reminder.title} sourcePath={reminder.file} />
            </span>
            <span class="reminder-file">
              {reminder.getFileName()}
            </span>
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
  /* Ensure footer reminder items are not tabbable/focusable */
  .reminder-group button.reminder-list-item {
    outline: none;
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
    background-color: var(--background-secondary-alt);
  }
  .reminder-time {
    display: inline-block;
    font-size: 14px;
    font-family: monospace, serif;
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
