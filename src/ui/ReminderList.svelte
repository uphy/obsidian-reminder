<script lang="typescript">
  import type { GroupedReminder, Reminder } from "model/reminder";
  import ReminderListByDate from "./ReminderListByDate.svelte";

  export let groups: Array<GroupedReminder>;
  export let onOpenReminder: (reminder: Reminder) => void;
  export let generateLink: (reminder: Reminder) => string;
</script>

<main>
  <div>
    {#each groups as group (group.name)}
      <div class="group-name" class:group-name-overdue={group.isOverdue}>
        {group.name}
        {#if group.reminders.length > 0}
          <span class="group-count">{group.reminders.length}</span>
        {/if}
      </div>
      <ReminderListByDate
        reminders={group.reminders}
        {onOpenReminder}
        timeToString={(time) => group.timeToString(time)}
        {generateLink}
      />
    {/each}
  </div>
</main>

<style>
  .group-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 0.5rem;
  }
  .group-name-overdue {
    color: var(--text-error);
  }
  .group-count {
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.5;
    background-color: var(--background-modifier-border);
    color: var(--text-muted);
  }
</style>
