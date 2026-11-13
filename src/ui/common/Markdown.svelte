<script lang="typescript">
  import { MarkdownRenderer } from "obsidian";
  import { afterUpdate } from "svelte";
  export let sourcePath: string;
  export let markdown: string;
  let span: HTMLElement;

  afterUpdate(() => {
    span.empty();
    MarkdownRenderer.renderMarkdown(
      markdown,
      span,
      sourcePath,
      window.app.plugins.plugins["obsidian-reminder-plugin"],
    );
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
