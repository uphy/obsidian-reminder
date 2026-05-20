# Task: Reminder Reschedule Feature

## Summary
Add the ability to reschedule (move) existing reminders from the reminder list view via right-click context menu, with quick options (3 hours from now, tomorrow, next week) and a custom date/time picker.

## Requirements

### 1. Context Menu on Reminder List Items
- Right-click on any reminder in the reminder list view to show a context menu
- The context menu includes:
  - "In 3 hours" — moves reminder to 3 hours from now
  - "Tomorrow" — moves reminder to tomorrow (same time)
  - "Next week" — moves reminder to next week (same time)
  - "Custom..." — opens a date/time picker modal (reuses DateTimeChooser)

### 2. Click Behavior
- Clicking a reminder opens the existing reminder modal (no change)
- Right-click opens the context menu for reschedule actions

### 3. Date/Time Picker Modal
- When "Custom..." is selected, opens RescheduleModal with:
  - Calendar view for date selection (reuses DateTimeChooser.svelte)
  - Time picker for time selection
  - OK/Cancel via modal close behavior
- After selecting date/time, the reminder's time is updated in the file

### 4. File System Integration
- When a reminder is rescheduled, update the reminder time in the source markdown file
- Uses the existing `ReminderPluginFileSystem.updateReminder()` mechanism
- Triggers a rescan after modification via `plugin.data.save(true)` and `ui.reload(true)`

### 5. Dagger Build & Test Pipeline
- Created `ci/src/obsidian_reminder/main.py` (Dagger pipeline) with:
  - `build()` function: installs deps, builds the plugin
  - `test()` function: runs all jest tests
- Created Makefile targets:
  - `dagger-build`: runs `dagger call build --source-dir ..`
  - `dagger-test`: runs `dagger call test --source-dir ..`

### 6. Tests
- Unit tests for DateTime/Time/Later model classes (31 tests)
- Unit tests for Content.updateReminder() (9 tests)
- Unit tests for reschedule logic and edge cases (14 tests)
- All existing tests continue to pass (45 tests)

## Architecture

### Key Files Modified
- `src/plugin/ui/reminder-list.ts` — Added context menu via Obsidian Menu API
- `src/plugin/ui/index.ts` — Added `rescheduleReminder()` method
- `src/plugin/ui/reschedule-modal.ts` — Fixed missing import
- `src/ui/ReminderListByDate.svelte` — Added contextmenu handler
- `src/ui/ReminderList.svelte` — Passed reschedule props through

### Pattern Used
1. Svelte component delegates contextmenu to parent via `onRescheduleContext` callback
2. `ReminderListItemView` creates Obsidian `Menu` with quick options
3. Quick options calculate new DateTime and call `plugin.ui.rescheduleReminder()`
4. "Custom..." opens `RescheduleModal` which reuses `DateTimeChooser.svelte`
5. `rescheduleReminder()` updates reminder time, writes to file, saves data, reloads list

## Acceptance Criteria
- [x] Right-click on reminder shows context menu with reschedule options
- [x] "In 3 hours" updates reminder time to now + 3 hours
- [x] "Tomorrow" updates reminder time to tomorrow
- [x] "Next week" updates reminder time to next week
- [x] "Custom..." opens date/time picker modal
- [x] Selecting date/time in modal updates the reminder
- [x] Changes are persisted to the markdown file
- [x] Reminder list refreshes after reschedule
- [x] Dagger build pipeline works via Makefile
- [x] Dagger test pipeline works via Makefile
- [x] All existing tests pass (45/45)
- [x] New tests for reschedule feature pass (54 new tests)
- [x] Total: 99 tests passing
