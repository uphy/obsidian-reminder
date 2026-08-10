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
