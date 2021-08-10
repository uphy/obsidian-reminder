<script lang="typescript">
  import { GroupedReminder, Reminder } from "../../model/reminder";
  import MarkdownIt from "markdown-it";
  const md = new MarkdownIt();

  export let groups: Array<GroupedReminder>;
  export let onOpenReminder: (reminder: Reminder) => void;
  function renderMarkdown(markdown: string): string {
    return md.renderInline(markdown);
  }
</script>

<main>
  <div>
    {#each groups as group}
      <div class="reminder-group">
        <div class="group-name">{group.name}</div>
        {#if group.reminders.length === 0}
          <div class="reminder-list-item no-reminders">No reminders</div>
        {:else}
          <table>
            <tbody>
              {#each group.reminders as reminder}
                <tr
                  class="reminder-list-item"
                  on:click={() => {
                    onOpenReminder(reminder);
                  }}
                >
                  <td class="reminder-time">
                    {group.timeToString(reminder.time)}
                  </td>
                  <td>
                    {@html renderMarkdown(reminder.title)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  </div>
</main>

<style>
  .reminder-group {
    margin-bottom: 1rem;
    font-size: 13px;
    color: var(--text-muted);
  }
  .group-name {
    font-size: 14px;
    border-bottom: 1px solid var(--text-muted);
    margin-bottom: 0.5rem;
  }
  .reminder-list-item {
    list-style: none;
    line-height: 14px;
    padding: 3px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .reminder-list-item:hover {
    color: var(--text-normal);
    background-color: var(--background-secondary-alt);
  }
  .reminder-time {
    max-width: 50px;
    font-size: 14px;
    font-family: monospace, serif;
  }
  .no-reminders {
    font-style: italic;
  }
</style>
