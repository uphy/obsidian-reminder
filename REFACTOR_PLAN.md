# Refactor plan v2 — obsidian-reminder (upstream compatibility: not a constraint)

Goal: code that is easy to read and easy to change with an AI assistant, **without changing behaviour**.
Principles: one concern per file, files under ~300 lines, folders by feature, tests beside the code they test, no leftover re-export shims.
Kept on purpose: the layer rule `model/` (pure, never imports `obsidian`) / `plugin/` (Obsidian glue) / `ui/` (Svelte). It is architectural and tested.

## Target layout (end state)
```
src/
  main.ts  global.d.ts  i18n/
  model/
    reminder.ts  reminders.ts  reminder-grouping.ts  time.ts  content.ts  exclusion.ts  ref.ts  moment.ts  dnd.ts
    format/  ntfy/
    tasknotes/  index.ts  types.ts  values.ts  duration.ts  anchor.ts  identification.ts  skip-rules.ts  state.ts  completion.ts  settings-import.ts
  plugin/
    index.ts  commands/  obsidian-hack/
    core/       data.ts  filesystem.ts  notification-worker.ts  dnd.ts
    ntfy/       controller.ts  http.ts  connection-test.ts
    tasknotes/  integration.ts  rescan.ts  runtime-api.ts  (optional: actions.ts  settings-fetch.ts)
    settings/   index.ts  tab-model.ts  setting-model.ts  setting-builders.ts  serdes.ts  sections/*.ts
    ui/         index.ts  modals/  notifications/  editor/  status-bar/  views/  util.ts  electron.ts  find-leaf-showing-file.ts  constants.ts
  ui/           reminder/  datetime/  list/  common/
```

## Before you start (human, once)
- [ ] Land the TaskNotes feature branch first, or branch `refactor/structure` from it. Never mix refactors into a feature PR.
- [ ] Baseline green: `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- [ ] Add `settings-layout.test.ts` (provided) as `src/plugin/settings/settings-layout.test.ts`, run `npm run lint:fix` once, commit. It locks the order of 7 settings pages and 64 setting keys. Setting keys are saved in users' `data.json`, so renaming one silently loses a saved value.
- [ ] `git tag pre-refactor`.
- [ ] Line endings: `git config core.autocrlf input`, `"files.eol": "\n"` in `.vscode/settings.json`, `git status` clean.
- [ ] `.vscode/settings.json`: add `"typescript.updateImportsOnFileMove.enabled": "always"` so dragging a file in Explorer rewrites its importers.
- [ ] Copy `copilot-instructions.md` to `.github/copilot-instructions.md` (check Chat's References list shows it attached).
- [ ] Model with tool calling and a large context. OpenRouter `:free` models: 20 requests/min, 50/day until $10 of credits are bought once (then 1,000/day).

## How to run a step
1. New Chat per step. 2. Message: `Do step A2 from #file:REFACTOR_PLAN.md. Follow the repo instructions. List the files you will touch first.`
3. Prefer VS Code over the model for mechanical work: `Ctrl+.` on a symbol -> **Move to a new file**; drag files between folders in Explorer; F2 to rename. Use the model for fixing leftover tsc/lint errors and for writing comments.
4. Gate: `npx tsc --noEmit` and `npm test`; `npm run lint` before each commit. Red twice -> `git restore .`, skip, note why.
5. One step per commit: `refactor(<area>): <what>`. Moved files take their `*.test.ts` with them.

Suggested order: A1, A2, B1, B2, B3, B4, D1, C1, C2, B5 (optional), E1-E4.

---

## Phase A — Pure model
**A1 Split `model/tasknotes/index.ts` (563 lines).** In `src/model/tasknotes/` create, moving code verbatim (add `export`): `types.ts` (`TaskNotesIdentificationMode`, `TaskNotesPropertyNames`, `TaskNotesOptions`, `TaskNotesContext`, `DEFAULT_TASKNOTES_PROPERTIES`), `values.ts` (`hasValue`, `coerceScalar`, `isRecord`), `duration.ts` (`DURATION_PATTERN`, `parseDuration`, `applyDuration`), `anchor.ts` (`DATE_PATTERN`, `DATETIME_PATTERN`, `parseAnchor`, `coerceAnchorScalar`, `parseDateTime`, `parseAnchorTime`), `identification.ts` (`isIdentified`, `isExcluded`, `hasTag`), `skip-rules.ts` (`isCompleted`, `collectRecurringInstanceDates`, `collectDateStrings`, `isValidDateString`, `isLeapYear`). `index.ts` keeps `extractReminders`, `parseReminder`, `warn`, `warnedInvalidReminders`. Importers use `model/tasknotes/types` directly (update `settings-import.ts`, `plugin/tasknotes.ts`, `plugin/settings/index.ts`, the test). Done when: `index.ts` is ~200 lines, tests green.

**A2 Split `model/reminder.ts` (584 lines, 39 importers).** `reminder.ts` keeps `Reminder` and the TaskNotes types; `reminders.ts` gets `Reminders`; `reminder-grouping.ts` gets `DateDisplayFormat*`, `dateDisplayFormatPresets`, `generateGroup`, `Group`, `groupReminders`, `GroupedReminder`. Use **Move to a new file** so all importers are rewritten; no shim. Done when: no file over ~250 lines, tsc/tests green. Manual: reminder list + date display format.

## Phase B — Feature folders in `plugin/`
**B1 ntfy.** `plugin/ntfy.ts` (746) -> `plugin/ntfy/controller.ts` (`NtfyController` + constants), `http.ts` (`NtfyRequest`/`Response`/`RequestFn`, `authHeaders`, `normalizeServerUrl`, `pollUrl`, `scheduleUrl`, `describeFailure`, `isAuthFailure`), `connection-test.ts` (from `CONNECTION_TEST_SEQUENCE_ID` to the end: `testNtfyConnection` + types). Move `ntfy.test.ts` -> `ntfy/controller.test.ts`. Update `plugin/index.ts` and `settings/index.ts`. Manual: ntfy "Test connection".

**B2 tasknotes.** Move `plugin/tasknotes.ts` -> `plugin/tasknotes/integration.ts`, `tasknotes-rescan.ts` -> `tasknotes/rescan.ts` (tests follow). Then extract the private helper block after the class (`getTaskNotesModalApi`, `getTaskNotesRuntimeApi`, `callRuntimeApiMethod`, `runtimeTaskGetter`, `legacyTaskGetter`, `isRecord`, `isTaskInfoGetter`, `isCapabilityChecker`, `isTaskEditModal` + their types) to `tasknotes/runtime-api.ts`. *Optional B2b:* `settings-fetch.ts` (`fetchSettingsFromTaskNotes`) and `actions.ts` (`done`, `snooze`, `mute`, `openTaskEditModal`, `openTaskNote`, `taskForReminder`). Manual: Fetch from TaskNotes, Done, Snooze, Mute.

**B3 core.** `plugin/data.ts`, `filesystem.ts`, `notification-worker.ts`, `dnd.ts` (+ tests) -> `plugin/core/`; fix `plugin/index.ts`.

**B4 ui folders.** In `plugin/ui/`: `modals/` (reminder-modal, date-chooser-modal, datetime-format-modal, date-display-format-preset-chooser, dnd-duration-chooser), `notifications/` (system-notification, reminder-toast, reminder-notifier, notification-buttons, reminder-actions), `editor/` (editor-extension, cm6-datetime-chooser, autocomplete, reminder-line-highlight, editor-reminder-display/), `status-bar/` (dnd-status-bar, overdue-status-bar), `views/` (reminder-list). Drag in Explorer. Manual: open a modal, a toast, the list view, the status bar.

**B5 (optional, supervised)** Split `ReminderPluginUI` (`plugin/ui/index.ts`, 515): move `showReminder`, `handleReminderAction`, `muteExpiredReminders`, `openReminderFile` into `notifications/reminder-action-handler.ts`. `handleReminderAction` is the single choke point that keeps TaskNotes reminders from editing notes: keep its `source` branching intact and the `Content.updateReminder` read-only test green.

## Phase C — Settings
**C1 Split `plugin/settings/helper.ts` (738).** `serdes.ts` (the `Serde` interface + 5 serdes), `setting-model.ts` (`SettingModelBase`, `SettingModel`, `SettingModelImpl`, `SettingContext`, `SettingRegistry`), `setting-builders.ts` (`SettingModelBuilder`, abstract + text/number/toggle/dropdown builders, `DropdownOption`), `tab-model.ts` (`SettingGroup`, `SettingPage`, `SettingTabModel`). Dependencies must stay one-way: serdes <- builders <- tab-model, setting-model <- builders. If a new file would import from a file that imports it, stop and report.

**C2 Split the `Settings` class (`settings/index.ts`, 1,091 lines).** The constructor is ~900 lines of page sections; `ReminderFormatSettings` (end of file) is the pattern to follow: one class per section taking the `SettingTabModel`.
1. Pilot: move `ReminderFormatSettings` to `settings/sections/reminder-formats.ts`.
2. One section per commit, in this order: TaskNotes (page "TaskNotes integration" + "TaskNotes property names" group), ntfy, Notifications, Editor, Display, Advanced. Expose each as a member (`settings.taskNotes.enabled`, `settings.ntfy.serverUrl`...). The ~83 outside call sites are fixed by following the tsc errors (or Find/Replace with a regex).
3. Preserve the page and setting registration order and every `.key("...")`: `settings-layout.test.ts` must pass **unchanged**. Manual: open every settings page, change a value, restart, confirm it persisted.
Skip the rest if a section is not green within 3 attempts.

## Phase D — Svelte `ui/`
**D1** `ui/reminder/` (Reminder.svelte), `ui/datetime/` (DateTimeChooser, Calendar, TimePicker, `calendar.ts`, `timed-input-handler.ts` + tests), `ui/list/` (ReminderList, ReminderListByDate), `ui/common/` (IconText, Markdown). Editor tooling may not rewrite Svelte imports, so fix the rest from `npm run lint` (svelte-check) errors.

## Phase E — Readability pass
- **E1** 2-4 line purpose comment at the top of every file above ~150 lines.
- **E2** `src/README.md`: one line per folder (what lives here, what must not).
- **E3** Dead code: `grep` each candidate first (e.g. `Reminders.muteExpiredReminders` is only used by tests); optionally `npx knip` to list unused exports. Remove only what is provably unused.
- **E4** Update the repo map in `.github/copilot-instructions.md` and the Architecture section of `CLAUDE.md`.

## Final gate (human)
`npm run lint`, `npm test`, `npm run build`. No non-test file over ~300 lines (PowerShell: `Get-ChildItem src -Recurse -Include *.ts,*.svelte | ? Name -notlike '*.test.ts' | % { [pscustomobject]@{Lines=(Get-Content $_).Count; File=$_.Name} } | sort Lines -desc | select -first 8`). In the dev vault: reload plugin, every settings page, markdown reminder fires, TaskNotes reminder (snooze/done), ntfy test, reminder list, language switch.

## Not doing
Folder-per-layer reshuffle (`features/`), renaming exports for style, reformatting, splitting `model/time.ts`.

## Progress
- [ ] A1 - [ ] A2 - [ ] B1 - [ ] B2 - [ ] B3 - [ ] B4 - [ ] D1 - [ ] C1 - [ ] C2 - [ ] B5 (opt) - [ ] E1 - [ ] E2 - [ ] E3 - [ ] E4

Current worktree progress: A1/A2, B1-B4, D1, and C1 have been moved or split. C2's TaskNotes, ntfy, Notifications, Editor, Display, and Advanced settings sections are now extracted; settings-layout and TaskNotes integration tests pass unchanged. TypeScript, full Jest (36 suites / 508 tests), and production build all pass. ESLint reports only pre-existing deprecation and UI-text warnings (not introduced by refactor). Remaining: verify the in-progress steps, then B5 (optional) and E1-E4, followed by final lint/test/build and manual Obsidian checks.
