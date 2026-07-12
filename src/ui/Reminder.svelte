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
  // "modal": Obsidian's centered dialog (default, unchanged behavior).
  // "toast": a non-focus-stealing corner card; see the toast-specific
  // branches below (onMount, svelte:window, close button, styling).
  export let variant: "modal" | "toast" = "modal";
  // Only used by the toast variant's close (x) button.
  export let onClose: (() => void) | undefined = undefined;
  // Whether the Done button should be auto-focused when the popup opens.
  // Off by default so a stray Enter/Space keypress right after the popup
  // appears doesn't accidentally complete a reminder the user hasn't read.
  export let focusDone: boolean = false;
  // Whether keyboard mnemonics are active for this instance. Only relevant
  // to the toast variant: multiple toasts can be shown at once, and each one
  // mounts its own `svelte:window` keydown handler, so if more than one had
  // shortcuts enabled a single keypress would trigger all of them at once.
  // `ReminderToastManager` keeps this true for only the most recently shown
  // toast. The modal variant never passes this prop, so it stays `true` and
  // its behavior is unchanged.
  export let shortcutsEnabled: boolean = true;
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
    if (!shortcutsEnabled) {
      // See the `shortcutsEnabled` prop doc: only the most recently shown
      // toast has this true. Older toasts fall back to mouse/touch only.
      return;
    }
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
    if (variant === "toast") {
      // Toasts are non-intrusive corner cards: never steal focus from
      // whatever the user is doing, unlike the modal below.
      return;
    }
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
handlers (e.g. Ctrl+O would otherwise also trigger the quick switcher).
`<svelte:window>` can't be placed inside an `{#if}` block, so disabled
instances (older toasts; see `shortcutsEnabled`) are excluded inside
`handleKeydown` itself instead. -->
<svelte:window on:keydown|capture={handleKeydown} />

<main bind:this={containerEl} tabindex="-1" class:toast={variant === "toast"}>
  {#if variant === "toast"}
    <button class="reminder-toast-close" on:click={onClose} aria-label="Close">
      ×
    </button>
  {/if}
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
  {#if variant === "modal"}
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
  {/if}
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

  main.toast {
    position: relative;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 8px);
    box-shadow: var(--shadow-s);
    padding: 12px 14px;
  }

  main.toast .reminder-title {
    margin: 0 1.5rem 0.3rem 0;
    font-size: 0.95rem;
  }

  main.toast .reminder-actions {
    margin-top: 0.4rem;
    gap: 0.4rem;
  }

  main.toast .reminder-actions button,
  main.toast .later-select {
    font-size: var(--font-ui-small);
  }

  main.toast .reminder-actions button {
    padding: 2px 10px;
  }

  main.toast .reminder-file {
    display: block;
    width: 100%;
    text-align: left;
    text-decoration: none;
  }

  main.toast .reminder-file:hover {
    text-decoration: underline;
  }

  main.toast .reminder-file :global(.icon-text) {
    display: flex;
    width: 100%;
  }

  main.toast .reminder-file :global(.icon) {
    flex-shrink: 0;
  }

  main.toast .reminder-file :global(.text) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reminder-toast-close {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    color: var(--text-muted);
    background-color: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    font-size: 16px;
  }

  .reminder-toast-close:hover {
    color: var(--text-normal);
  }
</style>
