<script lang="typescript">
  import { setIcon } from "obsidian";
  import { onMount } from "svelte";
  export let icon = "";
  let span: HTMLElement;

  onMount(() => {
    setIcon(span, icon);
  });
</script>

<span class="icon" bind:this={span}></span>

<style>
  .icon {
    vertical-align: middle;
  }
</style>
