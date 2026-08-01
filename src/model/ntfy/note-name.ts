/**
 * Derives the display name of a note from its vault-relative path: the last
 * path segment with a trailing ".md" extension removed (if present). Vault
 * paths always use "/" as the separator.
 *
 * Only a final ".md" is stripped, so embedded dots elsewhere in the file
 * name (e.g. "a.b.md") are preserved, and a file with no extension at all is
 * returned unchanged.
 */
export function noteNameFromPath(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  const fileName = lastSlash === -1 ? path : path.slice(lastSlash + 1);
  return fileName.replace(/\.md$/i, "");
}
