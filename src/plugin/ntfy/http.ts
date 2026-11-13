/**
 * The subset of Obsidian's `RequestUrlParam`/`RequestUrlResponse` this module
 * uses, declared here rather than imported so nothing in this file depends on
 * the `obsidian` module (which ships no runtime JavaScript, and so can't be
 * loaded under jest). `main.ts` passes a `requestUrl` wrapper that matches
 * this structurally, the same bridging `DataStore` does in `plugin/data.ts`.
 */
export interface NtfyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface NtfyResponse {
  status: number;
  text: string;
}

export type NtfyRequestFn = (request: NtfyRequest) => Promise<NtfyResponse>;

/**
 * ntfy authenticates with `Authorization: Bearer <token>` for access tokens.
 * An empty token means "this server needs no credentials", which has to send
 * no header at all rather than an empty one: ntfy rejects a malformed
 * `Authorization` header outright, so sending `Bearer ` would break the
 * anonymous case that worked before tokens existed.
 */
export function authHeaders(accessToken: string): Record<string, string> {
  const token = accessToken.trim();
  return token.length === 0 ? {} : { Authorization: `Bearer ${token}` };
}

/** Strips trailing slashes so URL building can always add its own. */
export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "");
}

export function pollUrl(serverUrl: string, topic: string): string {
  return `${serverUrl}/${encodeURIComponent(topic)}/json?poll=1&sched=1`;
}

export function scheduleUrl(
  serverUrl: string,
  topic: string,
  sequenceId: string,
): string {
  return `${serverUrl}/${encodeURIComponent(topic)}/${encodeURIComponent(sequenceId)}`;
}

/**
 * Renders a failed response for a log line or the settings UI. The server's
 * own body is included because the status code alone doesn't say which of
 * several unrelated problems occurred: ntfy answers 403 both for "no
 * credentials were sent" and for "this token may not touch that topic", and
 * 404 both for "no such topic" and "that isn't an ntfy server".
 */
export function describeFailure(response: NtfyResponse): string {
  const body = response.text.trim().slice(0, 200);
  return body.length === 0
    ? `status=${response.status}`
    : `status=${response.status} body=${body}`;
}

/** Whether a status means the request was refused for lack of credentials. */
export function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}
