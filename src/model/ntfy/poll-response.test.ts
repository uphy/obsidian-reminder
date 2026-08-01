import { foldNtfyPollResponse } from "./poll-response";
import type { NtfyPollResponseEntry } from "./poll-response";

const NOW_SECONDS = 1_000_000;

function messageEntry(
  sequenceId: string,
  atSeconds: number,
): NtfyPollResponseEntry {
  return { event: "message", sequenceId, atSeconds };
}

function deleteEntry(
  sequenceId: string,
  atSeconds: number,
): NtfyPollResponseEntry {
  return { event: "message_delete", sequenceId, atSeconds };
}

describe("foldNtfyPollResponse()", (): void => {
  test("classifies a single future message as pending", (): void => {
    const result = foldNtfyPollResponse(
      [messageEntry("a", NOW_SECONDS + 60)],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([
      { sequenceId: "a", atSeconds: NOW_SECONDS + 60 },
    ]);
    expect(result.delivered).toStrictEqual([]);
  });

  test("classifies a single past message as delivered", (): void => {
    const result = foldNtfyPollResponse(
      [messageEntry("a", NOW_SECONDS - 60)],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([]);
    expect(result.delivered).toStrictEqual([
      { sequenceId: "a", atSeconds: NOW_SECONDS - 60 },
    ]);
  });

  test("classifies a message exactly at now as delivered (boundary)", (): void => {
    const result = foldNtfyPollResponse(
      [messageEntry("a", NOW_SECONDS)],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([]);
    expect(result.delivered).toStrictEqual([
      { sequenceId: "a", atSeconds: NOW_SECONDS },
    ]);
  });

  test("treats a sequence ID whose latest (last-in-order) entry is a delete as gone, even though the message's own atSeconds is larger (regression: DELETE of a still-pending, far-future schedule)", (): void => {
    // Reproduces the bug found in review: `time` is not chronological
    // across event types. A `"message"` entry's `time` is its *scheduled
    // delivery* time (here, an hour out), while a `"message_delete"`
    // tombstone's `time` is roughly when the DELETE happened (here, "now",
    // seconds after the message was published). Sorting by `atSeconds`
    // would put the delete first and the message last, misreporting this
    // sequence ID as still pending even though it was just deleted. Poll
    // order (row order) is the only signal that reflects what actually
    // happened last.
    const result = foldNtfyPollResponse(
      [messageEntry("a", NOW_SECONDS + 3600), deleteEntry("a", NOW_SECONDS)],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([]);
    expect(result.delivered).toStrictEqual([]);
  });

  test("resurrects a sequence ID republished after being deleted (message -> delete -> message), even though atSeconds is not monotonic across the sequence", (): void => {
    // Same non-chronological-`atSeconds` shape as the regression above: the
    // first message was scheduled far in the future, got deleted shortly
    // after (tombstone `atSeconds` close to "now", i.e. smaller than the
    // message's), then republished for a nearer future time. Poll order,
    // not `atSeconds` order, must decide "last".
    const result = foldNtfyPollResponse(
      [
        messageEntry("a", NOW_SECONDS + 3600),
        deleteEntry("a", NOW_SECONDS - 90),
        messageEntry("a", NOW_SECONDS + 60),
      ],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([
      { sequenceId: "a", atSeconds: NOW_SECONDS + 60 },
    ]);
    expect(result.delivered).toStrictEqual([]);
  });

  test("handles multiple independent sequence IDs, some pending, some delivered, some deleted", (): void => {
    const entries: Array<NtfyPollResponseEntry> = [
      messageEntry("pending-id", NOW_SECONDS + 60),
      messageEntry("delivered-id", NOW_SECONDS - 60),
      // Non-monotonic atSeconds within the group on purpose (see the
      // regression tests above): the message was scheduled far out, then
      // deleted almost immediately.
      messageEntry("deleted-id", NOW_SECONDS + 500),
      deleteEntry("deleted-id", NOW_SECONDS - 90),
    ];
    const result = foldNtfyPollResponse(entries, NOW_SECONDS);
    expect(result.pending).toStrictEqual([
      { sequenceId: "pending-id", atSeconds: NOW_SECONDS + 60 },
    ]);
    expect(result.delivered).toStrictEqual([
      { sequenceId: "delivered-id", atSeconds: NOW_SECONDS - 60 },
    ]);
  });

  test("deleting a still-pending message leaves only the tombstone (single entry, no original message line)", (): void => {
    // Verified against ntfy.sh: unlike deleting an already-delivered
    // message (where the original "message" entry sticks around), deleting
    // a pending one removes the original entry from the poll response
    // entirely, leaving only the tombstone line.
    const result = foldNtfyPollResponse(
      [deleteEntry("a", NOW_SECONDS - 10)],
      NOW_SECONDS,
    );
    expect(result.pending).toStrictEqual([]);
    expect(result.delivered).toStrictEqual([]);
  });

  test("returns empty pending/delivered for an empty poll response", (): void => {
    const result = foldNtfyPollResponse([], NOW_SECONDS);
    expect(result.pending).toStrictEqual([]);
    expect(result.delivered).toStrictEqual([]);
  });
});
