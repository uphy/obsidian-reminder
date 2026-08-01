import type { NtfyPendingServerEntry } from "./sync-plan";

/**
 * One parsed line of ntfy's `GET /<topic>/json?poll=1&sched=1` response.
 *
 * Only the two event types relevant to sync are represented here
 * (`"message"` for a still-registered or already-fired scheduled message,
 * `"message_delete"` for a tombstone left behind by a DELETE). Any other
 * `event` value (e.g. `"open"`/`"keepalive"`, which the streaming endpoint
 * can emit but this poll endpoint has not been observed to) is filtered out
 * before this type is constructed.
 */
export interface NtfyPollResponseEntry {
  event: "message" | "message_delete";
  sequenceId: string;
  /**
   * Unix seconds, taken from the entry's own `time` field. For a
   * `"message"` event this is the scheduled delivery time (ntfy's `delay`
   * echoed back) — which can be well into the future. For a
   * `"message_delete"` tombstone this is whatever `time` ntfy assigns the
   * tombstone itself (effectively "when the DELETE happened").
   *
   * Because of that mismatch, `atSeconds` is NOT chronological order and
   * must never be sorted on to figure out which entry happened most
   * recently — see `foldNtfyPollResponse()`.
   */
  atSeconds: number;
}

/** The current state of our own scheduled messages on the server, folded
 * down to one entry per sequence ID (see `foldNtfyPollResponse`). */
export interface NtfyPollResponseState {
  /** Sequence IDs whose latest event is a `"message"` still due in the future. */
  pending: Array<NtfyPendingServerEntry>;
  /** Sequence IDs whose latest event is a `"message"` whose time has already passed. */
  delivered: Array<NtfyPendingServerEntry>;
}

/**
 * Folds a poll response's flat, possibly-repeated-per-sequence-ID list of
 * entries down to the current state of each sequence ID.
 *
 * Verified by hand against ntfy.sh: ntfy's message history is append-only.
 * `DELETE /<topic>/<sequence_id>` never removes the original `"message"`
 * entry from the poll response — it just appends a `"message_delete"`
 * tombstone alongside it (for a message that had already fired; for one
 * still pending, the original entry does disappear, but the general rule
 * below handles both cases uniformly). And since sequence IDs are freely
 * reusable, a deleted ID can be republished later, adding a new `"message"`
 * entry after the tombstone. So the same sequence ID can legitimately have
 * several entries in one poll response, and the only way to know its
 * *current* state is to look at whichever entry happened most recently —
 * never "does a message entry with this ID exist anywhere in the response".
 *
 * That "most recent" entry is determined by **input order (row order in the
 * NDJSON poll response), not by `atSeconds`**. This is deliberate, not an
 * oversight: `atSeconds` is each entry's own `time` field, and that field
 * means different things for the two event types — a `"message"` entry's
 * `time` is its *scheduled delivery* time, which can be well into the
 * future, while a `"message_delete"` tombstone's `time` is roughly when the
 * DELETE actually happened, i.e. close to "now". So deleting a
 * still-pending, far-future schedule produces a tombstone whose `atSeconds`
 * is *smaller* than the message's own `atSeconds`, even though the delete
 * happened after the message was created — sorting by `atSeconds` would
 * then pick the older `"message"` entry as "last" and misreport a deleted
 * schedule as still pending. Row order in the poll response, on the other
 * hand, reflects ntfy's append-only history directly (verified against
 * ntfy.sh: `message(t=+0s)` -> `message_delete(t=<delete time>)` ->
 * `message(t=+1h)` after a republish came back in exactly that order), so
 * it's the only ordering signal that's actually chronological.
 *
 * `now` is passed in (rather than read via `Date.now()` here) so this stays
 * a pure function, consistent with the rest of `model/`.
 */
export function foldNtfyPollResponse(
  entries: ReadonlyArray<NtfyPollResponseEntry>,
  nowSeconds: number,
): NtfyPollResponseState {
  const bySequenceId = new Map<string, Array<NtfyPollResponseEntry>>();
  for (const entry of entries) {
    const group = bySequenceId.get(entry.sequenceId);
    if (group === undefined) {
      bySequenceId.set(entry.sequenceId, [entry]);
    } else {
      group.push(entry);
    }
  }

  const pending: Array<NtfyPendingServerEntry> = [];
  const delivered: Array<NtfyPendingServerEntry> = [];
  for (const group of bySequenceId.values()) {
    // `group` preserves the order entries were encountered in `entries`
    // (i.e. row order in the poll response), which is the only trustworthy
    // indicator of recency here — see the "most recent" discussion above.
    // Do NOT sort this by `atSeconds`.
    const last = group[group.length - 1]!;
    if (last.event === "message_delete") {
      // Most recently deleted -> not currently active, regardless of
      // whether an older "message" entry for the same ID also exists.
      // Excluding it from both sets is also what makes a second DELETE
      // (e.g. a delivered entry that gets deleted, then re-observed on a
      // later poll before its reminder changes again) a no-op instead of a
      // repeat network call: `computeNtfySyncPlan()` only issues deletes for
      // entries it's told about.
      continue;
    }
    const bucket = last.atSeconds > nowSeconds ? pending : delivered;
    bucket.push({ sequenceId: last.sequenceId, atSeconds: last.atSeconds });
  }
  return { pending, delivered };
}
