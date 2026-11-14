import { PropertyNoteReminderStore } from "./property-store";
import {
  NoteReminderReader,
  extractFrontmatterText,
  noteNameOf,
} from "./reader";
import { parseTimeValue } from "./value";

describe("extractFrontmatterText()", (): void => {
  test("the block at the top of the note", (): void => {
    expect(extractFrontmatterText("---\na: 1\nb: 2\n---\nbody")).toBe(
      "a: 1\nb: 2",
    );
  });

  test("no block", (): void => {
    expect(extractFrontmatterText("body\n")).toBeNull();
    expect(extractFrontmatterText("")).toBeNull();
  });

  test("a block that is not on the first line is not frontmatter", (): void => {
    expect(extractFrontmatterText("\n---\na: 1\n---\n")).toBeNull();
    expect(extractFrontmatterText("text\n---\na: 1\n---\n")).toBeNull();
  });

  test("an unterminated block", (): void => {
    expect(extractFrontmatterText("---\na: 1\nbody")).toBeNull();
  });

  test("an empty block", (): void => {
    expect(extractFrontmatterText("---\n---\nbody")).toBe("");
    expect(extractFrontmatterText("---\n---")).toBe("");
    expect(extractFrontmatterText("---\r\n---  \r\nbody")).toBe("");
  });

  test("an empty block does not run on to a later rule in the body", (): void => {
    expect(extractFrontmatterText("---\n---\ndue: 2026-11-20\n---\nmore")).toBe(
      "",
    );
  });

  test("CRLF line ends and spaces after the closing line", (): void => {
    expect(extractFrontmatterText("---\r\na: 1\r\n---  \r\nbody")).toBe("a: 1");
  });

  test("a block that ends the note", (): void => {
    expect(extractFrontmatterText("---\na: 1\n---")).toBe("a: 1");
  });
});

describe("noteNameOf()", (): void => {
  test("drops the folder and a final .md only", (): void => {
    expect(noteNameOf("dir/sub/Call Alice.md")).toBe("Call Alice");
    expect(noteNameOf("v1.2 notes.md")).toBe("v1.2 notes");
    expect(noteNameOf("plain")).toBe("plain");
  });
});

describe("NoteReminderReader", (): void => {
  const store = new PropertyNoteReminderStore(() => [
    { property: "follow-up", managed: false, since: "" },
    { property: "reminder", managed: true, since: "" },
  ]);
  const reader = new NoteReminderReader([store]);

  test("mightContainReminders() looks for a source name in the text", (): void => {
    expect(reader.mightContainReminders("follow-up: 2026-11-20")).toBe(true);
    expect(reader.mightContainReminders("due: 2026-11-20")).toBe(false);
    expect(new NoteReminderReader([]).mightContainReminders("a: 1")).toBe(
      false,
    );
  });

  test("read() builds note reminders, titled with the note name by default", (): void => {
    const reminders = reader.read("dir/Call Alice.md", {
      "follow-up": "2026-11-20",
      reminder: "2026-11-21T09:00:00",
      "reminder-title": "Send the report",
    });

    expect(
      reminders.map((r) => [r.title, r.time.toString(), r.origin]),
    ).toStrictEqual([
      [
        "Call Alice",
        "2026-11-20",
        {
          kind: "note",
          store: "property",
          key: "follow-up",
          label: "follow-up",
        },
      ],
      [
        "Send the report",
        "2026-11-21 09:00",
        { kind: "note", store: "property", key: "reminder", label: "reminder" },
      ],
    ]);
    expect(reminders[0]?.file).toBe("dir/Call Alice.md");
    expect(reminders[0]?.done).toBe(false);
  });

  test("apply() reaches the store named in the origin", (): void => {
    const fm = { "follow-up": "2026-11-20" };
    const action = {
      type: "done" as const,
      expected: parseTimeValue("2026-11-20")!,
      now: parseTimeValue("2026-11-20T10:00")!,
    };

    expect(
      reader.apply(
        fm,
        { kind: "note", store: "unknown", key: "follow-up", label: "" },
        action,
      ),
    ).toBe("missing");
    expect(
      reader.apply(
        fm,
        { kind: "note", store: "property", key: "follow-up", label: "" },
        action,
      ),
    ).toBe("applied");
    expect(fm).toStrictEqual({
      "follow-up": "2026-11-20",
      "follow-up-done": "2026-11-20",
    });
  });
});
