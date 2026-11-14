import type { Reminder } from "model/reminder";

/**
 * The line shown under the title of a notification for a note reminder: the
 * label of the property it comes from and the time it is shown for. Null for
 * a line reminder, whose notification is unchanged.
 */
export function originLine(reminder: Reminder): string | null {
  const origin = reminder.origin;
  if (origin.kind !== "note") {
    return null;
  }
  return `${origin.label} · ${reminder.time.toString()}`;
}

/**
 * What the reminder list shows after the title: the note name, and for a note
 * reminder the label of its property. A note reminder is titled with the
 * note name unless it has a title of its own, and then repeating the name
 * says nothing, so only the label is shown.
 */
export function listOrigin(reminder: Reminder): string {
  const origin = reminder.origin;
  const noteName = reminder.getFileName();
  if (origin.kind !== "note") {
    return noteName;
  }
  return hasOwnTitle(reminder) ? `${noteName} · ${origin.label}` : origin.label;
}

/**
 * The Markdown inserted when a reminder is dragged into a note: the title
 * and a link to the note. For a note reminder titled with the note name, the
 * link alone.
 */
export function draggedMarkdown(reminder: Reminder, link: string): string {
  if (reminder.isNote() && !hasOwnTitle(reminder)) {
    return link;
  }
  return `${reminder.title} - ${link}`;
}

function hasOwnTitle(reminder: Reminder): boolean {
  return reminder.title !== reminder.getFileName();
}
