<script lang="typescript">
    import type { Reminders } from "model/reminder";
    import { DateTime } from "model/time";
    import moment from "moment";
    import type { Component } from "obsidian";
    import CalendarView from "./Calendar.svelte";
    import ReminderListByDate from "./ReminderListByDate.svelte";

    export let component: Component|undefined;
    export let value = moment();
    export let reminders: Reminders;

    export function selection() {
        return new DateTime(value, false);
    }
    export let onSelect: (time: moment.Moment) => void;
</script>

<div class="dtchooser">
    <CalendarView bind:value={value} on:select={e=>onSelect(e.detail)} />
    <hr class="dtchooser-divider" />
    <div class="reminder-list-container">
        <ReminderListByDate
            reminders={reminders.byDate(new DateTime(value, false))}
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
    .reminder-list-container {
        padding: 0.5rem;
        max-width: 16rem;
    }
</style>
