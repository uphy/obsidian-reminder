<script lang="typescript">
  import { Reminder } from "../../model/reminder";
  import MarkdownIt from "markdown-it";
  import { DateTime } from "model/time";
  const md = new MarkdownIt();

  export let reminders: Array<Reminder>;
  export let onOpenReminder: (reminder: Reminder) => void = () => {};
  export let timeToString = (time: DateTime) => time.format("HH:MM");
  function renderMarkdown(markdown: string): string {
    return md.renderInline(markdown);
  }
</script>

<div class="reminder-group">
  {#if reminders.length === 0}
    <div class="reminder-list-item no-reminders">No reminders</div>
  {:else}
    <div>
      {#each reminders as reminder}
        <div
          class="reminder-list-item"
          on:click={() => {
            onOpenReminder(reminder);
          }}
        >
          <span class="reminder-time">
            {timeToString(reminder.time)}
          </span>
          <span class="reminder-title">
            {@html renderMarkdown(reminder.title)}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .reminder-group {
    margin-bottom: 1rem;
    font-size: 13px;
    color: var(--text-muted);
  }
  .reminder-list-item {
    list-style: none;
    line-height: 14px;
    padding: 3px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: break-all;
    width: 100%;
  }
  .reminder-list-item:hover {
    color: var(--text-normal);
    background-color: var(--background-secondary-alt);
  }
  .reminder-time {
    font-size: 14px;
    font-family: monospace, serif;
  }
  .no-reminders {
    font-style: italic;
  }
</style>
