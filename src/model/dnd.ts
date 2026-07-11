import type { DateTime } from "model/time";

/**
 * Whether reminder notifications should currently be suppressed by
 * do-not-disturb mode.
 *
 * `dndUntil` is the time do-not-disturb was set to expire at (or `null` if
 * do-not-disturb is not active). Notifications stay paused only while `now`
 * is strictly before `dndUntil`; reminders are never muted by this check, so
 * anything still expired fires again once the pause ends.
 */
export function isNotificationPaused(
  dndUntil: DateTime | null,
  now: DateTime,
): boolean {
  if (dndUntil == null) {
    return false;
  }
  return now.getTimeInMillis() < dndUntil.getTimeInMillis();
}
