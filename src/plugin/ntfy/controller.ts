import type { Reminder } from "model/reminder";
import { DateTime } from "model/time";
import type { Time } from "model/time";
import {
  computeNtfySyncPlan,
  foldNtfyPollResponse,
  isValidNtfyTopic,
  noteNameFromPath,
  selectOwnPendingSequenceIds,
} from "model/ntfy";
import type { NtfyPollResponseEntry, NtfyPollResponseState } from "model/ntfy";
import type { NtfyRequestFn } from "./http";
import {
  authHeaders,
  describeFailure,
  isAuthFailure,
  normalizeServerUrl,
  pollUrl,
  scheduleUrl,
} from "./http";

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
  /**
   * The ntfy access token, or an empty string when the server needs no
   * authentication (see `authHeaders()`).
   */
  accessToken(): string;
  /** The current (non-done) reminders across the whole vault. */
  reminders(): Array<Reminder>;
  defaultTime(): Time;
  vaultName(): string;
  registerInterval(id: number): void;
  /** Must not throw on HTTP error statuses; see `NtfyRequest`. */
  request: NtfyRequestFn;
  /** Shows a message to the user (an Obsidian `Notice` in production). */
  notify(message: string): void;
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
  // concurrently. Concurrent rounds could otherwise race â€” e.g. a delete
  // from one round and a publish from another interleaving in an
  // unpredictable order for the same sequence ID.
  private syncing = false;
  private syncQueued = false;
  private stopped = false;
  // Tracks `isEnabled()` across calls to `notifySettingsChanged()` so a
  // true -> false transition can be detected (see `checkEnabledTransition`).
  // Left `undefined` until `start()` runs, so a settings change that fires
  // before then (e.g. while persisted settings are being restored) can
  // never be mistaken for a real transition.
  private previousEnabled: boolean | undefined;
  // Whether the user has already been told about an authentication failure
  // (see `noteAuthFailure`). Reset by `notifySettingsChanged()`.
  private authFailureNotified = false;

  constructor(private deps: NtfyControllerDeps) {}

  /**
   * Runs an initial sync immediately, then keeps resyncing on
   * `SYNC_INTERVAL_MILLIS` so the rolling publish horizon and any drift
   // (e.g. a previous sync failure) get corrected periodically.
   */
  start(): void {
    this.previousEnabled = this.deps.isEnabled();
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
   * `window.setTimeout` from `notifyRemindersChanged()` is not â€” without
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

  /**
   * Called whenever one of the ntfy-related settings (`ntfyEnabled`,
   * `ntfyServerUrl`, `ntfyTopic`, `ntfyAccessToken`) changes. Without this,
   * re-enabling the toggle (or fixing a typo'd server URL/topic/token) would
   * sit inert for up to `SYNC_INTERVAL_MILLIS` until the next reminder edit
   * or interval sync happened to come around.
   *
   * Routed through the same debounce as `notifyRemindersChanged()` rather
   * than syncing immediately: the server URL/topic/token are free-text
   * fields, so syncing on every keystroke while the user is typing would hit
   * the ntfy server far more than necessary.
   */
  notifySettingsChanged(): void {
    if (this.stopped) {
      return;
    }
    // The settings that were rejected have just changed, so the next failure
    // describes a different configuration and is worth reporting again.
    this.authFailureNotified = false;
    this.checkEnabledTransition();
    this.notifyRemindersChanged();
  }

  /**
   * Tells the user, at most once, that the server is refusing our requests
   * for lack of valid credentials.
   *
   * `doSync()` deliberately swallows sync failures into the console so
   * transient problems (offline, server down) never turn into a stream of
   * Notices. An authentication failure is the one case that doesn't fit that
   * reasoning: it's a configuration error that will keep failing every 30
   * minutes until the user changes a setting, and the console is effectively
   * unreachable on mobile â€” the platform this whole feature exists for. So
   * it's surfaced, but only once per configuration (see
   * `notifySettingsChanged()`), which is enough to make a silent failure
   * visible without nagging.
   */
  private noteAuthFailure(status: number): void {
    if (!isAuthFailure(status) || this.authFailureNotified) {
      return;
    }
    this.authFailureNotified = true;
    this.deps.notify(
      `Reminder: the ntfy server rejected the request (${status}). ` +
        "Scheduled notifications are not being published. Check the ntfy " +
        "access token in the plugin settings.",
    );
  }

  /**
   * Detects a true -> false transition of `ntfyEnabled` and, when found,
   * runs a one-time cleanup that deletes this plugin's own pending
   * schedules from the server, so turning the feature off actually stops
   * notifications instead of leaving already-registered schedules in place
   * until they expire (or get cleaned up implicitly, which never happens
   * for reminders that were already removed from the vault).
   */
  private checkEnabledTransition(): void {
    const enabled = this.deps.isEnabled();
    const wasEnabled = this.previousEnabled;
    this.previousEnabled = enabled;
    if (wasEnabled === true && !enabled) {
      void this.cleanupAfterDisable();
    }
  }

  /**
   * Deletes every one of our own pending scheduled messages from the
   * server. Called once, right after `ntfyEnabled` transitions from true to
   * false (see `checkEnabledTransition`).
   *
   * This intentionally does NOT go through `doSync()`, which bails out
   * immediately whenever `isEnabled()` is false. That guard is correct for
   * routine syncing (never touch the network while disabled/unconfigured),
   * but wrong here: this one round of network calls is the direct, expected
   * consequence of the user's own action (switching the toggle off), not
   * background polling, so it's fine to make it even though the feature is
   * now disabled.
   *
   * Known limitation: if the user changes the topic name rather than
   * disabling the feature, this cleanup never runs for the old topic (there
   * is no way to recover a topic name that's no longer configured), so
   * schedules registered under a previous topic name are not cleaned up.
   *
   * Deliberately only deletes *pending* schedules, not already-*delivered*
   * ones (unlike `doSync()`'s regular sync, which deletes both â€” see
   * `computeNtfySyncPlan()`). A pending schedule represents a notification
   * that hasn't fired yet; deleting it prevents a real future action (an
   * unwanted push notification) from happening at all, which is squarely
   * "stop notifications" as promised by turning the toggle off. A delivered
   * message has already done its job on every subscribed device. Deleting
   * it now would retroactively cancel a notification the user has already
   * seen, purely because of a local, per-device settings change that has
   * nothing to do with whether the underlying reminder is still relevant â€”
   * the same reasoning that keeps muting a reminder from propagating to
   * ntfy (see `NtfyControllerDeps`/`doSync()` callers): a device-local
   * action shouldn't ripple into canceling notifications elsewhere unless
   * the reminder itself actually changed.
   */
  private async cleanupAfterDisable(): Promise<void> {
    const target = this.resolveServerAndTopic();
    if (target === undefined) {
      return;
    }
    const { serverUrl, topic } = target;
    try {
      const { pending } = await this.fetchServerState(serverUrl, topic);
      const ownSequenceIds = selectOwnPendingSequenceIds(pending);
      for (const sequenceId of ownSequenceIds) {
        await this.deleteScheduled(serverUrl, topic, sequenceId);
      }
    } catch (e) {
      console.error(
        "[ntfy] Failed to clean up scheduled notifications after disabling: %o",
        e,
      );
    }
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
    const target = this.resolveServerAndTopic();
    if (target === undefined) {
      // Unconfigured: never touch the network.
      return;
    }
    const { serverUrl, topic } = target;

    try {
      const { pending, delivered } = await this.fetchServerState(
        serverUrl,
        topic,
      );
      const plan = computeNtfySyncPlan({
        reminders: this.deps.reminders(),
        serverPending: pending,
        serverDelivered: delivered,
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
   * Normalizes the configured server URL/topic, or returns `undefined` when
   * the pair can't produce a request the server would accept: a blank server
   * URL or topic (i.e. unconfigured), or a topic ntfy's own name pattern
   * rejects. Shared by `doSync()` and `cleanupAfterDisable()`.
   *
   * Bailing out on an invalid topic rather than sending it anyway keeps a
   * typo from turning into a request every 30 minutes for a topic that can
   * never exist; the settings tab shows the reason at the point the name is
   * typed (see `isValidNtfyTopic`).
   */
  private resolveServerAndTopic():
    { serverUrl: string; topic: string } | undefined {
    const serverUrl = normalizeServerUrl(this.deps.serverUrl());
    const topic = this.deps.topic().trim();
    if (serverUrl.length === 0 || !isValidNtfyTopic(topic)) {
      return undefined;
    }
    return { serverUrl, topic };
  }

  /**
   * `GET /<topic>/json?poll=1&sched=1` returns the topic's scheduled
   * messages (and their tombstones) as newline-delimited JSON
   * (`content-type: application/x-ndjson`), one JSON object per line.
   * Verified against ntfy.sh:
   * - Every publish response and every polled `"message"` line has a
   *   `sequence_id` field (echoing whatever we sent as `X-Sequence-ID`/left
   *   absent) and a `time` field: unix seconds, matching the `delay` we
   *   sent.
   * - This endpoint keeps returning `"message"` entries whose delivery time
   *   has already passed â€” they're not purged from the poll cache the
   *   moment they fire â€” for as long as ntfy's message cache retains them
   *   (12h by default on ntfy.sh). This is what makes deleting an
   *   already-fired message possible at all: `DELETE
   *   /<topic>/<sequence_id>` on one of these entries returns HTTP 200 and
   *   causes subscribed clients to cancel the push notification they
   *   already showed (verified with ntfy's Android app and the web app in
   *   Chrome; ntfy's docs list `Supported on:` Android and Firefox, so the
   *   web app isn't actually Firefox-only).
   * - Deleting a message appends an `event: "message_delete"` tombstone
   *   line to the poll response rather than replacing the original entry:
   *   ntfy's message history is append-only, so a deleted-then-republished
   *   sequence ID can accumulate several lines (message, delete, message,
   *   ...) for the same `sequence_id` across polls. `foldNtfyPollResponse()`
   *   (in `model/ntfy`) is what resolves that history down to each sequence
   *   ID's current state by looking only at the chronologically-last entry.
   * - Polling a topic with nothing pending/delivered returns HTTP 200 with
   *   an empty body.
   */
  private async fetchServerState(
    serverUrl: string,
    topic: string,
  ): Promise<NtfyPollResponseState> {
    const response = await this.deps.request({
      url: pollUrl(serverUrl, topic),
      method: "GET",
      headers: authHeaders(this.deps.accessToken()),
    });
    if (response.status >= 400) {
      this.noteAuthFailure(response.status);
      // Do NOT return an empty result here: `computeNtfySyncPlan()` would
      // then read that as "the server has nothing pending/delivered" and
      // (re-)publish every reminder in the 24h window at once. A transient
      // failure (a 5xx, or the very first request after coming back online)
      // would otherwise turn into a burst of publish requests â€” bad for
      // ntfy's rate limits. Throwing here lets `doSync()`'s catch block
      // abandon this whole round instead; it's retried on the next
      // debounce/interval tick.
      throw new Error(
        `ntfy: failed to fetch the topic's scheduled messages: ${describeFailure(response)}`,
      );
    }

    const entries: Array<NtfyPollResponseEntry> = [];
    for (const line of response.text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      let parsed: { event?: string; sequence_id?: string; time?: number };
      try {
        // JSON.parse returns any. The server's response is untrusted either
        // way, so narrow it to the fields the checks below read.
        parsed = JSON.parse(trimmed) as typeof parsed;
      } catch (e) {
        console.error("[ntfy] Failed to parse a poll response line: %o", e);
        continue;
      }
      if (
        (parsed.event !== "message" && parsed.event !== "message_delete") ||
        parsed.sequence_id === undefined ||
        parsed.time === undefined
      ) {
        continue;
      }
      entries.push({
        event: parsed.event,
        sequenceId: parsed.sequence_id,
        atSeconds: parsed.time,
      });
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return foldNtfyPollResponse(entries, nowSeconds);
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
   * - The JSON body's `at` field is *not* honored as a delay â€” a message
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
    action: { sequenceId: string; reminder: Reminder; atSeconds: number },
  ): Promise<void> {
    const response = await this.deps.request({
      url: `${serverUrl}/`,
      method: "POST",
      headers: {
        ...authHeaders(this.deps.accessToken()),
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
    });
    if (response.status >= 400) {
      this.noteAuthFailure(response.status);
      console.error(
        "[ntfy] Failed to publish a scheduled notification: %s",
        describeFailure(response),
      );
    }
  }

  /**
   * `DELETE /<topic>/<sequence_id>` deletes a schedule, whether it's still
   * pending or already delivered. Verified against ntfy.sh for both cases:
   * a pending schedule is removed outright (its `"message"` entry drops out
   * of the poll response, leaving only the tombstone), while a delivered
   * one keeps its original `"message"` entry in the poll response (ntfy's
   * message history is append-only) but gains a `"message_delete"`
   * tombstone alongside it â€” and, for a delivered message specifically,
   * this is also what tells subscribed clients (verified: ntfy's Android
   * app and the web app in Chrome) to cancel the notification they showed.
   * Also verified idempotent: deleting an ID that no longer exists (or
   * never existed) still returns HTTP 200, so no special "not found"
   * handling is needed here.
   */
  private async deleteScheduled(
    serverUrl: string,
    topic: string,
    sequenceId: string,
  ): Promise<void> {
    const response = await this.deps.request({
      url: scheduleUrl(serverUrl, topic, sequenceId),
      method: "DELETE",
      headers: authHeaders(this.deps.accessToken()),
    });
    if (response.status >= 400) {
      this.noteAuthFailure(response.status);
      console.error(
        "[ntfy] Failed to delete a scheduled notification: %s",
        describeFailure(response),
      );
    }
  }

  /**
   * Builds an `obsidian://open` URL for the reminder's note. Verified that
   * ntfy echoes the JSON body's `click` field back verbatim (see
   * `publish()`), so it must be fully URL-encoded here â€” ntfy itself does no
   * encoding of it.
   */
  private buildClickUrl(reminder: Reminder): string {
    const pathWithoutExtension = reminder.file.replace(/\.md$/i, "");
    const vault = encodeURIComponent(this.deps.vaultName());
    const file = encodeURIComponent(pathWithoutExtension);
    return `obsidian://open?vault=${vault}&file=${file}`;
  }
}
