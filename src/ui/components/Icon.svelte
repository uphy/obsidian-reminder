<script lang="typescript">
    import { setIcon } from "obsidian";
    import { onMount } from "svelte";
    export let icon = "";
    export let size = 16;
    export let paddingRight = "3px";
    let span: HTMLElement;

    onMount(() => {
        setIcon(span, icon, size);
    });
</script>

<span class="icon" bind:this={span} style={`padding-right: ${paddingRight}`} />
