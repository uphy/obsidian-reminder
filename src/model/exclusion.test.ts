import { isPathExcluded } from "./exclusion";

describe("isPathExcluded()", (): void => {
  test("exact file match", (): void => {
    expect(isPathExcluded("Templates/Daily.md", ["Templates/Daily.md"])).toBe(
      true,
    );
  });

  test("folder-prefix match", (): void => {
    expect(isPathExcluded("Templates/Daily.md", ["Templates"])).toBe(true);
  });

  test("folder entry matches itself", (): void => {
    expect(isPathExcluded("Templates", ["Templates"])).toBe(true);
  });

  test("segment-boundary non-match", (): void => {
    expect(isPathExcluded("Templates2/Daily.md", ["Templates"])).toBe(false);
  });

  test("leading slash on entry is normalized", (): void => {
    expect(isPathExcluded("Templates/Daily.md", ["/Templates"])).toBe(true);
  });

  test("trailing slash on entry is normalized", (): void => {
    expect(isPathExcluded("Templates/Daily.md", ["Templates/"])).toBe(true);
  });

  test("blank entries are ignored", (): void => {
    expect(isPathExcluded("Templates/Daily.md", ["", "   ", "\n"])).toBe(false);
  });

  test("empty list never excludes", (): void => {
    expect(isPathExcluded("Templates/Daily.md", [])).toBe(false);
  });

  test("nested folder entries", (): void => {
    expect(isPathExcluded("Archive/2020/Notes/foo.md", ["Archive/2020"])).toBe(
      true,
    );
    expect(isPathExcluded("Archive/2021/Notes/foo.md", ["Archive/2020"])).toBe(
      false,
    );
  });

  test("unrelated path does not match", (): void => {
    expect(isPathExcluded("Journal/2024-01-01.md", ["Templates"])).toBe(false);
  });
});
