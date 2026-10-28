import { DateTime, Later } from "model/time";
import { systemNotificationLaters } from "./notification-buttons";

function laters(count: number): Array<Later> {
  return Array.from(
    { length: count },
    (_, i) => new Later(`Later ${i}`, () => DateTime.now()),
  );
}

function labels(ls: Array<Later>): Array<string> {
  return ls.map((l) => l.label);
}

describe("systemNotificationLaters", (): void => {
  test("keeps every later outside Windows", (): void => {
    const all = laters(10);
    expect(systemNotificationLaters(all, false, true)).toEqual(all);
  });

  test("leaves room for Mark as Done on Windows", (): void => {
    expect(labels(systemNotificationLaters(laters(5), true, false))).toEqual([
      "Later 0",
      "Later 1",
      "Later 2",
      "Later 3",
    ]);
  });

  test("also leaves room for Electron's Close button when kept on screen", (): void => {
    expect(labels(systemNotificationLaters(laters(5), true, true))).toEqual([
      "Later 0",
      "Later 1",
      "Later 2",
    ]);
  });

  test("keeps a list that already fits on Windows", (): void => {
    const all = laters(3);
    expect(systemNotificationLaters(all, true, true)).toEqual(all);
  });
});
