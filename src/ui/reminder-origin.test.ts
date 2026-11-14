import { Reminder } from "model/reminder";
import { DateTime } from "model/time";
import { draggedMarkdown, listOrigin, originLine } from "./reminder-origin";

const line = Reminder.ofLine(
  "dir/Todo.md",
  "Buy milk",
  DateTime.parse("2026-11-20 09:00"),
  0,
  false,
);

function note(title: string, time: string = "2026-11-20"): Reminder {
  return Reminder.ofNote("dir/Call Alice.md", title, DateTime.parse(time), {
    kind: "note",
    store: "property",
    key: "follow-up",
    label: "follow-up",
  });
}

describe("originLine()", (): void => {
  test("a note reminder shows its label and time", (): void => {
    expect(originLine(note("Call Alice"))).toBe("follow-up · 2026-11-20");
    expect(originLine(note("Call Alice", "2026-11-20 09:00"))).toBe(
      "follow-up · 2026-11-20 09:00",
    );
  });

  test("a line reminder has none", (): void => {
    expect(originLine(line)).toBeNull();
  });
});

describe("listOrigin()", (): void => {
  test("a line reminder shows the note name", (): void => {
    expect(listOrigin(line)).toBe("Todo");
  });

  test("a note reminder titled with the note name shows the label", (): void => {
    expect(listOrigin(note("Call Alice"))).toBe("follow-up");
  });

  test("a note reminder with its own title shows the note name too", (): void => {
    expect(listOrigin(note("Send the report"))).toBe("Call Alice · follow-up");
  });
});

describe("draggedMarkdown()", (): void => {
  test("a line reminder keeps the title before the link", (): void => {
    expect(draggedMarkdown(line, "[[Todo]]")).toBe("Buy milk - [[Todo]]");
  });

  test("a note reminder titled with the note name is the link alone", (): void => {
    expect(draggedMarkdown(note("Call Alice"), "[[Call Alice]]")).toBe(
      "[[Call Alice]]",
    );
  });

  test("a note reminder with its own title keeps the title", (): void => {
    expect(draggedMarkdown(note("Send the report"), "[[Call Alice]]")).toBe(
      "Send the report - [[Call Alice]]",
    );
  });
});
