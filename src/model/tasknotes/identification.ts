import { coerceScalar } from "./values";

export function hasTag(tags: Array<string>, expected: string) {
  const normalizedExpected = expected.replace(/^#/, "").toLowerCase();
  if (!normalizedExpected) {
    return false;
  }
  return tags.some(
    (tag) => tag.replace(/^#/, "").toLowerCase() === normalizedExpected,
  );
}

export function isIdentified(
  frontmatter: Record<string, unknown>,
  options: {
    identificationMode: "tag" | "property" | "reminders";
    tags: Array<string>;
    tag: string;
    identificationProperty: string;
    identificationValue: string;
  },
) {
  if (options.identificationMode === "tag") {
    return hasTag(options.tags, options.tag);
  }
  if (options.identificationMode === "property") {
    const property = options.identificationProperty.trim();
    if (
      !property ||
      !Object.prototype.hasOwnProperty.call(frontmatter, property)
    ) {
      return false;
    }
    const expected = options.identificationValue.trim();
    if (expected.length === 0) {
      return true;
    }
    const value = frontmatter[property];
    if (Array.isArray(value)) {
      return value.some(
        (item) => coerceScalar(item)?.toLowerCase() === expected.toLowerCase(),
      );
    }
    return coerceScalar(value)?.toLowerCase() === expected.toLowerCase();
  }
  return true;
}

export function isExcluded(filePath: string, excludedFolders: Array<string>) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  return excludedFolders.some((folder) => {
    const normalizedFolder = folder.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    return (
      normalizedFolder.length > 0 &&
      (normalizedPath === normalizedFolder ||
        normalizedPath.startsWith(`${normalizedFolder}/`))
    );
  });
}
