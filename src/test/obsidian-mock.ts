/**
 * Runtime stand-in for the `obsidian` module under jest.
 *
 * The `obsidian` npm package only ships type definitions (`"main": ""`), so
 * anything that imports it cannot be loaded by jest at all. Most of the
 * plugin sidesteps this by keeping its testable logic free of `obsidian`
 * imports, but `plugin/settings/helper.ts` needs the real `Setting` UI class
 * and is pulled in transitively by `plugin/data.ts`.
 *
 * Only the classes reachable at import time are declared here, as empty
 * classes: no test constructs them, they just have to exist so the module
 * graph loads. Add to this file when a test needs another export — and give
 * it real behavior only if the test actually depends on it.
 */
export class Setting {}
export class AbstractTextComponent {}

/**
 * Reachable through `plugin/settings/index.ts`, which passes it to
 * `testNtfyConnection()` when the ntfy settings' Test button is clicked.
 * Throwing rather than returning a fake response keeps an accidental network
 * call in a test loud: nothing under test should ever reach this. Code that
 * genuinely needs to exercise HTTP takes a request function through its deps
 * instead (see `NtfyControllerDeps.request`).
 */
export function requestUrl(): never {
  throw new Error("requestUrl() is not available under jest");
}
