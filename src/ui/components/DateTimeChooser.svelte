<script lang="typescript">
    import { DateTime, Laters } from "model/time";

    import Calendar from "./Calendar.svelte";

    type RelativeDateTime = {
        title: string;
        completion: DateTime;
    };

    export const relativeDateTimes: Array<RelativeDateTime> = Laters.map(
        (l) => ({ title: l.label, completion: l.later() })
    );
    export let selectedIndex = 0;
    export function up() {
        if (selectedIndex === 0) {
            selectedIndex = relativeDateTimes.length - 1;
        } else {
            selectedIndex--;
        }
    }
    export function down() {
        selectedIndex = (selectedIndex + 1) % relativeDateTimes.length;
    }
    export function selection() {
        return relativeDateTimes[selectedIndex].completion;
    }
    export let onClick: (time: DateTime) => void;
</script>

<div class="dtchooser">
    <ul>
        {#each relativeDateTimes as relativeDateTime, i}
            <li
                class="dtchooser-item {i === selectedIndex
                    ? 'dtchooser-item-selected'
                    : ''}"
                on:click={() => {
                    selectedIndex = i;
                    onClick(relativeDateTime.completion);
                }}
            >
                {relativeDateTime.title}
                <span class="dtchooser-item-detail"
                    >- {relativeDateTime.completion}</span
                >
            </li>
        {/each}
    </ul>
    <hr class="dtchooser-divider" />
    <Calendar {onClick} />
</div>

<style>
    .dtchooser {
        background-color: var(--background-primary-alt);
        position: absolute;
        z-index: 2147483647;
    }
    .dtchooser > ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }
    .dtchooser-item {
        padding: 0 0.5rem;
        color: var(--text-muted);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .dtchooser-item-selected {
        background-color: var(--background-secondary-alt);
        color: var(--text-accent);
    }
    .dtchooser-item-detail {
        color: var(--text-muted);
    }
    .dtchooser-divider {
        margin: 0.5rem;
    }
</style>
