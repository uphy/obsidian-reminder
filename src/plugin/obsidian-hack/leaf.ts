import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';

export async function findLeafByFile(app: App, file: TFile, open = false): Promise<WorkspaceLeaf | null> {
  let found: WorkspaceLeaf | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      if (leaf.view.file.path === file.path) {
        found = leaf;
      }
    }
  });

  if (found === null && open) {
    found = app.workspace.getUnpinnedLeaf();
    await found.openFile(file);
    return found;
  }

  return found;
}

export async function getMarkdownViewFor(app: App, file: TFile): Promise<MarkdownView | null> {
  const leaf = await findLeafByFile(app, file, true);
  if (leaf == null) {
    return null;
  }
  if (!(leaf.view instanceof MarkdownView)) {
    throw 'unexpected view';
  }
  return leaf.view as MarkdownView;
}
