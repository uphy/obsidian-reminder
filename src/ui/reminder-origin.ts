import { noteNameOf } from "model/note/reader";
import type { Reminder } from "model/reminder";

/**
 * The line shown under the title of a notification for a note reminder: the
 * label of the property it comes from (when it has one) and the time it is
 * shown for. Null for a line reminder, whose notification is unchanged.
 */
export function originLine(reminder: Reminder): string | null {
  const origin = reminder.origin;
  if (origin.kind !== "note") {
    return null;
  }
  const time = reminder.time.toString();
  return origin.label === "" ? time : `${origin.label} · ${time}`;
}

/**
 * What the reminder list shows after the title: the note name, and for a note
 * reminder the label of its property. A note reminder is titled with the
 * note name unless it has a title of its own, and then repeating the name
 * says nothing, so only the label is shown. A reminder without a label
 * (the only listed property) then shows nothing here.
 */
export function listOrigin(reminder: Reminder): string {
  const origin = reminder.origin;
  if (origin.kind !== "note") {
    return reminder.getFileName();
  }
  const parts = hasOwnTitle(reminder) ? [noteNameOf(reminder.file)] : [];
  if (origin.label !== "") {
    parts.push(origin.label);
  }
  return parts.join(" · ");
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

// Compared with the name the reader titles a note reminder with, not with
// `getFileName()`, which cuts a name such as `v1.2 notes` at its first dot.
function hasOwnTitle(reminder: Reminder): boolean {
  return reminder.title !== noteNameOf(reminder.file);
}
