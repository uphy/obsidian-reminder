import { TaskNotesRescanScheduler } from "./tasknotes-rescan";

describe("TaskNotesRescanScheduler", (): void => {
  beforeEach((): void => {
    jest.useFakeTimers();
  });

  afterEach((): void => {
    jest.useRealTimers();
  });

  test("debounces scheduled rescans", async (): Promise<void> => {
    const rescan = jest.fn(async () => {});
    const scheduler = new TaskNotesRescanScheduler(rescan, 400);
    const first = scheduler.schedule();
    await jest.advanceTimersByTimeAsync(300);
    const second = scheduler.schedule();

    await jest.advanceTimersByTimeAsync(399);
    expect(rescan).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(rescan).toHaveBeenCalledTimes(1);
  });

  test("coalesces requests arriving during a rescan into one follow-up", async (): Promise<void> => {
    let finishFirst!: () => void;
    const rescan = jest.fn(async () => {});
    rescan.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const scheduler = new TaskNotesRescanScheduler(rescan, 400);
    const initial = scheduler.runNow();
    const firstChange = scheduler.schedule();
    const secondChange = scheduler.schedule();

    await jest.advanceTimersByTimeAsync(400);
    expect(rescan).toHaveBeenCalledTimes(1);

    finishFirst();
    await Promise.all([initial, firstChange, secondChange]);
    expect(rescan).toHaveBeenCalledTimes(2);
  });

  test("runNow cancels debounce and joins the pending rescan", async (): Promise<void> => {
    const rescan = jest.fn(async () => {});
    const scheduler = new TaskNotesRescanScheduler(rescan, 400);
    const scheduled = scheduler.schedule();
    const immediate = scheduler.runNow();

    await Promise.all([scheduled, immediate]);
    await jest.advanceTimersByTimeAsync(400);
    expect(rescan).toHaveBeenCalledTimes(1);
  });
});
