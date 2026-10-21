/**
 * Pick an already-open leaf showing `path`, so opening a reminder reuses it
 * instead of opening a duplicate tab.
 *
 * The most recent leaf (the tab the user was last on) wins when it shows the
 * file; otherwise the first leaf showing it is returned. Returns `null` when
 * no leaf shows the file.
 *
 * Generic over the leaf type so the choice can be unit-tested without
 * Obsidian's `WorkspaceLeaf`.
 */
export function findLeafShowingFile<L>(
  path: string,
  mostRecentLeaf: L | null,
  leaves: L[],
  getFilePath: (leaf: L) => string | undefined,
): L | null {
  if (mostRecentLeaf != null && getFilePath(mostRecentLeaf) === path) {
    return mostRecentLeaf;
  }
  return leaves.find((leaf) => getFilePath(leaf) === path) ?? null;
}
