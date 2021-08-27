<script lang="typescript">
  import { Reminder } from "../../model/reminder";
  import { Laters, DateTime } from "../../model/time";

  export let reminder: Reminder;
  export let onRemindMeLater: (time: DateTime) => void;
  export let onDone: () => void;
  // Do not set initial value so that svelte can render the placeholder `Remind Me Later`.
  let selectedIndex: number;

  function remindMeLater() {
    onRemindMeLater(Laters[selectedIndex].later());
  }
</script>

<main>
  <h1>{reminder.title}</h1>
  <span class="reminder-file">{reminder.file}</span>
  <div class="reminder-actions">
    <button class="mod-cta" on:click={onDone}>Mark as Done</button>
    <select
      class="dropdown"
      bind:value={selectedIndex}
      on:change={remindMeLater}
    >
      <!-- placeholder -->
      <option selected disabled hidden>Remind Me Later</option>
      <!-- options -->
      {#each Laters as later, i}
        <option value={i} selected={selectedIndex === i}>{later.label}</option>
      {/each}
    </select>
  </div>
</main>

<style>
  main {
    padding: 1em;
    margin: 0 auto;
  }

  .reminder-actions {
    margin-top: 1rem;
  }

  .reminder-file {
    color: var(--text-muted);
  }
</style>
