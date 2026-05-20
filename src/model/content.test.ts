/**
 * @fileoverview Tests for Content class — file system integration for reminders.
 *
 * Content represents a markdown file and provides methods to:
 * - Parse reminders from markdown content (getReminders)
 * - Update reminder lines in the markdown (updateReminder)
 * - Extract the modified content (getContent)
 *
 * These operations are used by the reschedule feature when persisting
 * reminder time changes back to the markdown file via ReminderPluginFileSystem.updateReminder().
 *
 * @see src/model/content.ts
 * @see src/plugin/filesystem.ts — ReminderPluginFileSystem.updateReminder()
 */

import { Content } from "./content";
import { DateTime } from "./time";
import moment from "moment";

describe("Content", (): void => {
  /**
   * Tests for parsing reminders from markdown content.
   * Content.getReminders() extracts reminder objects from markdown lines
   * matching the default reminder format: `- [ ] Task (@YYYY-MM-DD HH:mm)`
   */
  describe("getReminders", () => {
    test("extracts reminders from markdown with default format", () => {
      const content = new Content("test.md", "- [ ] Task1 (@2021-09-14)\n- [ ] Task2 (@2021-09-15 10:00)\n");
      const reminders = content.getReminders();
      expect(reminders.length).toBe(2);
      expect(reminders[0]!.title).toBe("Task1");
      expect(reminders[0]!.time.toString()).toBe("2021-09-14");
      expect(reminders[1]!.title).toBe("Task2");
      expect(reminders[1]!.time.toString()).toBe("2021-09-15 10:00");
    });

    test("filters out done reminders by default", () => {
      const content = new Content("test.md", "- [x] Done task (@2021-09-14)\n- [ ] Pending task (@2021-09-15)\n");
      const reminders = content.getReminders();
      expect(reminders.length).toBe(1);
      expect(reminders[0]!.title).toBe("Pending task");
    });

    test("includes done reminders when doneOnly is false", () => {
      const content = new Content("test.md", "- [x] Done task (@2021-09-14)\n- [ ] Pending task (@2021-09-15)\n");
      const reminders = content.getReminders(false);
      expect(reminders.length).toBe(2);
    });

    test("returns empty array for markdown with no reminders", () => {
      const content = new Content("test.md", "# Hello\nNo reminders here\n");
      const reminders = content.getReminders();
      expect(reminders.length).toBe(0);
    });
  });

  /**
   * Tests for updating reminder times in markdown content.
   * Content.updateReminder() modifies the reminder line in the markdown
   * with the new time and checked status. This is the core operation
   * used by the reschedule feature to persist changes.
   */
  describe("updateReminder", () => {
    test("updates reminder time in markdown", async () => {
      const content = new Content("test.md", "- [ ] Task1 (@2021-09-14)\n");
      const reminders = content.getReminders();
      expect(reminders.length).toBe(1);

      const newTime = new DateTime(moment("2021-09-15 10:00"), true);
      await content.updateReminder(reminders[0]!, { time: newTime, checked: false });

      const result = content.getContent();
      expect(result).toContain("(@2021-09-15 10:00)");
      expect(result).toContain("- [ ]");
    });

    test("checks reminder when checked is true", async () => {
      const content = new Content("test.md", "- [ ] Task1 (@2021-09-14)\n");
      const reminders = content.getReminders();

      const newTime = new DateTime(moment("2021-09-14"), false);
      await content.updateReminder(reminders[0]!, { time: newTime, checked: true });

      const result = content.getContent();
      expect(result).toContain("- [x]");
    });

    test("preserves task title when updating time", async () => {
      const content = new Content("test.md", "- [ ] My important task (@2021-09-14)\n");
      const reminders = content.getReminders();

      const newTime = new DateTime(moment("2021-10-01 09:00"), true);
      await content.updateReminder(reminders[0]!, { time: newTime, checked: false });

      const result = content.getContent();
      expect(result).toContain("My important task");
      expect(result).toContain("(@2021-10-01 09:00)");
    });

    test("updates only the target reminder when multiple exist", async () => {
      const content = new Content("test.md", "- [ ] Task1 (@2021-09-14)\n- [ ] Task2 (@2021-09-15)\n");
      const reminders = content.getReminders();

      const newTime = new DateTime(moment("2021-09-20 12:00"), true);
      await content.updateReminder(reminders[0]!, { time: newTime, checked: false });

      const result = content.getContent();
      expect(result).toContain("- [ ] Task1 (@2021-09-20 12:00)");
      expect(result).toContain("- [ ] Task2 (@2021-09-15)");
    });
  });

  describe("getContent", () => {
    test("returns the full markdown content", () => {
      const md = "# Title\n- [ ] Task (@2021-09-14)\n";
      const content = new Content("test.md", md);
      expect(content.getContent()).toBe(md);
    });
  });
});
