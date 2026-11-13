<script lang="typescript">
  import { createEventDispatcher } from "svelte";

  export let label: string;
  export let title: string;

  const dispatch = createEventDispatcher<{ activate: void }>();

  function handleActivate(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    dispatch("activate");
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      dispatch("activate");
    }
  }
</script>

<span
  class="reminder-pill"
  role="button"
  tabindex="0"
  {title}
  on:click={handleActivate}
  on:keydown={handleKeydown}
  on:mousedown|preventDefault|stopPropagation
>
  {label}
</span>

<style>
  .reminder-pill {
    background: var(--tag-background);
    border: 1px solid var(--tag-border-color);
    color: var(--text-normal);
    border-radius: calc(var(--radius-s) + 4px);
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    font-size: 0.95em;
    cursor: pointer;
    user-select: none;
  }

  .reminder-pill:hover,
  .reminder-pill:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 1px;
  }
</style>
