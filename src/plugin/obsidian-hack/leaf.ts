import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";

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

export async function findLeafByFile(
  app: App,
  file: TFile,
  open = false,
): Promise<WorkspaceLeaf | null> {
  let found: WorkspaceLeaf | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      if (leaf.view.file?.path === file.path) {
        found = leaf;
      }
    }
  });

  if (found === null && open) {
    found = app.workspace.getLeaf(false);
    await found.openFile(file);
    return found;
  }

  return found;
}

export async function getMarkdownViewFor(
  app: App,
  file: TFile,
): Promise<MarkdownView | null> {
  const leaf = await findLeafByFile(app, file, true);
  if (leaf == null) {
    return null;
  }
  if (!(leaf.view instanceof MarkdownView)) {
    throw "unexpected view";
  }
  return leaf.view as MarkdownView;
}
