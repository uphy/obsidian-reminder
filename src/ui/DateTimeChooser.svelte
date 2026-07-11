<script lang="typescript">
  import moment from "moment";
  import type { Reminders } from "model/reminder";
  import { DateTime } from "model/time";
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
</script>

<div class="dtchooser">
  <CalendarView bind:value={date} on:select={() => handleSelect()}>
    <div slot="footer">
      <hr class="dtchooser-divider" />
      <ReminderListByDate
        reminders={reminders.byDate(new DateTime(date, false))}
      />
    </div>
  </CalendarView>
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
</div>

<style>
  .dtchooser {
    background-color: var(--background-primary-alt);
    z-index: 2147483647;
  }
  .dtchooser-divider {
    margin: 0.5rem;
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
