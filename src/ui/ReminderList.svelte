<script lang="typescript">
  import type { GroupedReminder, Reminder } from "../model/reminder";
  import type { Component } from "obsidian";
  import ReminderListByDate from "./ReminderListByDate.svelte";

  export let groups: Array<GroupedReminder>;
  export let component: Component;
  export let onOpenReminder: (reminder: Reminder) => void;
  export let generateLink: (reminder: Reminder) => string;
</script>

<main>
  <div>
    {#each groups as group}
      <div class="group-name" class:group-name-overdue={group.isOverdue}>
        {group.name}
      </div>
      <ReminderListByDate
        reminders={group.reminders}
        {component}
        {onOpenReminder}
        timeToString={(time) => group.timeToString(time)}
        {generateLink}
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
