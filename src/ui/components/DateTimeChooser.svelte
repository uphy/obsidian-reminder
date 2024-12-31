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
    <CalendarView bind:value={date} on:select={()=>handleSelect()}>
        <div slot="footer">
            <hr class="dtchooser-divider" />
            <ReminderListByDate
                reminders={reminders.byDate(new DateTime(date, false))}
                {component}
            />
        </div>
    </CalendarView>
    <div class="dtchooser-wrapper">
        <div class="dtchooser-time-picker">
            <span>Time: </span>
            <TimePicker bind:value={time} step={15} on:select={()=>{handleSelect()}} />
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