import { isValidNtfyTopic } from "./topic";

describe("isValidNtfyTopic()", (): void => {
  test("accepts letters, digits, dashes and underscores", (): void => {
    expect(isValidNtfyTopic("my-topic_2")).toBe(true);
  });

  test("rejects an empty topic", (): void => {
    expect(isValidNtfyTopic("")).toBe(false);
  });

  test("rejects a topic longer than 64 characters", (): void => {
    expect(isValidNtfyTopic("a".repeat(64))).toBe(true);
    expect(isValidNtfyTopic("a".repeat(65))).toBe(false);
  });

  test("rejects the query-parameter form some users try for auth", (): void => {
    expect(isValidNtfyTopic("reminders?auth=dGVzdA")).toBe(false);
  });

  test("rejects a topic containing a slash", (): void => {
    expect(isValidNtfyTopic("reminders/json")).toBe(false);
  });

  test("rejects surrounding whitespace", (): void => {
    expect(isValidNtfyTopic(" reminders ")).toBe(false);
  });

  test("rejects non-ASCII characters", (): void => {
    expect(isValidNtfyTopic("リマインダー")).toBe(false);
  });
});
