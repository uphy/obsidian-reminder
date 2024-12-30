<script lang="typescript">
    import { Calendar } from "model/calendar";
    import moment from "moment";
    import { createEventDispatcher } from 'svelte';

    export let value: moment.Moment = moment();
    const dispatch = createEventDispatcher();
    $: calendar = new Calendar(moment().startOf("day"), value.startOf("day"));

    function onClick(clicked: moment.Moment){
        value = clicked;
        dispatchSelect();
    };
    function previousMonth() {
        value = value.add(-1, "month");
    }
    function nextMonth() {
        value = value.add(1, "month");
    }
    function dispatchSelect() {
        dispatch("select", value);
    }
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowLeft" || (event.ctrlKey && event.key === "B")) {
            value = value.add(-1, "day");
        } else if (event.key === "ArrowRight" || (event.ctrlKey && event.key === "F")) {
            value = value.add(1, "day");
        } else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "P")) {
            value = value.add(-7, "day");
        } else if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "N")) {
            value = value.add(7, "day");
        } else if (event.key === "Enter") {
            dispatchSelect();
        }
    }
</script>
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="reminder-calendar" tabindex="0" on:focus={()=>{dispatch("focus")}} on:blur={()=>{dispatch("blur")}} on:keydown|preventDefault={handleKeyDown}>
    <div class="year-month">
        <button class="month-nav" on:click={() => previousMonth()}>&lt;</button>
        <span class="month">{calendar.current.monthStart.format("MMM")}</span>
        <span class="year">{calendar.current.monthStart.format("YYYY")}</span>
        <button class="month-nav" on:click={() => nextMonth()}>&gt;</button>
    </div>
    <table>
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
                                class="calendar-date"
                                class:is-selected={day.isToday(value)}
                                class:other-month={!calendar.current.isThisMonth(
                                    day.date
                                )}
                                class:is-holiday={day.isHoliday()}
                                class:is-past={day.date.isBefore(calendar.today)}
                                on:click={() => onClick(day.date)}>
                                {day.date.format("D")}
                            </button>
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
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
        padding: 0.5rem;
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
    .reminder-calendar .calendar-date > button{
        padding: 0;
        width: 100%;
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
