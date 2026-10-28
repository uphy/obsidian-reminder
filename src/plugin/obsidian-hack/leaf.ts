import { App, MarkdownView } from "obsidian";

/**
 * Rebuilds every open markdown view.
 *
 * `Workspace.updateOptions()` reaches the plugin's own editor extensions, but
 * not the blocks Live Preview renders as HTML (callouts, tables): those are
 * Obsidian's own widgets, and they keep the DOM they were built with until the
 * view is recreated. Rebuilding is the only way to make a setting that affects
 * markdown post-processing show up in already-open notes.
 *
 * `WorkspaceLeaf.rebuildView()` is not in the public typings, hence the cast.
 */
export function rebuildMarkdownViews(app: App): void {
  app.workspace.iterateAllLeaves((leaf) => {
    if (!(leaf.view instanceof MarkdownView)) {
      return;
    }
    const rebuild = (leaf as unknown as { rebuildView?: () => void })
      .rebuildView;
    rebuild?.call(leaf);
  });
}
