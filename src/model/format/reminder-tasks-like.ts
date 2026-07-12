import type { MarkdownDocument, Todo } from "model/format/markdown";
import { DateTime } from "model/time";
import moment from "moment";
import { nextOccurrence } from "./recurrence";
import {
  ReminderFormatParameterKey,
  TodoBasedReminderFormat,
} from "./reminder-base";
import type { ReminderEdit, ReminderModel } from "./reminder-base";

/**
 * Strip Obsidian tags (`#tag`, including nested `#tag/sub` and non-ASCII
 * tags) from `text`. Shared by every format whose title may carry the
 * user's own tags inline (Tasks plugin emoji format, Dataview format).
 */
export function removeTags(text: string): string {
  // Obsidian tags may contain any letters and digits (including non-ASCII
  // characters), plus "-", "_" and "/" for nested tags.
  return text.replace(/#[\p{L}\p{N}\p{M}_/-]+/gu, "").trim();
}

/**
 * The narrow model surface that the Tasks-plugin-compatible recurrence-on-
 * done logic (`TasksLikeReminderFormat.modifyReminder`) depends on. Both the
 * Tasks plugin's emoji format and the Dataview format implement this, each
 * over their own line syntax (see `reminder-tasks-plugin.ts` /
 * `reminder-dataview.ts`).
 */
export interface TasksLikeReminderModel extends ReminderModel {
  getDueDate(): DateTime | null;
  setDueDate(time: DateTime): void;
  getRecurrence(): string | null;
  setDoneDate(time: DateTime | string | undefined): void;
  clone(): TasksLikeReminderModel;
}

/**
 * Hosts the recurrence-on-done semantics shared by every Tasks-plugin-
 * compatible format: on completion, compute the next occurrence from the
 * recurrence text, clone the todo, insert the clone above as the new
 * (unchecked) occurrence, and stamp the completed line with its done date.
 *
 * The one behavior that differs between concrete formats is whether the
 * reminder date is tracked separately from the due date (the Tasks plugin's
 * emoji format needs a global toggle for this; the Dataview format decides
 * per-line, based on which fields are present) — that's factored out into
 * `usesSeparateReminderDate()`.
 */
export abstract class TasksLikeReminderFormat<
  M extends TasksLikeReminderModel,
> extends TodoBasedReminderFormat<M> {
  override modifyReminder(
    doc: MarkdownDocument,
    todo: Todo,
    parsed: M,
    edit: ReminderEdit,
  ): boolean {
    if (!super.modifyReminder(doc, todo, parsed, edit)) {
      return false;
    }
    if (edit.checked !== undefined) {
      if (edit.checked) {
        const recurrence = parsed.getRecurrence();
        if (recurrence !== null) {
          const nextReminderTodo = todo.clone()!;
          const nextReminder = parsed.clone();
          const dueDate = parsed.getDueDate();

          const now = this.config.getParameter(ReminderFormatParameterKey.now);
          if (this.usesSeparateReminderDate(parsed)) {
            const time = parsed.getTime();
            if (time == null) {
              return false;
            }
            const nextTime: Date | undefined = nextOccurrence(
              recurrence,
              time.moment(),
              now,
            );
            if (nextTime == null) {
              return false;
            }
            nextReminder.setTime(
              new DateTime(moment(nextTime), time.hasTimePart),
            );
            // `dueDate` may legitimately be absent here (an ⏰-only, or
            // ⏳-only/🛫-only via fallback, line with no 📅): just skip
            // advancing the due date rather than failing the whole
            // recurrence.
            if (dueDate != null) {
              const nextDueDate: Date | undefined = nextOccurrence(
                recurrence,
                dueDate.moment(),
                now,
              );
              if (nextDueDate == null) {
                return false;
              }
              nextReminder.setDueDate(
                new DateTime(moment(nextDueDate), dueDate.hasTimePart),
              );
            }
          } else {
            // The due date is the only source of the recurrence date in
            // this branch, so it must be present.
            if (dueDate == null) {
              return false;
            }
            const next: Date | undefined = nextOccurrence(
              recurrence,
              dueDate.moment(),
              now,
            );
            if (next == null) {
              return false;
            }
            const nextDueDate = new DateTime(moment(next), dueDate.hasTimePart);
            nextReminder.setTime(nextDueDate);
          }
          nextReminderTodo.body = nextReminder.toMarkdown();
          nextReminderTodo.setChecked(false);
          doc.insertTodo(todo.lineIndex, nextReminderTodo);
        }
        parsed.setDoneDate(
          this.config.getParameter(ReminderFormatParameterKey.now),
        );
      } else {
        parsed.setDoneDate(undefined);
      }
    }
    return true;
  }

  /**
   * Whether `parsed`'s reminder date should be tracked (and advanced on
   * recurrence) separately from its due date.
   *
   * - The Tasks plugin's emoji format returns a global setting
   *   (`useCustomEmojiForTasksPlugin`): it's an all-or-nothing toggle
   *   because the emoji vocabulary (⏰ vs 📅) doesn't vary per line.
   * - The Dataview format returns whether *this line* has a distinct
   *   reminder field: field names are explicit per line, so no global
   *   toggle is needed.
   */
  protected abstract usesSeparateReminderDate(parsed: M): boolean;
}
