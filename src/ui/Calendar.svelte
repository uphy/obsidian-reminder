<script lang="typescript">
    import { Calendar } from "./calendar";
    import moment from "moment";
    import { createEventDispatcher, onMount } from 'svelte';
    import { TimedInputHandler } from "./timed-input-handler";

    export let value: moment.Moment = moment();
    const dispatch = createEventDispatcher();
    $: calendar = new Calendar(moment().startOf("day"), value.startOf("day"));
    let table: HTMLElement;
    let slot: HTMLElement;

    function onClick(clicked: moment.Moment){
        value = clicked;
    }
    function onDoubleClick(clicked: moment.Moment){
        value = clicked;
        dispatchSelect();
    }
    function previousMonth() {
        value = value.add(-1, "month");
    }
    function nextMonth() {
        value = value.add(1, "month");
    }
    function dispatchSelect() {
        dispatch("select", value);
    }
    const timedInputHandler = new TimedInputHandler();
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key >= "0" && event.key <= "9") {
            event.preventDefault();
            let input = timedInputHandler.handle(event.key);
            switch(input.length){
                case 1:
                    {
                        const date = parseInt(input);
                        if (date > 0) {
                            value = value.set("date", date);
                        }
                        break;
                    }
                case 2:
                    if (input.startsWith("0")) {
                        input = input.slice(1);
                    }
                    value = value.set("date", parseInt(input));
                    break;
                case 4:
                    let month = input.slice(0, 2);
                    let date = input.slice(2, 4);
                    if (month.startsWith("0")) {
                        month = month.slice(1);
                    }
                    if (date.startsWith("0")) {
                        date = date.slice(1);
                    }
                    value = value.set("month", parseInt(month) - 1);
                    value = value.set("date", parseInt(date));
                    break;
            }
            return;
        }
        timedInputHandler.clear();

        if (event.key === "ArrowLeft" || (event.ctrlKey && event.key === "B")) {
            value = value.add(-1, "day");
            event.preventDefault();
        } else if (event.key === "ArrowRight" || (event.ctrlKey && event.key === "F")) {
            value = value.add(1, "day");
            event.preventDefault();
        } else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "P")) {
            value = value.add(-7, "day");
        } else if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "N")) {
            value = value.add(7, "day");
            event.preventDefault();
        } else if (event.key === "Enter") {
            dispatchSelect();
            event.preventDefault();
        }
    }

    onMount(()=>{
        // Force the footer slot to be the same width as the table
        slot.style.width = table.clientWidth + "px";
    });
</script>
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="reminder-calendar" tabindex="0" role="grid" on:focus={()=>{dispatch("focus")}} on:blur={()=>{dispatch("blur")}} on:keydown={handleKeyDown}>
    <div class="year-month">
        <button tabindex="-1" class="month-nav" on:click={() => previousMonth()}>&lt;</button>
        <span class="month">{calendar.current.monthStart.format("MMM")}</span>
        <span class="year">{calendar.current.monthStart.format("YYYY")}</span>
        <button tabindex="-1" class="month-nav" on:click={() => nextMonth()}>&gt;</button>
    </div>
    <table bind:this={table}>
        <thead>
            <tr>
                <th>SUN</th>
                <th>MON</th>
                <th>TUE</th>
                <th>WED</th>
                <th>THU</th>
                <th>FRI</th>
                <th>SAT</th>
            </tr>
        </thead>
        <tbody>
            {#each calendar.current.weeks as week}
                <tr>
                    {#each week.days as day}
                        <td>
                            <button 
                                tabindex="-1"
                                class="calendar-date"
                                class:is-selected={day.isToday(value)}
                                class:other-month={!calendar.current.isThisMonth(
                                    day.date
                                )}
                                class:is-holiday={day.isHoliday()}
                                class:is-past={day.date.isBefore(calendar.today)}
                                on:click={() => onClick(day.date)}
                                on:dblclick={() => onDoubleClick(day.date)}>
                                {day.date.format("D")}
                            </button>
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
    <div class="footer" bind:this={slot}>
        <slot name="footer" />
    </div>
</div>

<style>
    button {
        background-color: transparent;
        box-shadow: none;
    }
    button:hover {
        box-shadow: var(--input-shadow)
    }
    .reminder-calendar {
        display: inline-block;
        padding: 0.5rem;
    }
    .reminder-calendar:focus {
        border-radius: var(--input-radius);
        box-shadow: 0 0 0px 1px var(--background-modifier-border-focus);
    }
    .reminder-calendar .year-month {
        font-size: 1rem;
        font-weight: bold;
        text-align: center;
    }
    .reminder-calendar .month-nav {
        color: var(--text-muted);
        margin-left: 1rem;
        margin-right: 1rem;
        cursor: pointer;
    }
    .reminder-calendar .month {
        color: var(--text-muted);
    }
    .reminder-calendar .year {
        color: var(--text-accent);
    }
    .reminder-calendar th {
        font-size: 0.7rem;
        color: var(--text-muted);
    }
    .reminder-calendar .calendar-date {
        text-align: center;
        min-width: 2rem;
        max-width: 2rem;
    }
    .reminder-calendar .calendar-date:hover {
        background-color: var(--background-secondary-alt);
        border-radius: var(--input-radius);
    }
    .reminder-calendar .is-selected {
        background-color: var(--text-accent) !important;
        color: var(--text-normal) !important;
        border-radius: var(--input-radius);
    }
    .reminder-calendar .other-month,
    .reminder-calendar .is-past,
    .reminder-calendar .is-holiday {
        color: var(--text-faint) !important;
    }
</style>
