import type { DateTime } from "model/time";

/**
 * The actions a user can take on a displayed reminder, bundled together so
 * they can be assembled once and threaded through the toast/modal/system
 * notification layers as a single value instead of six separate callback
 * parameters.
 */
export interface ReminderActions {
  remindMeLater(time: DateTime): void;
  done(): void;
  mute(): void;
  openFile(): void;
  pauseAll(): void;
  muteAll(): void;
}
