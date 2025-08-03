<script lang="typescript">
  import { onMount, tick } from "svelte";
  import type { Reminder } from "../model/reminder";
  import type { DateTime, Later } from "../model/time";
  import IconText from "./IconText.svelte";
  import Markdown from "./Markdown.svelte";

  export let reminder: Reminder;
  export let onRemindMeLater: (time: DateTime) => void;
  export let onDone: () => void;
  export let onOpenFile: () => void;
  export let onMute: () => void;
  // Do not set initial value so that svelte can render the placeholder `Remind Me Later`.
  let selectedIndex: number;
  export let laters: Array<Later> = [];
  let doneButton: HTMLButtonElement;

  function remindMeLater() {
    const selected = laters[selectedIndex];
    if (selected == null) {
      return;
    }
    onRemindMeLater(selected.later());
  }

  onMount(async () => {
    await tick();
    doneButton.focus();
  });
</script>

<main>
  <h3 class="reminder-title" aria-label={reminder.title}>
    <Markdown markdown={reminder.title} sourcePath={reminder.file} />
  </h3>
  <button
    class="reminder-file"
    on:click={onOpenFile}
    aria-label={reminder.file}
  >
    <IconText icon="link" text={reminder.file} />
  </button>
  <div class="reminder-actions">
    <button class="mod-cta" on:click={onDone} bind:this={doneButton}>
      <IconText icon="check-small" /><span>Done</span>
    </button>
    <button on:click={onMute}>
      <IconText icon="minus-with-circle" text="Mute" />
    </button>
    <select
      class="dropdown later-select"
      bind:value={selectedIndex}
      on:change={remindMeLater}
    >
      <!-- placeholder -->
      <option selected disabled hidden>Snooze</option>
      <!-- options -->
      {#each laters as later, i}
        <option value={i} selected={selectedIndex === i}>{later.label}</option>
      {/each}
    </select>
  </div>
</main>

<style>
  .reminder-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .reminder-title {
    margin: 0.3rem 0;
  }

  .reminder-file {
    color: var(--text-muted);
    cursor: pointer;
    background-color: transparent;
    text-decoration: underline;
    box-shadow: none;
  }

  .reminder-file:hover {
    color: var(--text-normal);
    text-decoration: underline;
  }

  .later-select {
    font-size: 14px;
  }
</style>
