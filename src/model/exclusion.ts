/**
 * Normalizes a vault-relative path for exclusion matching: trims whitespace
 * and strips leading/trailing slashes so entries like "/Templates/" and
 * "Templates" are treated the same.
 */
function normalize(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Checks whether `filePath` should be excluded from reminder scanning based
 * on `excludedPaths`, a list of vault-relative path prefixes (analogous to
 * Obsidian's own "Excluded files" setting).
 *
 * A file is excluded when its path equals an entry, or is inside the folder
 * an entry names (matched on a path-segment boundary, so `"Templates"`
 * excludes `"Templates/foo.md"` but not `"Templates2/foo.md"`). Blank
 * entries never match anything. Matching is case-sensitive, since vault
 * paths are case-sensitive.
 */
export function isPathExcluded(
  filePath: string,
  excludedPaths: Array<string>,
): boolean {
  const normalizedFilePath = normalize(filePath);
  return excludedPaths.some((rawEntry) => {
    const entry = normalize(rawEntry);
    if (entry.length === 0) {
      return false;
    }
    return (
      normalizedFilePath === entry || normalizedFilePath.startsWith(`${entry}/`)
    );
  });
}
