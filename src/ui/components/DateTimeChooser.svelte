<script lang="typescript">
    import type { Reminders } from "model/reminder";
    import { DateTime } from "model/time";
    import moment from "moment";
    import type { Component } from "obsidian";
    import CalendarView from "./Calendar.svelte";
    import TimePicker from "./TimePicker.svelte";
    import ReminderListByDate from "./ReminderListByDate.svelte";

    export let component: Component|undefined;
    export let date = moment();
    export let reminders: Reminders;
    export let onSelect: (time: moment.Moment) => void;    
    let time = "10:00";

    function handleSelect() {
        const [hour, minute] = time.split(":");
        const selection = date.clone();
        selection.set({
            hour: parseInt(hour!),
            minute: parseInt(minute!),
        });
        onSelect(selection);
    }
</script>

<div class="dtchooser">
    <div class="dtchooser-wrapper">
        <CalendarView bind:value={date} on:select={()=>handleSelect()} />
        <div class="dtchooser-time-picker">
            <span>⏰</span>
            <TimePicker bind:value={time} step={15} on:select={()=>{handleSelect()}} />
        </div>
    </div>
    <hr class="dtchooser-divider" />
    <div class="reminder-list-container">
        <ReminderListByDate
            reminders={reminders.byDate(new DateTime(date, false))}
            {component}
        />
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
        flex-direction: column;
        justify-content: space-between;
    }
    .dtchooser-time-picker {
        display: flex;
        flex-direction: row;
        justify-content: right;
        align-items: center;
        padding-top: 0.5rem;
    }
    .dtchooser-time-picker span {
        color: var(--text-muted);
        margin-right: 0.5rem;
    }
    .reminder-list-container {
        padding: 0.5rem;
        max-width: 16rem;
    }
</style>