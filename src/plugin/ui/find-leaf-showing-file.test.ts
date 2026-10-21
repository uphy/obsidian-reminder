import { findLeafShowingFile } from "./find-leaf-showing-file";

type FakeLeaf = { id: string; file?: string };

const getFilePath = (leaf: FakeLeaf) => leaf.file;

describe("findLeafShowingFile", (): void => {
  const a: FakeLeaf = { id: "a", file: "a.md" };
  const b1: FakeLeaf = { id: "b1", file: "b.md" };
  const b2: FakeLeaf = { id: "b2", file: "b.md" };
  const empty: FakeLeaf = { id: "empty" };

  test("prefers the most recent leaf when it shows the file", (): void => {
    expect(findLeafShowingFile("b.md", b2, [a, b1, b2], getFilePath)).toBe(b2);
  });

  test("falls back to another leaf showing the file", (): void => {
    expect(findLeafShowingFile("b.md", a, [a, b1, b2], getFilePath)).toBe(b1);
  });

  test("returns null when no leaf shows the file", (): void => {
    expect(findLeafShowingFile("c.md", a, [a, b1, empty], getFilePath)).toBe(
      null,
    );
  });

  test("handles a missing most recent leaf", (): void => {
    expect(findLeafShowingFile("a.md", null, [b1, a], getFilePath)).toBe(a);
  });
});
