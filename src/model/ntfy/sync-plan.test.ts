import { Reminder } from "model/reminder";
import { DateTime, Time } from "model/time";
import { computeSequenceId } from "./sequence-id";
import { computeNtfySyncPlan } from "./sync-plan";
import type { NtfyPendingServerEntry } from "./sync-plan";

const NOW = DateTime.parse("2021-09-08 09:00");
const NOW_SECONDS = Math.floor(NOW.getTimeInMillis() / 1000);

function reminderIn(
  title: string,
  seconds: number,
  file: string = "Todo.md",
  rowNumber: number = 0,
): Reminder {
  return new Reminder(
    file,
    title,
    DateTime.ofEpochMillis(NOW.getTimeInMillis() + seconds * 1000),
    rowNumber,
    false,
  );
}

describe("computeNtfySyncPlan()", (): void => {
  test("publishes a reminder with no matching server entry (new publish)", (): void => {
    const reminder = reminderIn("Task 1", 60);
    const plan = computeNtfySyncPlan({
      reminders: [reminder],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(1);
    expect(plan.publish[0]!.reminder).toBe(reminder);
    expect(plan.publish[0]!.sequenceId).toBe(
      computeSequenceId("Todo.md", "Task 1", 0),
    );
    expect(plan.publish[0]!.atSeconds).toBe(NOW_SECONDS + 60);
    expect(plan.delete).toHaveLength(0);
  });

  test("does not publish when the server already has a matching sequence ID and time", (): void => {
    const reminder = reminderIn("Task 1", 60);
    const sequenceId = computeSequenceId("Todo.md", "Task 1", 0);
    const serverPending: Array<NtfyPendingServerEntry> = [
      { sequenceId, atSeconds: NOW_SECONDS + 60 },
    ];
    const plan = computeNtfySyncPlan({
      reminders: [reminder],
      serverPending,
      now: NOW,
    });

    expect(plan.publish).toHaveLength(0);
    expect(plan.delete).toHaveLength(0);
  });

  test("republishes when the reminder's time changed", (): void => {
    const reminder = reminderIn("Task 1", 60);
    const sequenceId = computeSequenceId("Todo.md", "Task 1", 0);
    const serverPending: Array<NtfyPendingServerEntry> = [
      { sequenceId, atSeconds: NOW_SECONDS + 120 },
    ];
    const plan = computeNtfySyncPlan({
      reminders: [reminder],
      serverPending,
      now: NOW,
    });

    expect(plan.publish).toHaveLength(1);
    expect(plan.publish[0]!.sequenceId).toBe(sequenceId);
    expect(plan.publish[0]!.atSeconds).toBe(NOW_SECONDS + 60);
    expect(plan.delete).toHaveLength(0);
  });

  test("deletes a pending schedule whose reminder disappeared", (): void => {
    const sequenceId = computeSequenceId("Todo.md", "Gone", 0);
    const serverPending: Array<NtfyPendingServerEntry> = [
      { sequenceId, atSeconds: NOW_SECONDS + 60 },
    ];
    const plan = computeNtfySyncPlan({
      reminders: [],
      serverPending,
      now: NOW,
    });

    expect(plan.publish).toHaveLength(0);
    expect(plan.delete).toStrictEqual([{ sequenceId }]);
  });

  test("does not delete pending entries that were not created by this plugin", (): void => {
    const serverPending: Array<NtfyPendingServerEntry> = [
      { sequenceId: "some-other-app-id", atSeconds: NOW_SECONDS + 60 },
    ];
    const plan = computeNtfySyncPlan({
      reminders: [],
      serverPending,
      now: NOW,
    });

    expect(plan.delete).toHaveLength(0);
  });

  test("excludes reminders at or before the minimum lead time (default 10s)", (): void => {
    const atLead = reminderIn("At lead", 10);
    const beforeLead = reminderIn("Before lead", 5);
    const plan = computeNtfySyncPlan({
      reminders: [atLead, beforeLead],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(0);
  });

  test("includes a reminder just past the minimum lead time", (): void => {
    const justPastLead = reminderIn("Just past lead", 11);
    const plan = computeNtfySyncPlan({
      reminders: [justPastLead],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(1);
  });

  test("includes a reminder exactly at the 24h horizon boundary", (): void => {
    const atHorizon = reminderIn("At horizon", 24 * 60 * 60);
    const plan = computeNtfySyncPlan({
      reminders: [atHorizon],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(1);
  });

  test("excludes a reminder just past the 24h horizon boundary", (): void => {
    const pastHorizon = reminderIn("Past horizon", 24 * 60 * 60 + 1);
    const plan = computeNtfySyncPlan({
      reminders: [pastHorizon],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(0);
  });

  test("excludes already-expired reminders", (): void => {
    const expired = reminderIn("Expired", -60);
    const plan = computeNtfySyncPlan({
      reminders: [expired],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(0);
  });

  test("gives duplicate (file, title) reminders separate sequence IDs and publishes both", (): void => {
    const r1 = reminderIn("Water plants", 60, "Todo.md", 0);
    const r2 = reminderIn("Water plants", 120, "Todo.md", 1);
    const plan = computeNtfySyncPlan({
      reminders: [r1, r2],
      serverPending: [],
      now: NOW,
    });

    expect(plan.publish).toHaveLength(2);
    const sequenceIds = plan.publish.map((p) => p.sequenceId);
    expect(new Set(sequenceIds).size).toBe(2);
    expect(sequenceIds).toContain(
      computeSequenceId("Todo.md", "Water plants", 0),
    );
    expect(sequenceIds).toContain(
      computeSequenceId("Todo.md", "Water plants", 1),
    );
  });

  test("uses the default reminder time for date-only reminders", (): void => {
    // A date-only reminder (no time part) falls back to `defaultTime`, same
    // as `Reminder.isExpired()`/`Reminders.getExpiredReminders()`.
    const dateOnly = new Reminder(
      "Todo.md",
      "Date only",
      DateTime.parse(NOW.toYYYYMMDD()),
      0,
      false,
    );
    const defaultTime = Time.parse("09:00");

    // With the default time falling within the horizon, it should publish.
    const withinHorizon = computeNtfySyncPlan({
      reminders: [dateOnly],
      serverPending: [],
      now: DateTime.ofEpochMillis(NOW.getTimeInMillis() - 60 * 60 * 1000),
      defaultTime,
    });
    expect(withinHorizon.publish).toHaveLength(1);

    // Once `now` has passed the default time, the same reminder is expired
    // and must not be published.
    const afterDefaultTime = computeNtfySyncPlan({
      reminders: [dateOnly],
      serverPending: [],
      now: DateTime.ofEpochMillis(NOW.getTimeInMillis() + 60 * 1000),
      defaultTime,
    });
    expect(afterDefaultTime.publish).toHaveLength(0);
  });
});
