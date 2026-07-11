import { Reminder } from "model/reminder";
import { DateTime } from "model/time";
import { NotificationWorker } from "./notification-worker";
import type { NotificationWorkerDeps } from "./notification-worker";

function makeReminder(title: string): Reminder {
  return new Reminder("file.md", title, DateTime.parse("2021-09-08"), 0, false);
}

function createDeps(
  overrides: Partial<NotificationWorkerDeps> = {},
): NotificationWorkerDeps {
  return {
    registerInterval: () => {},
    isLayoutReady: () => true,
    reloadUI: () => {},
    isEditing: () => false,
    showReminder: () => {},
    isScanned: () => true,
    markScanned: () => {},
    saveData: () => {},
    reloadRemindersInAllFiles: async () => {},
    getExpiredReminders: () => [],
    checkIntervalSec: () => 60,
    isNotificationEnabled: () => true,
    ...overrides,
  };
}

// `periodicTask` is private; call it directly to test its behavior without
// going through `startPeriodicTask()`'s `setInterval` scheduling, which is
// trivial pass-through wiring and not the concern of these tests.
function callPeriodicTask(worker: NotificationWorker): Promise<void> {
  return (
    worker as unknown as { periodicTask(): Promise<void> }
  ).periodicTask();
}

describe("NotificationWorker", (): void => {
  test("shows expired reminders in order via showReminder", async (): Promise<void> => {
    const r1 = makeReminder("r1");
    const r2 = makeReminder("r2");
    const r3 = makeReminder("r3");
    const shown: Array<Reminder> = [];
    const deps = createDeps({
      getExpiredReminders: () => [r1, r2, r3],
      showReminder: (reminder) => {
        shown.push(reminder);
      },
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(shown).toStrictEqual([r1, r2, r3]);
  });

  test("skips reminders with muteNotification", async (): Promise<void> => {
    const r1 = makeReminder("r1");
    r1.muteNotification = true;
    const r2 = makeReminder("r2");
    const shown: Array<Reminder> = [];
    const deps = createDeps({
      getExpiredReminders: () => [r1, r2],
      showReminder: (reminder) => {
        shown.push(reminder);
      },
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(shown).toStrictEqual([r2]);
  });

  test("shows nothing while isEditing() is true", async (): Promise<void> => {
    const showReminder = jest.fn();
    const getExpiredReminders = jest.fn(() => [makeReminder("r1")]);
    const deps = createDeps({
      isEditing: () => true,
      getExpiredReminders,
      showReminder,
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(getExpiredReminders).not.toHaveBeenCalled();
    expect(showReminder).not.toHaveBeenCalled();
  });

  test("does not show reminders when notifications are disabled", async (): Promise<void> => {
    const showReminder = jest.fn();
    const deps = createDeps({
      isNotificationEnabled: () => false,
      getExpiredReminders: () => [makeReminder("r1")],
      showReminder,
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(showReminder).not.toHaveBeenCalled();
  });

  test("still reloads UI and scans when notifications are disabled", async (): Promise<void> => {
    const reloadUI = jest.fn();
    const reloadRemindersInAllFiles = jest.fn(async () => {});
    const deps = createDeps({
      isNotificationEnabled: () => false,
      isScanned: () => false,
      reloadUI,
      reloadRemindersInAllFiles,
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(reloadUI).toHaveBeenCalled();
    expect(reloadRemindersInAllFiles).toHaveBeenCalled();
  });

  test("waits for the previous reminder's beingDisplayed flag before showing the next", async (): Promise<void> => {
    const r1 = makeReminder("r1");
    const r2 = makeReminder("r2");
    const events: Array<string> = [];
    const deps = createDeps({
      getExpiredReminders: () => [r1, r2],
      showReminder: (reminder) => {
        events.push(`show:${reminder.title}`);
        if (reminder === r1) {
          // Simulate the modal being displayed, then dismissed shortly
          // after — the worker must not show `r2` until this clears.
          r1.beingDisplayed = true;
          setTimeout(() => {
            r1.beingDisplayed = false;
            events.push("cleared");
          }, 50);
        }
      },
    });
    const worker = new NotificationWorker(deps);

    await callPeriodicTask(worker);

    expect(events).toStrictEqual(["show:r1", "cleared", "show:r2"]);
  });
});
