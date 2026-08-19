import { DateTime } from "model/time";
import { Reminder } from "model/reminder";
import {
  decorateRenderedTaskItem,
  findReminderInRenderedText,
  resolveRenderedReminder,
} from "./rendered-pill";

function taskItem(html: string, task: string = ""): Element {
  const list = document.createElement("ul");
  list.innerHTML = `<li class="task-list-item" data-task="${task}">${html}</li>`;
  return list.querySelector("li")!;
}

function pill(): HTMLElement {
  const el = document.createElement("span");
  el.className = "reminder-pill";
  el.textContent = "PILL";
  return el;
}

describe("findReminderInRenderedText", () => {
  test("locates the reminder in the rendered text", () => {
    const found = findReminderInRenderedText(
      "note.md",
      "call Bob (@2026-08-17)",
      " ",
    );
    expect(found).not.toBeNull();
    expect("call Bob (@2026-08-17)".substring(found!.from, found!.to)).toBe(
      "(@2026-08-17)",
    );
    expect(found!.reminder.title).toBe("call Bob");
  });

  test("returns null when the text holds no reminder", () => {
    expect(findReminderInRenderedText("note.md", "call Bob", " ")).toBeNull();
  });
});

describe("decorateRenderedTaskItem", () => {
  test("replaces the reminder text of a task rendered inside a callout", () => {
    const item = taskItem(
      `<input type="checkbox"> call Bob (@2026-08-17)`,
      " ",
    );

    expect(decorateRenderedTaskItem(item, "note.md", pill)).toBe(true);
    expect(item.querySelectorAll(".reminder-pill")).toHaveLength(1);
    expect(item.textContent).toBe(" call Bob PILL");
  });

  test("keeps the text around the reminder intact", () => {
    const item = taskItem(`(@2026-08-17) call <strong>Bob</strong> today`);

    expect(decorateRenderedTaskItem(item, "note.md", pill)).toBe(true);
    expect(item.textContent).toBe("PILL call Bob today");
    expect(item.querySelector("strong")!.textContent).toBe("Bob");
  });

  test("leaves a task without a reminder untouched", () => {
    const item = taskItem("call Bob");

    expect(decorateRenderedTaskItem(item, "note.md", pill)).toBe(false);
    expect(item.textContent).toBe("call Bob");
  });

  test("ignores the reminder of a nested task item", () => {
    const item = taskItem(
      `call Bob<ul><li class="task-list-item">nested (@2026-08-17)</li></ul>`,
    );

    expect(decorateRenderedTaskItem(item, "note.md", pill)).toBe(false);
    expect(item.querySelectorAll(".reminder-pill")).toHaveLength(0);
  });
});

describe("resolveRenderedReminder", () => {
  const reminder = (title: string, value: string, row: number) =>
    new Reminder("note.md", title, DateTime.parse(value), row, false);

  test("matches the only reminder with that time", () => {
    const target = reminder("rendered title", "2026-08-17 10:00", 3);
    const resolved = resolveRenderedReminder(
      [reminder("other", "2026-08-18 10:00", 1), target],
      reminder("title lost to rendering", "2026-08-17 10:00", -1),
    );
    expect(resolved).toBe(target);
  });

  test("falls back to the title when the time is ambiguous", () => {
    const target = reminder("call Bob", "2026-08-17 10:00", 3);
    const resolved = resolveRenderedReminder(
      [reminder("call Alice", "2026-08-17 10:00", 1), target],
      reminder("call Bob", "2026-08-17 10:00", -1),
    );
    expect(resolved).toBe(target);
  });

  test("gives up rather than guess between indistinguishable reminders", () => {
    const resolved = resolveRenderedReminder(
      [
        reminder("call Bob", "2026-08-17 10:00", 1),
        reminder("call Bob", "2026-08-17 10:00", 3),
      ],
      reminder("call Bob", "2026-08-17 10:00", -1),
    );
    expect(resolved).toBeNull();
  });

  test("gives up when nothing matches", () => {
    const resolved = resolveRenderedReminder(
      [reminder("call Bob", "2026-08-17 10:00", 1)],
      reminder("call Bob", "2026-08-19 10:00", -1),
    );
    expect(resolved).toBeNull();
  });
});
