<script lang="typescript">
    import type { Completion } from "../../model/autocomplete";
    export let completions: Array<Completion>;
    export let selectedIndex = 0;
    export function up() {
        if (selectedIndex === 0) {
            selectedIndex = completions.length - 1;
        } else {
            selectedIndex--;
        }
    }
    export function down() {
        selectedIndex = (selectedIndex + 1) % completions.length;
    }
    export function selection() {
        return completions[selectedIndex];
    }
    export let onClick: (completion: Completion) => void;
</script>

<div class="autocomplete">
    <ul>
        {#each completions as completion, i}
            <li
                class="autocomplete-item {i === selectedIndex
                    ? 'autocomplete-item-selected'
                    : ''}"
                on:click={() => {
                    selectedIndex = i;
                    onClick(completion);
                }}
            >
                {completion.title}
                <span class="autocomplete-item-detail"
                    >- {completion.completion}</span
                >
            </li>
        {/each}
    </ul>
</div>

<style>
    .autocomplete {
        background-color: var(--background-primary-alt);
        position: absolute;
        z-index: 2147483647;
    }
    .autocomplete > ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }
    .autocomplete-item {
        padding: 0 0.5rem;
        color: var(--text-muted);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .autocomplete-item-selected {
        background-color: var(--background-secondary-alt);
        color: var(--text-accent);
    }
    .autocomplete-item-detail {
        color: var(--text-muted);
    }
</style>
