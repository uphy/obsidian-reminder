import { Reminder, Reminders } from "model/reminder";
import { DateTime } from "model/time";
import { TFile } from "obsidian";
import type { Vault } from "obsidian";
import { ReminderPluginFileSystem } from "./filesystem";

/** A vault holding `notes` (path to text); only what a scan reads. */
function createFileSystem(
  notes: Map<string, string>,
  readNoteReminders: (
    path: string,
    content: string,
  ) => Array<Reminder> = () => [],
): { fileSystem: ReminderPluginFileSystem; reminders: Reminders } {
  const vault = {
    getMarkdownFiles: () =>
      [...notes.keys()].map((path) =>
        Object.assign(new TFile(), { path, extension: "md" }),
      ),
    cachedRead: async (file: TFile) => notes.get(file.path) ?? "",
  } as unknown as Vault;
  const reminders = new Reminders(() => {});
  const fileSystem = new ReminderPluginFileSystem(
    vault,
    reminders,
    () => {},
    () => [],
    async () => {},
    readNoteReminders,
  );
  return { fileSystem, reminders };
}

function titlesOf(reminders: Reminders, path: string): Array<string> {
  return (reminders.fileToReminders.get(path) ?? []).map((r) => r.title);
}

describe("ReminderPluginFileSystem#reloadRemindersInAllFiles()", (): void => {
  test("a rescan keeps a reminder muted when its note is unchanged", async (): Promise<void> => {
    const notes = new Map([["a.md", "- [ ] Task (@2021-09-14)"]]);
    const { fileSystem, reminders } = createFileSystem(notes);
    await fileSystem.reloadRemindersInAllFiles();
    expect(reminders.reminders).toHaveLength(1);
    reminders.reminders[0]!.muteNotification = true;

    await fileSystem.reloadRemindersInAllFiles();

    expect(reminders.reminders).toHaveLength(1);
    expect(reminders.reminders[0]!.muteNotification).toBe(true);
  });

  test("a rescan drops the reminders of a note that no longer exists", async (): Promise<void> => {
    const notes = new Map([
      ["a.md", "- [ ] Task A (@2021-09-14)"],
      ["b.md", "- [ ] Task B (@2021-09-15)"],
    ]);
    const { fileSystem, reminders } = createFileSystem(notes);
    await fileSystem.reloadRemindersInAllFiles();
    expect(reminders.reminders).toHaveLength(2);

    notes.delete("b.md");
    await fileSystem.reloadRemindersInAllFiles();

    expect([...reminders.fileToReminders.keys()]).toStrictEqual(["a.md"]);
    expect(reminders.reminders.map((r) => r.title)).toStrictEqual(["Task A"]);
  });

  test("a note keeps both its line reminders and its note reminders", async (): Promise<void> => {
    const notes = new Map([["a.md", "- [ ] Task (@2021-09-14)"]]);
    const { fileSystem, reminders } = createFileSystem(notes, (path) => [
      Reminder.ofNote(path, "a", DateTime.parse("2021-09-15"), {
        kind: "note",
        format: "property",
        key: "due",
        label: "due",
      }),
    ]);

    await fileSystem.reloadRemindersInAllFiles();

    expect(titlesOf(reminders, "a.md").sort()).toStrictEqual(["Task", "a"]);
  });
});
