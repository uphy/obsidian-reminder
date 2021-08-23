<script lang="typescript">
    import { Calendar } from "model/calendar";
    import { DateTime } from "model/time";
    import moment from "moment";

    export let calendar: Calendar = new Calendar();
    export let selectedDate: moment.Moment = moment();
    export let onClick: (time: DateTime) => void = (date) => {
        console.log(date);
    };
    function previousMonth() {
        selectedDate.add(-1, "month");
        calendar = calendar.previousMonth();
    }
    function nextMonth() {
        selectedDate.add(1, "month");
        calendar = calendar.nextMonth();
    }
</script>

<div class="reminder-calendar">
    <div class="year-month">
        <span class="month-nav" on:click={() => previousMonth()}>&lt;</span>
        <span class="month">{calendar.current.monthStart.format("MMM")}</span>
        <span class="year">{calendar.current.monthStart.format("YYYY")}</span>
        <span class="month-nav" on:click={() => nextMonth()}>&gt;</span>
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
            {#each calendar.current.weeks as week, i}
                <tr>
                    {#each week.days as day, i}
                        <td
                            class="calendar-date"
                            class:is-selected={day.isToday(selectedDate)}
                            class:other-month={!calendar.current.isThisMonth(
                                day.date
                            )}
                            class:is-holiday={day.isHoliday()}
                            class:is-past={day.date.isBefore(calendar.today)}
                            on:click={() =>
                                onClick(new DateTime(day.date, false))}
                        >
                            {day.date.format("D")}
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
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
    .reminder-calendar .calendar-date:hover {
        background-color: var(--background-secondary-alt);
    }
    .reminder-calendar .is-selected {
        background-color: var(--text-accent) !important;
        color: var(--text-normal) !important;
    }
    .reminder-calendar .other-month,
    .reminder-calendar .is-past,
    .reminder-calendar .is-holiday {
        color: var(--text-faint);
    }
</style>
