<script lang="typescript">
  import moment from "moment";
  import { setIcon } from "obsidian";
  import { tick } from "svelte";
  import type { Reminders } from "model/reminder";
  import { DEFAULT_LATERS, DateTime, type Later } from "model/time";
  import CalendarView from "./Calendar.svelte";
  import TimePicker from "./TimePicker.svelte";
  import ReminderListByDate from "./ReminderListByDate.svelte";

  export let reminders: Reminders;
  export let onSelect: (time: DateTime) => void;
  export let timeStep = 15;
  // When set, pre-initializes the calendar (and, if it has a time part, the
  // time input) from this value instead of the usual "now"/reminder-time
  // defaults. Used when editing an existing reminder (e.g. from the editor
  // pill) so the chooser opens on the reminder's current time.
  export let initialTime: DateTime | undefined = undefined;

  export let date = initialTime?.moment().clone() ?? moment();
  let time = initialTime?.hasTimePart
    ? initialTime.format("HH:mm")
    : (reminders.reminderTime?.value.toString() ?? "10:00");
  let timeIsFocused = initialTime?.hasTimePart ?? false;

  type Mode = "calendar" | "quickpick";
  let mode: Mode = "calendar";

  let filterQuery = "";
  let selectedIndex = 0;
  let filterInputEl: HTMLInputElement | undefined;
  let modeToggleIconEl: HTMLElement | undefined;
  let calendarViewComponent: CalendarView | undefined;

  // Re-render the Lucide icon whenever the mode changes, not just on mount.
  $: if (modeToggleIconEl) {
    setIcon(modeToggleIconEl, mode === "calendar" ? "clock" : "calendar");
  }

  $: filteredLaters = DEFAULT_LATERS.filter((later) =>
    later.label.toLowerCase().includes(filterQuery.toLowerCase()),
  );
  // Reset the highlighted item whenever the filter text changes.
  $: if (filterQuery !== undefined) {
    selectedIndex = 0;
  }

  function handleSelect() {
    const [hour, minute] = time.split(":");
    const selection = date.clone();
    if (timeIsFocused) {
      selection.set({
        hour: parseInt(hour!),
        minute: parseInt(minute!),
      });
      onSelect(new DateTime(selection, true));
    } else {
      onSelect(new DateTime(selection, false));
    }
  }

  function handleLaterSelect(later: Later) {
    onSelect(later.later());
  }

  async function enterQuickPickMode() {
    mode = "quickpick";
    filterQuery = "";
    selectedIndex = 0;
    await tick();
    filterInputEl?.focus();
  }

  async function returnToCalendarMode() {
    mode = "calendar";
    filterQuery = "";
    await tick();
    calendarViewComponent?.focus();
  }

  function toggleMode() {
    if (mode === "calendar") {
      void enterQuickPickMode();
    } else {
      void returnToCalendarMode();
    }
  }

  const FORM_TAG_NAMES = ["INPUT", "SELECT", "TEXTAREA"];

  // "+" mirrors typing "(@+" in the editor: it swaps the calendar for the
  // quick-pick list. Ignored while a form field (e.g. TimePicker) has focus
  // so normal typing isn't hijacked.
  function handleKeyDown(event: KeyboardEvent) {
    if (mode !== "calendar" || event.key !== "+") {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && FORM_TAG_NAMES.includes(target.tagName)) {
      return;
    }
    void enterQuickPickMode();
    event.preventDefault();
  }

  // Mirrors Obsidian's SuggestModal keyboard UX (filter + arrow keys + enter)
  // for the inline quick-pick list.
  function handleFilterKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (filteredLaters.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredLaters.length;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (filteredLaters.length > 0) {
          selectedIndex =
            (selectedIndex - 1 + filteredLaters.length) % filteredLaters.length;
        }
        break;
      case "Enter": {
        event.preventDefault();
        const later = filteredLaters[selectedIndex];
        if (later) {
          handleLaterSelect(later);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        // Stop the popup's own Escape handler (cm6-datetime-chooser.ts) from
        // also canceling the whole popup once we've already handled it here.
        event.stopPropagation();
        void returnToCalendarMode();
        break;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dtchooser" on:keydown={handleKeyDown}>
  {#if mode === "calendar"}
    <div class="dtchooser-calendar-area">
      <button
        type="button"
        class="dtchooser-mode-toggle dtchooser-mode-toggle-overlay"
        aria-label="Show quick date picks"
        title="Show quick date picks"
        on:click={toggleMode}
      >
        <span class="dtchooser-mode-toggle-icon" bind:this={modeToggleIconEl}
        ></span>
      </button>
      <CalendarView
        bind:value={date}
        bind:this={calendarViewComponent}
        on:select={() => handleSelect()}
      >
        <div slot="footer">
          <hr class="dtchooser-divider" />
          <ReminderListByDate
            reminders={reminders.byDate(new DateTime(date, false))}
          />
        </div>
      </CalendarView>
    </div>
    <div class="dtchooser-wrapper">
      <div class="dtchooser-time-picker">
        <span>Time: </span>
        <TimePicker
          bind:value={time}
          step={timeStep}
          on:select={() => {
            handleSelect();
          }}
          on:focus={() => {
            timeIsFocused = true;
          }}
        />
      </div>
      <button class="mod-cta" on:click={handleSelect}>OK</button>
    </div>
  {:else}
    <div class="dtchooser-header">
      <input
        type="text"
        class="dtchooser-quick-pick-filter"
        placeholder="Filter..."
        bind:value={filterQuery}
        bind:this={filterInputEl}
        on:keydown={handleFilterKeyDown}
      />
      <button
        type="button"
        class="dtchooser-mode-toggle"
        aria-label="Show calendar"
        title="Show calendar"
        on:click={toggleMode}
      >
        <span class="dtchooser-mode-toggle-icon" bind:this={modeToggleIconEl}
        ></span>
      </button>
    </div>
    <div class="dtchooser-calendar-area">
      <div class="dtchooser-quick-picks">
        {#each filteredLaters as later, i (later.label)}
          <button
            type="button"
            class="dtchooser-quick-pick"
            class:is-selected={i === selectedIndex}
            on:click={() => handleLaterSelect(later)}
            on:mouseenter={() => (selectedIndex = i)}
          >
            {later.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .dtchooser {
    background-color: var(--background-primary-alt);
    z-index: 2147483647;
  }
  .dtchooser-divider {
    margin: 0.5rem;
  }
  .dtchooser-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0 0.5rem;
  }
  .dtchooser-calendar-area {
    position: relative;
  }
  .dtchooser-mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0.1rem 0.3rem;
    border: none;
    background-color: transparent;
    box-shadow: none;
    color: var(--text-muted);
    line-height: 1;
    cursor: pointer;
  }
  .dtchooser-mode-toggle-overlay {
    position: absolute;
    top: 0.5rem;
    /* Center the icon over the calendar's rightmost (Sat) column: the
       column is 2rem wide, so its center sits 1.5rem in from the calendar's
       right edge; offset further by half the button's own width. */
    right: 0.7rem;
    z-index: 1;
  }
  .dtchooser-mode-toggle:hover {
    color: var(--text-normal);
  }
  .dtchooser-mode-toggle-icon {
    display: flex;
    width: var(--icon-size, 1rem);
    height: var(--icon-size, 1rem);
  }
  .dtchooser-mode-toggle-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
  .dtchooser-quick-picks {
    display: flex;
    flex-direction: column;
    min-width: 14rem;
    padding: 0.5rem;
  }
  .dtchooser-quick-pick-filter {
    flex: 1;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    background-color: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }
  .dtchooser-quick-pick {
    padding: 0.35rem 0.5rem;
    border: none;
    border-radius: var(--input-radius);
    background-color: transparent;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    text-align: left;
    box-shadow: none;
    cursor: pointer;
  }
  .dtchooser-quick-pick:hover,
  .dtchooser-quick-pick.is-selected {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent);
  }
  .dtchooser-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
  }
  .dtchooser-time-picker {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
  }
  .dtchooser-time-picker span {
    color: var(--text-muted);
    margin-right: 0.5rem;
  }
</style>
