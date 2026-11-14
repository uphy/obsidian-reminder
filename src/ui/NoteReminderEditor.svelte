<script lang="typescript">
  import { t } from "i18n";
  import { pickInitialProperty } from "model/note/property-format";
  import type { PropertyReminderState } from "model/note/property-format";
  import type { Reminders } from "model/reminder";
  import type { DateTime } from "model/time";
  import DateTimeChooser from "./DateTimeChooser.svelte";

  export let noteName: string;
  // The managed properties, the only ones this dialog writes to.
  export let properties: Array<string>;
  // What the note holds for each of them, read when the dialog opened.
  export let states: Record<string, PropertyReminderState>;
  export let reminders: Reminders;
  export let timeStep = 15;
  export let weekStart = 0;
  export let onSave: (
    property: string,
    edit: { time: DateTime; title: string },
  ) => void;
  export let onDone: (property: string) => void;
  export let onRemindAgain: (property: string) => void;
  export let onRemove: (property: string) => void;

  let property = pickInitialProperty(properties, states) ?? "";
  let title = "";
  let loadedProperty: string | undefined = undefined;

  // Load the title of the selected property (on open and on switching).
  $: if (property !== loadedProperty) {
    loadedProperty = property;
    title = states[property]?.title ?? "";
  }

  $: state = states[property];
  $: existing = state?.time ?? undefined;
  $: status =
    existing == null
      ? ""
      : state?.done
        ? t("Done:")
        : state?.pending
          ? t("Scheduled:")
          : t("Not shown (before the cut-off):");
</script>

<div class="note-reminder-editor">
  <div class="note-reminder-heading">
    {t("Reminder for {note}", { note: noteName })}
  </div>
  {#if existing}
    <div class="note-reminder-status" class:is-inactive={!state?.pending}>
      {status}
      {existing.toString()}
    </div>
  {/if}
  <div class="note-reminder-fields">
    {#if properties.length > 1}
      <label>
        <span>{t("Property")}</span>
        <select class="dropdown" bind:value={property}>
          {#each properties as p (p)}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if state?.foreignValue == null}
      <label>
        <span>{t("Title")}</span>
        <input type="text" bind:value={title} placeholder={noteName} />
      </label>
    {/if}
  </div>
  {#if state?.foreignValue != null}
    <div class="note-reminder-error">
      {t(
        "“{property}” holds “{value}”, which is not a date. Change it in the note's properties before setting a reminder here.",
        { property, value: state.foreignValue },
      )}
    </div>
  {:else}
    <!-- Re-created per property: the chooser and its time list read the
         initial time only once. -->
    {#key property}
      <div class="note-reminder-chooser">
        <DateTimeChooser
          {reminders}
          {timeStep}
          {weekStart}
          initialTime={existing}
          onSelect={(time) => onSave(property, { time, title })}
        />
      </div>
    {/key}
  {/if}
  {#if existing}
    <div class="note-reminder-actions">
      <button class="note-reminder-remove" on:click={() => onRemove(property)}>
        {t("Remove reminder")}
      </button>
      {#if state?.pending}
        <button on:click={() => onDone(property)}>{t("Mark as Done")}</button>
      {:else if state?.done}
        <button on:click={() => onRemindAgain(property)}>
          {t("Remind again")}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .note-reminder-editor {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .note-reminder-heading {
    font-weight: var(--font-semibold);
    padding-right: 1.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note-reminder-status {
    color: var(--text-accent);
    font-size: var(--font-ui-small);
  }
  .note-reminder-status.is-inactive {
    color: var(--text-faint);
  }
  .note-reminder-fields {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  label > span {
    flex: 0 0 4.5rem;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }
  label > input,
  label > select {
    flex: 1;
    min-width: 0;
  }
  /* The chooser sizes to its calendar. In a dialog wider than that (a phone
     or tablet, where the dialog fills the screen) it sits in the middle. */
  .note-reminder-chooser {
    display: flex;
    justify-content: center;
  }
  .note-reminder-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }
  .note-reminder-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  /* On a phone or tablet the dialog fills the screen and its content
     scrolls: the calendar and the day's reminder list are taller than the
     dialog. The actions stay in view there. */
  :global(.is-mobile) .note-reminder-actions {
    position: sticky;
    bottom: 0;
    padding: 0.5rem 0;
    background-color: var(--modal-background, var(--background-primary));
  }
  .note-reminder-remove {
    padding: 0;
    color: var(--text-error);
    background-color: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    font-size: var(--font-ui-small);
  }
  .note-reminder-remove:hover {
    text-decoration: underline;
  }
</style>
