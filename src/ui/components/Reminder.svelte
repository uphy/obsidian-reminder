<script lang="typescript">
  import { Reminder } from "../../model/reminder";
  import { Laters, Later, DateTime } from "../../model/time";

  export let reminder: Reminder;
  export let onRemindMeLater: (time: DateTime) => void;
  export let onDone: () => void;
  let selectedLater: Later | null = null;

  function remindMeLater() {
    onRemindMeLater(selectedLater.later());
  }
</script>

<main>
  <h1>{reminder.title}</h1>
  <span class="reminder-file">{reminder.file}</span>
  <div class="reminder-actions">
    <button class="mod-cta" on:click={onDone}>Mark as Done</button>
    <select
      bind:value={selectedLater}
      class="dropdown"
      on:change={remindMeLater}
    >
      <!-- placeholder -->
      <option
        value=""
        disabled
        selected={selectedLater === null}
        style="display:none;">Remind Me Later</option
      >
      <!-- options -->
      {#each Laters as later}
        <option value={later} selected={selectedLater === later}>
          {later.label}
        </option>
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
