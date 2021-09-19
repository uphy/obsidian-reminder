<script lang="typescript">
  import type { Reminder } from "../../model/reminder";
  import type { DateTime, Later } from "../../model/time";
  import Icon from "./Icon.svelte";

  export let reminder: Reminder;
  export let onRemindMeLater: (time: DateTime) => void;
  export let onDone: () => void;
  export let onOpenFile: () => void;
  export let onMute: () => void;
  // Do not set initial value so that svelte can render the placeholder `Remind Me Later`.
  let selectedIndex: number;

  export let laters: Array<Later> = [];

  function remindMeLater() {
    const selected = laters[selectedIndex];
    if (selected == null) {
      return;
    }
    onRemindMeLater(selected.later());
  }
</script>

<main>
  <h1>{reminder.title}</h1>
  <span class="reminder-file" on:click={onOpenFile}>
    <Icon icon="link" />
    {reminder.file}
  </span>
  <div class="reminder-actions">
    <button class="mod-cta" on:click={onDone}>
      <Icon icon="check-small" /> Mark as Done
    </button>
    <button on:click={onMute}>
      <Icon icon="minus-with-circle" /> Mute
    </button>
    <select
      class="dropdown later-select"
      bind:value={selectedIndex}
      on:change={remindMeLater}
    >
      <!-- placeholder -->
      <option selected disabled hidden>Remind Me Later</option>
      <!-- options -->
      {#each laters as later, i}
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
    cursor: pointer;
  }

  .reminder-file:hover {
    color: var(--text-normal);
    text-decoration: underline;
  }

  .later-select {
    font-size: 14px;
  }
</style>
