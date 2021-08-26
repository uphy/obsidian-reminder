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
    <table>
      <tbody>
        {#each reminders as reminder}
          <tr
            class="reminder-list-item"
            on:click={() => {
              onOpenReminder(reminder);
            }}
          >
            <td class="reminder-time">
              {timeToString(reminder.time)}
            </td>
            <td>
              <div class="reminder-title">
                {@html renderMarkdown(reminder.title)}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .reminder-group {
    margin-bottom: 1rem;
    font-size: 13px;
    color: var(--text-muted);
  }
  .reminder-group > table {
    width: 100%;
    table-layout: fixed;
    word-break: break-all;
    word-wrap: break-all;
  }
  .reminder-list-item {
    list-style: none;
    line-height: 14px;
    padding: 3px;
  }
  .reminder-list-item:hover {
    color: var(--text-normal);
    background-color: var(--background-secondary-alt);
  }
  .reminder-time {
    max-width: 40px;
    width: 40px;
    font-size: 14px;
    font-family: monospace, serif;
  }
  .reminder-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: break-all;
  }
  .no-reminders {
    font-style: italic;
  }
</style>
