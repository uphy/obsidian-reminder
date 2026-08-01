import type { Reminder } from "model/reminder";
import type { DateTime, Time } from "model/time";
import { assignSequenceIds, isObsidianReminderSequenceId } from "./sequence-id";

/** A scheduled ("delayed") message ntfy currently has pending for our topic. */
export interface NtfyPendingServerEntry {
  sequenceId: string;
  /** Delivery time, in unix seconds (ntfy's `time` field on the message). */
  atSeconds: number;
}

/** A reminder that should be (re-)published as a scheduled ntfy message. */
export interface NtfyPublishAction {
  sequenceId: string;
  /** Delivery time, in unix seconds (what to send as ntfy's `delay` field). */
  atSeconds: number;
  reminder: Reminder;
}

/** A pending scheduled message that should be deleted from the server. */
export interface NtfyDeleteAction {
  sequenceId: string;
}

export interface NtfySyncPlan {
  publish: Array<NtfyPublishAction>;
  delete: Array<NtfyDeleteAction>;
}

// ntfy.sh's minimum delay for a scheduled message.
const DEFAULT_MIN_LEAD_SECONDS = 10;
// PoC-fixed horizon: only reminders due within the next 24 hours are kept
// registered on the server. `NtfyController` re-runs this on an interval so
// the window keeps rolling forward (ntfy itself allows scheduling up to 3
// days ahead, but registering that far out isn't useful: nothing else keeps
// the registration in sync with time/snooze changes made in the meantime).
const DEFAULT_HORIZON_SECONDS = 24 * 60 * 60;

export interface ComputeNtfySyncPlanParams {
  /** The current (non-done) reminders across the whole vault. */
  reminders: ReadonlyArray<Reminder>;
  /** Scheduled messages ntfy currently has pending for our topic. */
  serverPending: ReadonlyArray<NtfyPendingServerEntry>;
  now: DateTime;
  /** Fallback time-of-day for date-only reminders (the "Reminder Time" setting). */
  defaultTime?: Time;
  minLeadSeconds?: number;
  horizonSeconds?: number;
}

/**
 * Computes which reminders need to be (re-)published to ntfy as scheduled
 * messages, and which of our own pending scheduled messages are no longer
 * needed and should be deleted.
 *
 * A pure function: takes the current reminder set and the server's current
 * pending schedules, and returns the diff. This is what keeps ntfy publish
 * calls to a minimum (important for rate limits) — nothing is (re-)sent
 * unless it's actually new or its delivery time actually changed.
 */
export function computeNtfySyncPlan(
  params: ComputeNtfySyncPlanParams,
): NtfySyncPlan {
  const {
    reminders,
    serverPending,
    now,
    defaultTime,
    minLeadSeconds = DEFAULT_MIN_LEAD_SECONDS,
    horizonSeconds = DEFAULT_HORIZON_SECONDS,
  } = params;

  const nowMillis = now.getTimeInMillis(defaultTime);
  const minMillis = nowMillis + minLeadSeconds * 1000;
  const maxMillis = nowMillis + horizonSeconds * 1000;

  // Sequence IDs are assigned across the *whole* reminder list, not just the
  // ones inside the horizon window, so an ID never shifts just because the
  // rolling window moves past (or into) another reminder that shares the
  // same file + title.
  const sequenceIds = assignSequenceIds(reminders);

  // Delivery time (unix seconds) for *every* current reminder, regardless of
  // whether it's inside the publish horizon/lead window. Deletion decisions
  // are based on this map, not on `targets` below: `minLeadSeconds` only
  // constrains whether a reminder can be (re-)published right now (ntfy
  // can't schedule closer than that), it doesn't mean the reminder — or its
  // already-published schedule — is no longer wanted. Using `targets` for
  // deletion would delete a reminder's own pending scheduled message the
  // moment it slides inside the lead window, seconds before it was due to
  // fire.
  const reminderAtSecondsBySequenceId = new Map<string, number>();
  for (const reminder of reminders) {
    const atMillis = reminder.time.getTimeInMillis(defaultTime);
    const sequenceId = sequenceIds.get(reminder)!;
    reminderAtSecondsBySequenceId.set(sequenceId, Math.floor(atMillis / 1000));
  }

  const targets = new Map<string, NtfyPublishAction>();
  for (const reminder of reminders) {
    const atMillis = reminder.time.getTimeInMillis(defaultTime);
    // Strictly more than `minLeadSeconds` away (already-expired or
    // about-to-expire reminders are excluded) and at most `horizonSeconds`
    // away (inclusive of the boundary itself).
    if (atMillis <= minMillis || atMillis > maxMillis) {
      continue;
    }
    const sequenceId = sequenceIds.get(reminder)!;
    targets.set(sequenceId, {
      sequenceId,
      atSeconds: Math.floor(atMillis / 1000),
      reminder,
    });
  }

  const serverBySequenceId = new Map<string, NtfyPendingServerEntry>();
  for (const entry of serverPending) {
    serverBySequenceId.set(entry.sequenceId, entry);
  }

  const publish: Array<NtfyPublishAction> = [];
  for (const target of targets.values()) {
    const existing = serverBySequenceId.get(target.sequenceId);
    // ntfy's `time` is unix seconds, so compare at second granularity.
    if (existing === undefined || existing.atSeconds !== target.atSeconds) {
      publish.push(target);
    }
  }

  const deleteActions: Array<NtfyDeleteAction> = [];
  for (const entry of serverPending) {
    if (!isObsidianReminderSequenceId(entry.sequenceId)) {
      // Never touch another app/device's scheduled messages on the same
      // topic.
      continue;
    }
    if (targets.has(entry.sequenceId)) {
      // Still a publish target: if its time changed, `publish` above
      // already re-sends it under the same sequence ID, which replaces the
      // pending scheduled message on the server (see `computeSequenceId`).
      // No separate delete needed.
      continue;
    }
    const currentAtSeconds = reminderAtSecondsBySequenceId.get(
      entry.sequenceId,
    );
    // No matching reminder anymore (done/deleted) -> delete. A matching
    // reminder that fell out of the publish horizon/lead window because its
    // delivery time changed -> delete the now-stale schedule. A matching
    // reminder whose delivery time is unchanged -> leave the pending
    // schedule alone, even if it's now inside the lead window (this is the
    // fix: `minLeadSeconds` only limits when a schedule can be *created*,
    // not whether an already-published one is still wanted).
    if (
      currentAtSeconds === undefined ||
      currentAtSeconds !== entry.atSeconds
    ) {
      deleteActions.push({ sequenceId: entry.sequenceId });
    }
  }

  return { publish, delete: deleteActions };
}

/**
 * From the server's current pending scheduled messages, returns the
 * sequence IDs of the ones this plugin created (see
 * `isObsidianReminderSequenceId`). Used when the user disables ntfy sync
 * (`ntfyEnabled` going from true to false): every one of our own pending
 * schedules on the topic should be deleted so disabling the feature
 * actually stops notifications, while another app/device's schedules on
 * the same topic are left untouched.
 */
export function selectOwnPendingSequenceIds(
  serverPending: ReadonlyArray<NtfyPendingServerEntry>,
): Array<string> {
  return serverPending
    .map((entry) => entry.sequenceId)
    .filter(isObsidianReminderSequenceId);
}
