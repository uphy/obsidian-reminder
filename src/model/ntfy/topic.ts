/**
 * ntfy's own topic name pattern. A topic that doesn't match it is rejected by
 * the server, but the two request forms this plugin uses fail in different,
 * equally opaque ways: the poll endpoint puts the topic in the path (so a
 * stray character comes back as a 404 "page not found" for a topic nobody
 * ever created), while publishing puts it in the JSON body (so the same
 * topic comes back as a 400 "topic invalid"). Checking the name up front
 * turns both into one message at the point where the name is typed.
 */
const NTFY_TOPIC_PATTERN = /^[-_A-Za-z0-9]{1,64}$/;

/** Whether `topic` is a name ntfy will accept (see `NTFY_TOPIC_PATTERN`). */
export function isValidNtfyTopic(topic: string): boolean {
  return NTFY_TOPIC_PATTERN.test(topic);
}
