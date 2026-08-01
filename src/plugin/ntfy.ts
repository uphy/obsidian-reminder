import { computeNtfySyncPlan, noteNameFromPath } from "model/ntfy";
import type { NtfyPendingServerEntry, NtfyPublishAction } from "model/ntfy";
import type { Reminder } from "model/reminder";
import { DateTime } from "model/time";
import type { Time } from "model/time";
import { requestUrl } from "obsidian";

// How often to re-run the sync while idle, so the 24h publish horizon keeps
// rolling forward even if nothing else triggers a sync in the meantime.
const SYNC_INTERVAL_MILLIS = 30 * 60 * 1000;
// Reminder edits often arrive in bursts (typing, autosave); debounce so we
// don't hit the ntfy server once per keystroke.
const DEBOUNCE_MILLIS = 10 * 1000;

export interface NtfyControllerDeps {
  isEnabled(): boolean;
  serverUrl(): string;
  topic(): string;
  /** The current (non-done) reminders across the whole vault. */
  reminders(): Array<Reminder>;
  defaultTime(): Time;
  vaultName(): string;
  registerInterval(id: number): void;
}

/**
 * Publishes upcoming reminders to an ntfy (https://ntfy.sh) topic as
 * scheduled ("delayed") messages, so the ntfy server delivers a push
 * notification at the reminder's time even when Obsidian isn't running.
 * This works around obsidian-reminder issues #16/#150: Obsidian mobile
 * cannot run plugin code in the background, so without this, reminders on
 * mobile only fire while the app happens to be open.
 *
 * All ntfy HTTP behavior referenced in the comments below was verified by
 * hand against a random ntfy.sh topic (not assumed from documentation
 * alone) while implementing this PoC.
 */
export class NtfyController {
  private debounceTimer: number | undefined;
  // Simple serialization for `sync()`: at most one round runs at a time.
  // If `sync()` is invoked again while a round is already in flight (the
  // initial `start()` call, a debounced reminder change, and the 30-minute
  // interval can all land close together), that invocation just requests
  // one more round after the current one finishes, instead of running
  // concurrently. Concurrent rounds could otherwise race — e.g. a delete
  // from one round and a publish from another interleaving in an
  // unpredictable order for the same sequence ID.
  private syncing = false;
  private syncQueued = false;
  private stopped = false;

  constructor(private deps: NtfyControllerDeps) {}

  /**
   * Runs an initial sync immediately, then keeps resyncing on
   * `SYNC_INTERVAL_MILLIS` so the rolling publish horizon and any drift
   * (e.g. a previous sync failure) get corrected periodically.
   */
  start(): void {
    void this.sync();
    this.deps.registerInterval(
      window.setInterval(() => {
        void this.sync();
      }, SYNC_INTERVAL_MILLIS),
    );
  }

  /**
   * Cancels any pending debounced sync. `registerInterval` (used by
   * `start()`) is cleaned up automatically on plugin unload, but a
   * `window.setTimeout` from `notifyRemindersChanged()` is not — without
   * this, a debounced sync could still fire (and make a network request)
   * right after the plugin is disabled. Call this from the plugin's
   * `onunload()`.
   */
  stop(): void {
    this.stopped = true;
    if (this.debounceTimer !== undefined) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  /**
   * Called whenever the reminder set changes. Debounced so a burst of file
   * edits results in a single sync rather than one per change.
   */
  notifyRemindersChanged(): void {
    if (this.stopped) {
      return;
    }
    if (this.debounceTimer !== undefined) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = undefined;
      void this.sync();
    }, DEBOUNCE_MILLIS);
  }

  private async sync(): Promise<void> {
    if (this.syncing) {
      this.syncQueued = true;
      return;
    }
    this.syncing = true;
    try {
      await this.doSync();
    } finally {
      this.syncing = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        void this.sync();
      }
    }
  }

  private async doSync(): Promise<void> {
    if (!this.deps.isEnabled()) {
      return;
    }
    const serverUrl = this.deps.serverUrl().trim().replace(/\/+$/, "");
    const topic = this.deps.topic().trim();
    if (serverUrl.length === 0 || topic.length === 0) {
      // Disabled/unconfigured: never touch the network.
      return;
    }

    try {
      const serverPending = await this.fetchPending(serverUrl, topic);
      const plan = computeNtfySyncPlan({
        reminders: this.deps.reminders(),
        serverPending,
        now: DateTime.now(),
        defaultTime: this.deps.defaultTime(),
      });

      // Deletes first: if a reminder's (file, title) sequence ID collided
      // with a stale entry that's about to be replaced anyway, deleting
      // first then publishing avoids a moment where both could be pending.
      for (const action of plan.delete) {
        await this.deleteScheduled(serverUrl, topic, action.sequenceId);
      }
      for (const action of plan.publish) {
        await this.publish(serverUrl, topic, action);
      }
    } catch (e) {
      // PoC-level guard: never spam the user with Notices for transient
      // network errors (offline, server down, misconfigured URL, etc). Log
      // it and let the next debounce/interval tick retry.
      console.error("[ntfy] Failed to sync scheduled notifications: %o", e);
    }
  }

  /**
   * `GET /<topic>/json?poll=1&sched=1` returns the topic's pending scheduled
   * messages as newline-delimited JSON (`content-type:
   * application/x-ndjson`), one JSON object per line. Verified against
   * ntfy.sh:
   * - Every publish response and every polled line has a `sequence_id`
   *   field (echoing whatever we sent as `X-Sequence-ID`/left absent) and a
   *   `time` field: unix seconds, matching the `delay` we sent.
   * - This endpoint also keeps returning messages whose delivery time has
   *   already passed (they're not purged from the poll cache the moment
   *   they fire), and returns `event: "message_delete"` tombstone entries
   *   for anything that has been explicitly deleted. Both are filtered out
   *   below (`event !== "message"` or `time` no longer in the future) so
   *   they aren't mistaken for still-pending schedules.
   * - Polling a topic with nothing pending returns HTTP 200 with an empty
   *   body.
   */
  private async fetchPending(
    serverUrl: string,
    topic: string,
  ): Promise<Array<NtfyPendingServerEntry>> {
    const response = await requestUrl({
      url: `${serverUrl}/${encodeURIComponent(topic)}/json?poll=1&sched=1`,
      method: "GET",
      throw: false,
    });
    if (response.status >= 400) {
      // Do NOT return an empty list here: `computeNtfySyncPlan()` would then
      // read that as "the server has nothing pending" and (re-)publish
      // every reminder in the 24h window at once. A transient failure (a
      // 5xx, or the very first request after coming back online) would
      // otherwise turn into a burst of publish requests — bad for ntfy's
      // rate limits. Throwing here lets `doSync()`'s catch block abandon
      // this whole round instead; it's retried on the next debounce/
      // interval tick.
      throw new Error(
        `ntfy: failed to fetch pending scheduled messages: status=${response.status}`,
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const result: Array<NtfyPendingServerEntry> = [];
    for (const line of response.text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      let parsed: { event?: string; sequence_id?: string; time?: number };
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        console.error("[ntfy] Failed to parse a poll response line: %o", e);
        continue;
      }
      if (
        parsed.event !== "message" ||
        parsed.sequence_id === undefined ||
        parsed.time === undefined ||
        parsed.time <= nowSeconds
      ) {
        continue;
      }
      result.push({ sequenceId: parsed.sequence_id, atSeconds: parsed.time });
    }
    return result;
  }

  /**
   * Publishes as JSON (`POST /` with `Content-Type: application/json` and
   * the topic in the body, per ntfy's "Publish as JSON" support) instead of
   * the plain-text-plus-headers form used by an earlier version of this
   * PoC. This lets the title and note name travel as JSON string values, so
   * non-ASCII text never has to survive an HTTP header round-trip.
   *
   * All of the following was re-verified by hand against a random ntfy.sh
   * topic for this JSON form specifically (behavior can differ from the
   * header form even though both are documented):
   * - The JSON body's own `sequence_id` field is *not* honored for
   *   replacement: publishing twice with the same `sequence_id` value in
   *   the body creates two separate pending scheduled messages, not one.
   *   The `X-Sequence-ID` header still works as before (same as the
   *   previous header-based version of this code): publishing again under
   *   the same header value replaces the previous still-pending schedule
   *   for that ID (new message `id` each time, same `sequence_id`, poll
   *   endpoint converges to only the latest one). So `X-Sequence-ID` is
   *   still sent as a header, while everything else moves into the JSON
   *   body.
   * - The JSON body's `at` field is *not* honored as a delay — a message
   *   sent with `at` set to a future unix timestamp was delivered
   *   immediately. `delay` is what actually schedules it, and it accepts
   *   the same unix-seconds value (as a JSON string; a bare JSON number is
   *   rejected). So `delay` is used here for what was previously sent as
   *   `X-At`.
   * - `click` behaves the same as the old `X-Click` header: ntfy echoes it
   *   back verbatim as the message's `click` field with no server-side
   *   encoding, so it must already be fully URL-encoded here.
   */
  private async publish(
    serverUrl: string,
    topic: string,
    action: NtfyPublishAction,
  ): Promise<void> {
    const response = await requestUrl({
      url: `${serverUrl}/`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sequence-ID": action.sequenceId,
      },
      body: JSON.stringify({
        topic,
        title: action.reminder.title,
        message: noteNameFromPath(action.reminder.file),
        click: this.buildClickUrl(action.reminder),
        delay: String(action.atSeconds),
      }),
      throw: false,
    });
    if (response.status >= 400) {
      console.error(
        "[ntfy] Failed to publish a scheduled notification: status=%d",
        response.status,
      );
    }
  }

  /**
   * `DELETE /<topic>/<sequence_id>` deletes a still-pending schedule.
   * Verified idempotent: deleting an ID that no longer exists (or never
   * existed) still returns HTTP 200, so no special "not found" handling is
   * needed here.
   */
  private async deleteScheduled(
    serverUrl: string,
    topic: string,
    sequenceId: string,
  ): Promise<void> {
    const response = await requestUrl({
      url: `${serverUrl}/${encodeURIComponent(topic)}/${encodeURIComponent(sequenceId)}`,
      method: "DELETE",
      throw: false,
    });
    if (response.status >= 400) {
      console.error(
        "[ntfy] Failed to delete a scheduled notification: status=%d",
        response.status,
      );
    }
  }

  /**
   * Builds an `obsidian://open` URL for the reminder's note. Verified that
   * ntfy echoes the JSON body's `click` field back verbatim (see
   * `publish()`), so it must be fully URL-encoded here — ntfy itself does no
   * encoding of it.
   */
  private buildClickUrl(reminder: Reminder): string {
    const pathWithoutExtension = reminder.file.replace(/\.md$/i, "");
    const vault = encodeURIComponent(this.deps.vaultName());
    const file = encodeURIComponent(pathWithoutExtension);
    return `obsidian://open?vault=${vault}&file=${file}`;
  }
}
