<script lang="typescript">
    import { Component, MarkdownRenderer } from "obsidian";
    import { afterUpdate } from "svelte";
    export let component: Component|undefined;
    export let sourcePath: string;
    export let markdown: string;
    let span: HTMLElement;

    afterUpdate(() => {
        span.empty();
        MarkdownRenderer.renderMarkdown(markdown, span, sourcePath, component!);
        span.childNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
                n.style.display = "inline";
            }
        });
    });
</script>

<span>
    <span class="reminder-markdown" bind:this={span}></span>
</span>
