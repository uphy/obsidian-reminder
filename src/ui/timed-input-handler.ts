export class TimedInputHandler {
  private digits: string[] = [];
  private lastInput: number = 0;

  handle(n: string): string {
    const now = new Date().getTime();
    if (now - this.lastInput > 1000) {
      this.clear();
    }
    this.lastInput = now;
    this.digits.push(n);
    return this.digits.join("");
  }

  clear() {
    this.digits = [];
  }
}
