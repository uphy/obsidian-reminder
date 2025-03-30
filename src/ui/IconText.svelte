<script lang="typescript">
  import { setIcon } from "obsidian";
  import { onMount } from "svelte";
  export let icon = "";
  export let text = "";
  let span: HTMLElement;

  onMount(() => {
    setIcon(span, icon);
  });
</script>

<div class="icon-text">
  <span class="icon" bind:this={span}></span>
  <span class="text">{text}</span>
</div>

<style>
  .icon-text {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .icon {
    vertical-align: middle;
  }
</style>
