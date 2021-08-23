<script lang="typescript">
    import { DateTime, Laters } from "model/time";
    import moment from "moment";
    import { Calendar } from "model/calendar";

    import CalendarView from "./Calendar.svelte";

    type RelativeDateTime = {
        title: string;
        completion: DateTime;
    };

    export const relativeDateTimes: Array<RelativeDateTime> = Laters.map(
        (l) => ({ title: l.label, completion: l.later() })
    );
    export let calendar: Calendar = new Calendar();
    export let selectedDate = moment();

    function selectDate(date: moment.Moment) {
        // clone() for re-render forcibly
        selectedDate = date.clone();
        calendar = new Calendar(moment(), date);
    }

    export function moveUp() {
        selectDate(selectedDate.add(-7, "day"));
    }
    export function moveDown() {
        selectDate(selectedDate.add(7, "day"));
    }
    export function moveLeft() {
        selectDate(selectedDate.add(-1, "day"));
    }
    export function moveRight() {
        selectDate(selectedDate.add(1, "day"));
    }
    export function selection() {
        return new DateTime(selectedDate, false);
    }
    export let onClick: (time: DateTime) => void;
</script>

<div class="dtchooser">
    <CalendarView {onClick} {selectedDate} {calendar} />
    <hr class="dtchooser-divider" />
    <div>
        <ul>
            <li>reminder 1</li>
            <li>reminder 2</li>
        </ul>
    </div>
</div>

<style>
    .dtchooser {
        background-color: var(--background-primary-alt);
        position: absolute;
        z-index: 2147483647;
    }
    .dtchooser-divider {
        margin: 0.5rem;
    }
</style>
