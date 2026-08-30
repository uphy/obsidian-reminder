import type MomentFactory from "moment";
import { moment as obsidianMoment } from "obsidian";

/**
 * moment, taken from the copy Obsidian bundles rather than from the `moment`
 * package, so the plugin does not ship a second one -- importing it directly
 * adds ~60KB to main.js.
 *
 * The cast is what makes it usable. `obsidian` declares its re-export as
 * `export const moment: typeof Moment`, where `Moment` comes from a
 * namespace-style `import * as Moment from 'moment'`. Under
 * `esModuleInterop: true` a namespace type has no call signatures, so
 * `moment("2026-01-01")` fails to compile even though the value is the moment
 * factory at runtime. Restore the callable type here, once, instead of at
 * every call site.
 *
 * Import this module rather than `moment` anywhere the factory is called; a
 * bare `import type { Moment } from "moment"` for the type alone is fine.
 */
export const moment = obsidianMoment as unknown as typeof MomentFactory;
