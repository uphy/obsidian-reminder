<script lang="typescript">
  import { onMount, tick } from "svelte";
  import type { Reminder } from "model/reminder";
  import type { DateTime, Later } from "model/time";
  import IconText from "./IconText.svelte";
  import Markdown from "./Markdown.svelte";

  export let reminder: Reminder;
  export let onRemindMeLater: (time: DateTime) => void;
  export let onDone: () => void;
  export let onOpenFile: () => void;
  export let onMute: () => void;
  export let onPauseAllNotifications: () => void;
  export let onMuteAll: () => void;
  // Whether the Done button should be auto-focused when the popup opens.
  // Off by default so a stray Enter/Space keypress right after the popup
  // appears doesn't accidentally complete a reminder the user hasn't read.
  export let focusDone: boolean = false;
  // Do not set initial value so that svelte can render the placeholder `Remind Me Later`.
  let selectedIndex: number;
  export let laters: Array<Later> = [];
  let doneButton: HTMLButtonElement;
  let laterSelect: HTMLSelectElement;
  let containerEl: HTMLElement;

  function remindMeLater() {
    const selected = laters[selectedIndex];
    if (selected == null) {
      return;
    }
    onRemindMeLater(selected.later());
  }

  // Alt (Option on macOS) or Ctrl mnemonic shortcuts, matched on `evt.code`
  // (not `evt.key`) because macOS Option+letter produces symbol characters
  // (e.g. Option+D -> "∂"), while `evt.code` stays the physical key ("KeyD").
  // Ctrl is the fallback for environments where OS-level tools (window
  // managers, launchers) intercept Option/Alt chords before they reach
  // Obsidian -- common on macOS, where Ctrl+letter is nearly always free.
  function handleKeydown(evt: KeyboardEvent) {
    const alt = evt.altKey && !evt.ctrlKey;
    const ctrl = evt.ctrlKey && !evt.altKey;
    if ((!alt && !ctrl) || evt.metaKey || evt.shiftKey) {
      return;
    }
    switch (evt.code) {
      case "KeyD":
        evt.preventDefault();
        evt.stopPropagation();
        onDone();
        break;
      case "KeyM":
        evt.preventDefault();
        evt.stopPropagation();
        onMute();
        break;
      case "KeyO":
        evt.preventDefault();
        evt.stopPropagation();
        onOpenFile();
        break;
      case "KeyS":
        evt.preventDefault();
        evt.stopPropagation();
        laterSelect.focus();
        break;
    }
  }

  onMount(async () => {
    await tick();
    if (focusDone) {
      doneButton.focus();
    } else {
      // Without an explicit focus target, Obsidian's Modal focuses the first
      // focusable element in the modal (the file-name button), so a stray
      // Enter would open the note. Focusing the inert container instead makes
      // a stray Enter a no-op, while Tab still reaches the buttons.
      containerEl.focus();
    }
  });
</script>

<!-- Capture phase so the shortcuts run before Obsidian's own keymap/hotkey
handlers (e.g. Ctrl+O would otherwise also trigger the quick switcher). -->
<svelte:window on:keydown|capture={handleKeydown} />

<main bind:this={containerEl} tabindex="-1">
  <h3 class="reminder-title" aria-label={reminder.title}>
    <Markdown markdown={reminder.title} sourcePath={reminder.file} />
  </h3>
  <button
    class="reminder-file"
    on:click={onOpenFile}
    aria-label={reminder.file}
    title="Alt+O / Ctrl+O"
    aria-keyshortcuts="Alt+O Control+O"
  >
    <IconText icon="link" text={reminder.file} />
  </button>
  <div class="reminder-actions">
    <button
      class="mod-cta"
      on:click={onDone}
      bind:this={doneButton}
      title="Alt+D / Ctrl+D"
      aria-keyshortcuts="Alt+D Control+D"
    >
      <IconText icon="check-small" /><span
        ><span class="mnemonic">D</span>one</span
      >
    </button>
    <button
      on:click={onMute}
      title="Alt+M / Ctrl+M"
      aria-keyshortcuts="Alt+M Control+M"
    >
      <IconText icon="minus-with-circle" /><span
        ><span class="mnemonic">M</span>ute</span
      >
    </button>
    <select
      class="dropdown later-select"
      bind:value={selectedIndex}
      bind:this={laterSelect}
      on:change={remindMeLater}
      title="Alt+S / Ctrl+S"
      aria-keyshortcuts="Alt+S Control+S"
    >
      <!-- placeholder -->
      <option selected disabled hidden>Snooze</option>
      <!-- options -->
      {#each laters as later, i (i)}
        <option value={i} selected={selectedIndex === i}>{later.label}</option>
      {/each}
    </select>
  </div>
  <div class="reminder-secondary-actions">
    <button
      class="reminder-footer-action"
      on:click={onPauseAllNotifications}
      title="Pause all notifications for a chosen duration. Reminders are not muted: anything still overdue notifies you again after the pause ends."
    >
      Pause all notifications…
    </button>
    <button
      class="reminder-footer-action"
      on:click={onMuteAll}
      title="Mute every currently overdue reminder. Muted reminders stay silent (even across restarts) until you snooze them or change their date."
    >
      Mute all reminders…
    </button>
  </div>
</main>

<style>
  main:focus {
    outline: none;
  }

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

  .reminder-secondary-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reminder-footer-action {
    display: block;
    margin-top: 0.75rem;
    padding: 0;
    color: var(--text-faint);
    cursor: pointer;
    background-color: transparent;
    border: none;
    text-decoration: underline;
    box-shadow: none;
    font-size: 12px;
  }

  .reminder-footer-action:hover {
    color: var(--text-muted);
  }

  .mnemonic {
    text-decoration: underline;
  }
</style>
