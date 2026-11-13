interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class TaskNotesRescanScheduler {
  private timer?: number;
  private running?: Promise<void>;
  private rerunRequested = false;
  private pendingWaiters: Array<Waiter> = [];
  private readyWaiters: Array<Waiter> = [];
  private activeWaiters: Array<Waiter> = [];

  constructor(
    private rescan: () => Promise<void>,
    private delay: number = 400,
  ) {}

  schedule(): Promise<void> {
    const result = new Promise<void>((resolve, reject) => {
      this.pendingWaiters.push({ resolve, reject });
    });
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      this.flushPending();
    }, this.delay);
    return result;
  }

  runNow(): Promise<void> {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.readyWaiters.push(...this.pendingWaiters);
    this.pendingWaiters = [];
    const result = new Promise<void>((resolve, reject) => {
      this.readyWaiters.push({ resolve, reject });
    });
    this.start();
    return result;
  }

  cancelPending(): void {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    const cancelled = this.pendingWaiters.splice(0);
    cancelled.forEach((waiter) => waiter.resolve());
  }

  private flushPending(): void {
    this.readyWaiters.push(...this.pendingWaiters);
    this.pendingWaiters = [];
    this.start();
  }

  private start(): void {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    if (this.readyWaiters.length === 0) {
      return;
    }
    this.running = this.runUntilCurrent();
    void this.running.then(
      () => this.settleWaiters(true),
      (error: unknown) => this.settleWaiters(false, error),
    );
  }

  private async runUntilCurrent(): Promise<void> {
    do {
      this.activeWaiters.push(...this.readyWaiters);
      this.readyWaiters = [];
      this.rerunRequested = false;
      await this.rescan();
    } while (this.rerunRequested);
  }

  private settleWaiters(success: boolean, error?: unknown): void {
    const waiters = [...this.activeWaiters, ...this.readyWaiters];
    this.activeWaiters = [];
    this.readyWaiters = [];
    this.running = undefined;
    waiters.forEach((waiter) => {
      if (success) {
        waiter.resolve();
      } else {
        waiter.reject(error);
      }
    });
  }
}
