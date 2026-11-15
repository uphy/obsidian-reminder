---
name: obsidian-qa
description: Run a QA pass over obsidian-reminder's note reminders in a real, running Obsidian — about 170 scripted checks (reading properties, Done / Mute / Remind me later, the reminder dialog, repeating reminders, the header bell, TaskNotes reminders and the TaskNotes API, the settings tab, plugin reload, system notifications), followed by a display tour that screenshots the settings tab, the notifications, the list and the dialog in English, Japanese and Chinese for a layout and wording review. Use it before marking a PR that touches note reminders ready, after a fix found by QA, or when the user says "QAして", "一通りQA", "実機で全部確認して", "英語と中国語の表示を確認して", "UIを見直して", "obsidian-qa". It builds on obsidian-e2e (same test vault, same guards); for a single ad-hoc check use obsidian-e2e directly, and to prepare a vault for a human use manual-verify.
---

# obsidian-qa: a repeatable QA pass in a live Obsidian

Three parts, in this order:

1. **Scripted checks** — `cases/10` to `cases/50`. Each prints `PASS` or
   `FAIL` with the failed checks.
2. **Display tour** — `cases/60-display-tour.js` puts one screen up per
   call; you screenshot it and read it. Nothing is asserted there: layout
   and wording need eyes.
3. **Clean-up** — `cases/99-end.js`. Always run it, also after a failure.

## Before you start

- Everything goes through the `obsidian-e2e` scripts. Read that skill's
  "Safety" section first; its rules apply unchanged. In short: only the
  dedicated test vault (the one carrying `.obsidian/obsidian-e2e-allowed`),
  never copy that marker anywhere, never touch another vault's window.
- Set the vault for the session:
  `export OBSIDIAN_TEST_VAULT_NAME=<name> OBSIDIAN_TEST_VAULT_PATH=<path>`.
- Obsidian must be running with the debugging port (see `obsidian-e2e`),
  with the test vault open and this worktree's build loaded:
  `mise run main:build`, then reload the plugin
  (`app.plugins.disablePlugin` / `enablePlugin` of
  `obsidian-reminder-plugin`).
- The TaskNotes plugin must be installed and enabled in the test vault for
  `cases/3x`. Without it those cases fail at the first check; say so in the
  report instead of skipping silently.
- The run writes only under `QA/` in the vault and changes this plugin's
  settings. The first case snapshots the settings into `localStorage`;
  `99-end.js` restores and saves them.

## Running the checks

```
S=.claude/skills/obsidian-qa
$S/scripts/qa-run.sh $S/cases/[1-5]*.js     # everything, in order (about 4 minutes)
$S/scripts/qa-run.sh $S/cases/99-end.js     # clean-up
```

`qa-run.sh` exits non-zero when a case fails or throws. To rerun part of
the suite, run a whole group from its first file: the files of a group
share state (the notes and settings the first one sets up).

| Group | Files | What it covers |
| --- | --- | --- |
| Property reminders | `10`–`12` | Reading date and date & time values, Done (`<property>-done`), Mute, Remind me later, a value changed after the notification was shown, labels with several properties, the cut-off date, excluded paths, rename and delete |
| Dialog and bell | `20`–`25` | The offer to set up `reminder`, creating and editing, title, removing, Done state, repeating reminders (advance, end, unreadable rule), the header bell's states, the command, the file menu |
| TaskNotes | `30`–`33` | Reading absolute and relative entries, completed and archived tasks, Done and snooze through the TaskNotes API, following TaskNotes' own settings, the direct write when the API is not there |
| Settings tab | `40`–`43` | Adding properties (validation, duplicates), Managed, cut-off, Remove, greyed rows, the TaskNotes cut-off |
| Reload and OS | `50` | State after a plugin reload, acting on a system notification |

When a check fails:

- Read the `detail` of the failed check, then reproduce it by hand with
  `obsidian-eval.mjs` before deciding it is a product bug. The usual false
  alarms are listed under "Pitfalls".
- A product bug gets a jest test that fails first, then the fix, then the
  group is rerun. Unit tests are where the behaviour is pinned down; these
  cases only show that the pieces work together in the app.
- When a feature changes on purpose, update the case in the same PR.

## Display tour

```
T=$S/cases/60-display-tour.js
$S/scripts/qa-run.sh --step setup $T
$S/scripts/qa-run.sh --step settings@zh-cn --shot .work/qa/settings-zh.png $T
```

`--step NAME@LANGUAGE` picks the screen and the plugin's UI language
(`en`, `ja`, `zh-cn`); `--shot` screenshots the window afterwards. Read
each screenshot with the Read tool.

| Step | Screen |
| --- | --- |
| `settings`, then `settings-bottom` | The "Note reminders" tab, top and bottom |
| `main` | Notifications, the reminder list, the bell; also raises the two notices |
| `dialog-new`, `dialog-error`, `dialog-edit`, `dialog-long`, `dialog-done`, `dialog-foreign`, `dialog-two` | The reminder dialog: empty, with a rule error, with a value, with a long note name, handled, with a value that is not a date, with two managed properties |
| `close` | Closes whatever the tour left open |

What to look for:

- **Layout**: text cut off or overlapping, a control pushed out of its row
  (`overflow` in the result lists rows wider than their container), the
  dialog wider than its calendar (`width` in the result), uneven margins.
- **Wording**: a string left in English in `ja` / `zh-cn`, one term
  translated two ways, punctuation of the wrong width (a half-width space
  after a full-width colon), plural forms ("1 notes"), quotes of mixed
  styles.
- Compare the three languages of one screen side by side; a difference in
  line count is where a layout breaks first.

For the mobile layout, turn on mobile emulation, wait for the window to
come back, then repeat the dialog steps:

```
node .claude/skills/obsidian-e2e/scripts/obsidian-eval.mjs 'setTimeout(() => app.emulateMobile(true), 100); return 1;'
.claude/skills/obsidian-e2e/scripts/obsidian-wait.sh --timeout 40
```

`app.emulateMobile` reloads the window, which is why it is deferred with
`setTimeout` and followed by the wait. Turn it off the same way with
`false` before the clean-up. This shows a tablet-like layout; it says
nothing about a phone's width.

## Clean-up

`99-end.js` deletes `QA/`, restores the settings from the snapshot, saves
them, reloads the plugin and prints what is left. Check its result:
`qaNotesLeft` is 0, `language` and `noteReminderSources` are what they
were before the run, `mobile` is false.

## Not covered

Say these in the report, so that nobody reads "QA passed" as more than it
is:

- **ntfy**: sending goes to a server outside this machine, so it is not
  exercised. `src/plugin/ntfy.test.ts` covers the request that is built.
- **Phone width** and anything touch-only.
- **Bases** views of the properties.
- **TaskNotes refusing an API write** (unit-tested in
  `src/plugin/note-reminders.test.ts`).
- Line reminders (the Markdown formats), except where they share a
  notification with a note reminder. `obsidian-e2e` documents how to check
  those.

## Pitfalls

Each of these produced a false failure, or left the vault changed, once:

- **Settings changed in memory get saved anyway.** Another setting's save
  writes all of them. That is why the snapshot and `99-end.js` exist; do
  not end a session without running it.
- **The plugin's UI language is a saved setting.** `qa-lib.js` pins it to
  English for the checks (they click buttons by label) and the tour sets
  it per step. `99-end.js` puts the user's choice back.
- **A notification is replaced when its reminder's value changes.** A
  stale Done or snooze cannot be driven through the old toast. Call
  `p._noteReminders.apply(reminder, action)` with the reminder object
  captured before the change instead (`11-property-snooze-stale.js`).
- **Close the toasts before using one** (`closeToasts()`), or `toast(...)`
  finds a card left by an earlier case.
- **A rescan after a cut-off change takes seconds.** Wait for the state
  with `waitFor(...)`, not a fixed `sleep`.
- **A date input has no invalid text.** Typing "not a date" into
  `input[type=date]` clears it; that is the browser, not a bug.
- **The bell has no "done" class.** Its states are `is-idle` plus the icon
  (`lucide-bell-plus`, `lucide-bell-ring`, `lucide-bell`).
- **TaskNotes' settings must not be edited in place.** Changing
  `tasknotes.settings.fieldMapping` in memory also changes TaskNotes'
  field mapper, and TaskNotes then writes other property names until it is
  reloaded. `32-tasknotes-follow-settings.js` restores the values and
  reloads TaskNotes at its end; keep that when editing the case.
- **`require("obsidian")` does not exist in an eval.** For `Menu`, pass a
  stand-in that records the items (`25-bell-command-menu.js`).
- **System notification buttons are in the plugin's UI language**, not
  the OS language (`50-reload-system-notification.js` runs in English).
- **A leftover settings overlay hides dialogs.** The settings cases mount
  the tab in `#qa-settings`; the first file of every group removes it.

## Writing a case

A case is the body of an async function evaluated inside Obsidian, with
`scripts/qa-lib.js` prepended. The helpers it gets (see the file for all
of them): `p` (the plugin), `s` (its settings), `mk` / `rm` / `read` /
`fmOf` for notes, `at(minutes)` / `day(days)` for values relative to now,
`rems(prefix)` for the pending reminders, `toasts()` / `toast(text)` /
`tDone` / `tMute` / `tSnooze` for notifications, `waitFor`, `ok(name,
pass, detail)` and `finish()`.

- Keep notes under `QA/<group>/`.
- Name checks so that a failure reads as a sentence about the product
  ("Done on a snoozed TaskNotes reminder removes the snooze entry").
- Number the file inside its group; the runner takes files in the order
  the shell expands them.
- These files are ignored by eslint (`.claude/**`); keep them plain
  JavaScript.

## Reporting

Give the count of passed and failed checks per group, every failure with
what was done about it (fixed with a commit, or a false alarm and why),
the display findings split into "fixed" and "left for a decision", and the
"Not covered" list.
