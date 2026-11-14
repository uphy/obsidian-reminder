/**
 * Builds the option list of the time picker: every `step` minutes of the day
 * as "HH:mm", plus `current` when it is a valid time that is not on that grid
 * (09:25 with a 15-minute step). Without it the picker would have no option
 * to select and would show an empty field for such a time.
 */
export function timeOptions(step: number, current: string): string[] {
  const options: string[] = [];
  if (step > 0) {
    for (let i = 0; i < 60 * 24; i += step) {
      options.push(format(Math.floor(i / 60), i % 60));
    }
  }
  const match = /^(\d{2}):(\d{2})$/.exec(current);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 24 && minute < 60 && !options.includes(current)) {
      options.push(current);
      options.sort();
    }
  }
  return options;
}

function format(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
