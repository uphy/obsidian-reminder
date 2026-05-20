<script lang="typescript">
  import type { GroupedReminder, Reminder } from "../model/reminder";
  import type { DateTime } from "../model/time";
  import ReminderListByDate from "./ReminderListByDate.svelte";

  export let groups: Array<GroupedReminder>;
  export let onOpenReminder: (reminder: Reminder) => void;
  export let generateLink: (reminder: Reminder) => string;
  export let onRescheduleContext: (event: MouseEvent | TouchEvent, reminder: Reminder) => void = () => {};
</script>

<main>
  <div>
    {#each groups as group}
      <div class="group-name" class:group-name-overdue={group.isOverdue}>
        {group.name}
      </div>
      <ReminderListByDate
        reminders={group.reminders}
        {onOpenReminder}
        timeToString={(time) => group.timeToString(time)}
        {generateLink}
        {onRescheduleContext}
        isOverdue={group.isOverdue}
      />
    {/each}
  </div>
</main>

<style>
  .group-name {
    font-size: 14px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--text-muted);
    margin-bottom: 0.5rem;
  }
  .group-name-overdue {
    color: var(--text-accent);
  }
</style>
