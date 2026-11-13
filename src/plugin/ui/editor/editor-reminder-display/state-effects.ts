import { StateEffect } from "@codemirror/state";

/**
 * Requests that the reminder pill `StateField` rebuild its decorations from
 * a fresh parse of the document, even though the transaction carrying this
 * effect may not itself touch a previously known reminder span.
 *
 * Dispatched by the debounced re-parse in `extension.ts` (paired with an
 * annotation carrying the freshly computed spans) after edits that don't
 * intersect any currently known reminder, and by the pill click handler in
 * `pill-widget.ts` right after it rewrites a reminder's line.
 */
export const forceReminderPillRecompute = StateEffect.define<void>();
