<script lang="typescript">
  import { GroupedReminder, Reminder } from "model/reminder";
  import ReminderListByDate from "./ReminderListByDate.svelte";

  export let groups: Array<GroupedReminder>;
  export let onOpenReminder: (reminder: Reminder) => void;
</script>

<main>
  <div>
    {#each groups as group}
      <div class="group-name">{group.name}</div>
      <ReminderListByDate
        reminders={group.reminders}
        {onOpenReminder}
        timeToString={(time) => group.timeToString(time)}
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
</style>
