/**
 * State effects and helpers for reminder pill extension
 */
import { StateEffect } from "@codemirror/state";

/**
 * Effect to force recomputing reminder pill decorations.
 * Exported to allow external triggers (e.g., command or model changes).
 */
export const forceReminderPillRecompute = StateEffect.define<void>();
