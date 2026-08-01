import { noteNameFromPath } from "./note-name";

describe("noteNameFromPath()", (): void => {
  test("strips the directory and the .md extension", (): void => {
    expect(noteNameFromPath("reminder-test/買い物リスト.md")).toBe(
      "買い物リスト",
    );
  });

  test("keeps embedded dots that are not the final .md extension", (): void => {
    expect(noteNameFromPath("notes/a.b.md")).toBe("a.b");
  });

  test("returns the file name as-is when there is no extension", (): void => {
    expect(noteNameFromPath("notes/plain")).toBe("plain");
  });

  test("works for a file with no directory", (): void => {
    expect(noteNameFromPath("Todo.md")).toBe("Todo");
  });

  test("strips the extension case-insensitively", (): void => {
    expect(noteNameFromPath("notes/Todo.MD")).toBe("Todo");
  });

  test("returns the whole path when there is no directory and no extension", (): void => {
    expect(noteNameFromPath("Todo")).toBe("Todo");
  });
});
