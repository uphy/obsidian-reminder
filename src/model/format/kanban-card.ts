import type { DateTime } from "model/time";
import type { ReminderFormat, ReminderInsertion } from "./reminder-base";

const TODO_PREFIX = "- [ ] ";

/**
 * Appends a reminder to a line of a Kanban plugin card's text.
 *
 * A Kanban card editor holds only the card's text, without the "- [ ] " that
 * the Kanban plugin itself writes in front of each card when saving the board.
 * Reminder formats only accept task lines, so the prefix is added temporarily
 * and removed from the result; leaving it in would make the saved card read
 * "- [ ] - [ ] ...", which renders as a second checkbox inside the card.
 *
 * `insertAt` (if given) is a string index into `line`, and the returned
 * `caretPosition` is an index into the returned `insertedLine`.
 */
export function appendReminderToKanbanCardLine(
  format: ReminderFormat,
  line: string,
  time: DateTime,
  insertAt?: number,
): ReminderInsertion | null {
  const inserted = format.appendReminder(
    TODO_PREFIX + line,
    time,
    insertAt == null ? undefined : insertAt + TODO_PREFIX.length,
  );
  if (inserted == null || !inserted.insertedLine.startsWith(TODO_PREFIX)) {
    return null;
  }
  return {
    insertedLine: inserted.insertedLine.substring(TODO_PREFIX.length),
    caretPosition: Math.max(0, inserted.caretPosition - TODO_PREFIX.length),
  };
}
