import { Reminder } from "model/reminder";
import type { TaskNotesAnchorType } from "model/reminder";
import { DateTime } from "model/time";
import { coerceScalar, hasValue, isRecord } from "./values";
import { parseAnchor, parseDateTime } from "./anchor";
import { applyDuration, parseDuration } from "./duration";
import { hasTag, isExcluded, isIdentified } from "./identification";
import { collectRecurringInstanceDates, isCompleted } from "./skip-rules";
import type { TaskNotesContext } from "./types";

export type {
  TaskNotesIdentificationMode,
  TaskNotesPropertyNames,
  TaskNotesOptions,
  TaskNotesContext,
} from "./types";
export { DEFAULT_TASKNOTES_PROPERTIES } from "./types";
export { hasValue, coerceScalar, isRecord } from "./values";
export { parseAnchor, parseDateTime } from "./anchor";
export { applyDuration, parseDuration } from "./duration";
export { isExcluded, isIdentified } from "./identification";
export { isCompleted, collectRecurringInstanceDates } from "./skip-rules";

interface ParsedTrigger {
  trigger: DateTime;
  anchor: {
    type: TaskNotesAnchorType;
    time: DateTime;
  };
}

const warnedInvalidReminders = new Set<string>();

export function extractReminders(
  frontmatter: unknown,
  ctx: TaskNotesContext,
): Array<Reminder> {
  if (
    !isRecord(frontmatter) ||
    isExcluded(ctx.filePath, ctx.options.excludedFolders)
  ) {
    return [];
  }

  if (
    ctx.options.identificationMode !== "reminders" &&
    !isIdentified(frontmatter, {
      tags: ctx.tags,
      ...ctx.options,
    })
  ) {
    return [];
  }
  if (
    (ctx.options.skipCompleted &&
      isCompleted(frontmatter, {
        properties: ctx.options.properties,
        completedStatuses: ctx.options.completedStatuses,
      })) ||
    (ctx.options.skipArchived && hasTag(ctx.tags, ctx.options.archiveTag))
  ) {
    return [];
  }

  const remindersValue = frontmatter[ctx.options.properties.reminders];
  if (!Array.isArray(remindersValue)) {
    if (ctx.options.identificationMode === "reminders") {
      return [];
    }
    if (hasValue(remindersValue)) {
      warn(ctx, "<reminders>", "the reminders property is not a list");
    }
    return [];
  }

  const seenIds = new Set<string>();
  const parsed: Array<Reminder> = [];
  remindersValue.forEach((value, index) => {
    const rawId = isRecord(value) ? coerceScalar(value["id"]) : undefined;
    const warningId = rawId?.trim() || `<item-${index}>`;
    if (!isRecord(value)) {
      warn(ctx, warningId, "reminder entry is not an object");
      return;
    }
    const id = coerceScalar(value["id"])?.trim();
    if (!id) {
      warn(ctx, warningId, "reminder id is missing or empty");
      return;
    }
    if (seenIds.has(id)) {
      warn(ctx, id, "duplicate reminder id");
      return;
    }
    seenIds.add(id);

    const reminder = parseReminder(value, id, frontmatter, ctx);
    if (reminder) {
      parsed.push(reminder);
    }
  });

  if (ctx.options.identificationMode === "reminders" && parsed.length === 0) {
    return [];
  }

  const title =
    coerceScalar(frontmatter[ctx.options.properties.title])?.trim() ||
    ctx.fileName;
  const now = ctx.now ?? DateTime.now();
  const oldest = now.add(-Math.max(0, ctx.options.ignoreOlderThanDays), "days");
  const recurringInstanceDates =
    ctx.options.skipRecurringInstances &&
    hasValue(frontmatter[ctx.options.properties.recurrence])
      ? collectRecurringInstanceDates(frontmatter, {
          properties: ctx.options.properties,
        })
      : new Set<string>();
  const result = parsed.filter((reminder) => {
    const task = reminder.tasknotes!;
    if (recurringInstanceDates.has(task.anchor.time.toYYYYMMDD())) {
      return false;
    }
    const effectiveTime =
      ctx.effectiveTimeFor?.(task.reminderId, reminder.time) ?? reminder.time;
    if (effectiveTime.getTimeInMillis() < oldest.getTimeInMillis()) {
      return false;
    }
    reminder.effectiveTime = effectiveTime;
    task.taskTitle = title;
    reminder.title = task.description || title;
    return true;
  });

  result.sort((a, b) => {
    const timeDifference = a.time.getTimeInMillis() - b.time.getTimeInMillis();
    if (timeDifference !== 0) {
      return timeDifference;
    }
    return a.tasknotes!.reminderId.localeCompare(b.tasknotes!.reminderId);
  });
  return result;
}

function parseReminder(
  value: Record<string, unknown>,
  id: string,
  frontmatter: Record<string, unknown>,
  ctx: TaskNotesContext,
): Reminder | undefined {
  const type = coerceScalar(value["type"]);
  const description = coerceScalar(value["description"])?.trim() || undefined;
  let parsedTrigger: ParsedTrigger | undefined;

  if (type === "absolute") {
    if (
      hasValue(value["relatedTo"]) ||
      hasValue(value["offset"]) ||
      !hasValue(value["absoluteTime"])
    ) {
      warn(ctx, id, "absolute reminder has missing or mixed fields");
      return undefined;
    }
    const absoluteTime = parseDateTime(value["absoluteTime"]);
    if (!absoluteTime) {
      warn(ctx, id, "absoluteTime is not a valid datetime");
      return undefined;
    }
    parsedTrigger = {
      trigger: absoluteTime,
      anchor: { type: "absolute", time: absoluteTime },
    };
  } else if (type === "relative") {
    if (
      hasValue(value["absoluteTime"]) ||
      !hasValue(value["relatedTo"]) ||
      !hasValue(value["offset"])
    ) {
      warn(ctx, id, "relative reminder has missing or mixed fields");
      return undefined;
    }
    const relatedTo = coerceScalar(value["relatedTo"]);
    if (relatedTo !== "due" && relatedTo !== "scheduled") {
      warn(ctx, id, "relatedTo must be due or scheduled");
      return undefined;
    }
    const anchorValue = frontmatter[ctx.options.properties[relatedTo]];
    const anchor = parseAnchor(anchorValue, ctx.options.dateOnlyAnchorTime);
    const duration = coerceScalar(value["offset"]);
    const offset = duration ? parseDuration(duration) : undefined;
    if (!anchor) {
      warn(ctx, id, `${relatedTo} anchor is missing or invalid`);
      return undefined;
    }
    if (!offset) {
      warn(ctx, id, "offset is not a valid ISO 8601 duration");
      return undefined;
    }
    parsedTrigger = {
      trigger: applyDuration(anchor, offset),
      anchor: { type: relatedTo, time: anchor },
    };
  } else {
    warn(ctx, id, "type must be absolute or relative");
    return undefined;
  }

  return new Reminder(
    ctx.filePath,
    description ?? ctx.fileName,
    parsedTrigger.trigger,
    -1,
    false,
    "tasknotes",
    {
      reminderId: id,
      description,
      anchor: parsedTrigger.anchor,
      taskTitle: ctx.fileName,
    },
  );
}

function warn(ctx: TaskNotesContext, id: string, reason: string) {
  const key = `${ctx.filePath}::${id}`;
  if (ctx.warnOnce) {
    ctx.warnOnce(key, `Skipping TaskNotes reminder ${key}: ${reason}`);
    return;
  }
  if (!warnedInvalidReminders.has(key)) {
    warnedInvalidReminders.add(key);
    console.warn(`Skipping TaskNotes reminder ${key}: ${reason}`);
  }
}
