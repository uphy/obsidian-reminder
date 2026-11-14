# obsidian-reminder

A plugin that adds reminder functionality to Obsidian's TODO lists. Built with TypeScript + Svelte 4, bundled with esbuild.

## Language

Write all repository artifacts — code comments, commit messages, documentation — in English.

## Commands

Prefer mise tasks (they just wrap npm scripts under the hood).

| mise | Underlying command (npm script) | Purpose |
| --- | --- | --- |
| `mise run main:init` | `npm install` | Install dependencies |
| `mise run main:build` | `npm run build` (`node esbuild.config.mjs production`) | Run a production-equivalent build once |
| `mise run dev` | `npm run dev` (`node esbuild.config.mjs watch`) | Start a persistent development watch build |
| `mise run main:test` | `npm run test` (`jest`) | Run the full test suite |
| `mise run main:lint:fix` | `npm run lint:fix` | eslint --fix + tsc --noEmit + svelte-check |
| `mise run pre-commit` | `main:lint:fix` → `main:test` | Pre-commit checks |
| `mise run docs` | `npm run dev` in `docs/` | Run the documentation site (VuePress) locally |

`esbuild.config.mjs` uses esbuild's context API: with no arguments it runs a development build once and exits, with `watch` the process stays resident and automatically rebuilds on every file change, and with `production` it runs a production-equivalent build (minified, no sourcemap) once and exits.

To run a single test, call jest directly.
```
npx jest src/model/format/reminder-default.test.ts
npx jest -t "parse - link dates to daily notes"
```

## Architecture

The entry point is `src/main.ts` (`ReminderPlugin`). `src/` is organized into three layers.

- `src/model/` — Domain logic with no dependency on the Obsidian API: `Reminder`/`Reminders` (`model/reminder.ts`), date/time handling via `DateTime`/`Time` (`model/time.ts`), the reminder-syntax parsers for Markdown (`model/format/`), and note reminders — reminders read from a note's frontmatter properties (`model/note/`). Most jest unit tests live here, because it never imports the `obsidian` module and so needs nothing else in place.
- `src/plugin/` — The plugin body, which depends on the Obsidian API. Bundles file watching, notifications, settings, and command registration (`plugin/index.ts` is the export entry point).
- `src/ui/` — Svelte components (`ui/*.svelte`) and the TS that supports them (e.g. calendar calculations). The Obsidian Modal/View code in `src/plugin/ui/` mounts the Svelte components.

Flow from reminder parsing to notification:
1. `src/plugin/filesystem.ts` (`ReminderPluginFileSystem`) watches the vault's modify/delete/rename events.
2. Changed files are passed to `src/model/content.ts` (`Content`), and `getReminders()` calls `parseReminder()` in `model/format/index.ts`.
3. `parseReminder()` goes through `CompositeReminderFormat` (`model/format/reminder-base.ts`), trying each enabled format in turn (the default format `reminder-default.ts`, the Tasks plugin format `reminder-tasks-plugin.ts`, the Kanban plugin format `reminder-kanban-plugin.ts`) to build an array of `Reminder`.
4. In the same reload, `filesystem.ts` passes the file's text to `NoteReminderService` (`src/plugin/note-reminders.ts`), which parses the frontmatter and asks the note reminder formats in `model/note/` for the pending note reminders (`property-format.ts`: properties listed in the "Note reminders" settings, with optional recurrence; `tasknotes-format.ts`: the `reminders` list of TaskNotes task notes, when turned on). Line reminders and note reminders are merged into one `Reminders.replaceFile()` call per file. A `Reminder` says which kind it is through its `origin` (a line with a row, or a note with a format and key).
5. The result is stored in `Reminders` in `model/reminder.ts`, and a callback in `main.ts` notifies the UI whenever it changes.
6. `src/plugin/notification-worker.ts` (`NotificationWorker`) runs periodically via `registerInterval`, detects expired reminders with `Reminders.getExpiredReminders()`, and displays them through `ReminderPluginUI.showReminder()` in `plugin/ui/index.ts` → `ReminderModal` in `plugin/ui/reminder.ts` (which internally uses `ui/Reminder.svelte`). "Done" and "Remind me later" rewrite the task line for a line reminder; for a note reminder they go through `NoteReminderService.apply()`, which writes the frontmatter with `FileManager.processFrontMatter` and writes nothing when the note no longer holds the time the notification was shown for.
7. The reminder list is shown by a custom View in `plugin/ui/reminder-list.ts` (`ui/ReminderList.svelte`, etc).

Settings are declared by `Settings` in `src/plugin/settings/index.ts` using a builder DSL called `SettingTabModel` (`plugin/settings/helper.ts`), and persisted by `PluginData` in `src/plugin/data.ts` via `loadData`/`saveData`.

## Local development

Symlink the dev vault's `.obsidian/plugins/obsidian-reminder-plugin` to this repository, and install and enable the hot-reload plugin ([pjeby/hot-reload](https://github.com/pjeby/hot-reload)) at `.obsidian/plugins/hot-reload`. hot-reload watches any plugin directory that contains `.git` or `.hotreload`, and automatically reloads just that plugin whenever it detects a change to `main.js`/`styles.css`.

With this set up, running `mise run dev` keeps esbuild's watch build resident, so every time you save a source file it automatically rebuilds and reloads in Obsidian. No manual copying or restarting Obsidian is needed.

Automated tests cover `src/model/` and the parts of `src/plugin/` whose dependencies are injected (see `.claude/rules/testing.md`), but nothing that renders. After implementing a change that affects runtime behavior in Obsidian (anything under `src/plugin/` or `src/ui/`, or parsing behavior visible in the vault), run the `manual-verify` skill to set up the test vault and walk the user through verification before opening a PR. A Stop hook (`.claude/hooks/manual-verify-reminder.sh`) reminds about this once per change state.

For a full pass over note reminders in the running app, use the `obsidian-qa` skill: scripted checks driven through `obsidian-e2e` (property reminders, the reminder dialog, TaskNotes, the settings tab, reload, system notifications), then a screenshot tour of the main screens in English, Japanese and Chinese for a layout and wording review, then a clean-up that restores the test vault's settings.

## PR review

Before opening a PR, run the `pr-review` skill from the branch's worktree (clean tree, not on main). It runs `.claude/workflows/pr-review.js`: five perspective agents (`.claude/agents/review-*.md` — CodeMirror/Obsidian lifecycle, reminder format, time and notifications, Obsidian plugin guidelines, testability) review `git diff <merge-base>..HEAD` in parallel, `review-verifier` tries to refute each finding, and `review-fixer` commits one fix per confirmed finding (lint + jest must pass, otherwise it reverts). Perspectives whose findings were fixed then re-review the fix commits, for at most 2 rounds. It never pushes or opens a PR. Tune what a perspective looks for by editing its agent file, and add new incidents to its "Past incidents" list when a bug slips through.

`pr-review <PR number>` reviews someone else's PR instead: it checks the PR out into `.claude/worktrees/pr-<N>`, refuses to run anything until the diff has been read for changes to build/test config, `.claude/`, `.github/`, or code doing more than the PR claims, takes the reviewers' instructions from the main checkout rather than the PR, doesn't fix by default, and drafts the confirmed findings as PR review comments that are posted only after you approve.

For a contributor's PR end to end, use the `contributor-pr` skill. Each run reads the PR's state and does the next stage: review (via `pr-review`), follow-up (check every review point against the code, not the replies), or land (merge main into the PR branch, test the combined behavior, check the docs, verify in the test vault with `obsidian-e2e`, approve the fork's CI run, thank the contributor, merge). Posting, pushing, and merging each wait for your go-ahead.

## Release flow

`release.sh` has been removed. Releases are done exclusively via `.github/workflows/release.yml` and `release-beta.yml`, both triggered manually via `workflow_dispatch`.

- Official release: run `release.yml` on main with a `bump` input (`patch`/`minor`/`major`, default `patch`) instead of an explicit version — e.g. `gh workflow run release.yml` (defaults to patch) or `gh workflow run release.yml -f bump=minor`. The workflow checks that manifest.json's and package.json's versions are in sync (fails with an error otherwise), computes the next version from manifest.json via `npm version <bump>` (which also bumps package.json/package-lock.json), and updates manifest.json (version) and versions.json (appends the new version, paired with manifest.json's `minAppVersion`) → commits the version bump, pushes it to a temporary `release/<version>` branch and waits for that commit's "test" check (run by `pr.yml`, which also triggers on `release/**`, and covers lint/type-check/tests/version-consistency) to pass, then pushes the same already-checked commit to main and deletes the temporary branch (main's branch protection requires a passing "test" status check per commit, which a direct push carries none of) → tags the release. A separate `publish` job then checks out the tag, builds and attests the assets, and creates a GitHub Release with auto-generated release notes (retrying with a backoff on API errors) → then the `gh-pages` job deploys the docs site from the tag.
  - If `publish` or `gh-pages` fails, fix the cause and use "Re-run failed jobs" on that run. Never dispatch `release.yml` again for the same release: main already carries the new version, so a second dispatch bumps to the next one. `publish` only reads the tag and reuses a release an earlier attempt already created, so re-running it is safe.
- Beta release: run `release-beta.yml` on the equivalent of the develop branch, still with a typed-in explicit version (e.g. `1.2.0-beta.1`) since beta versions don't map to a bump level → updates manifest-beta.json, pushes to develop, and tags it → automatically opens a PR from a branch that cherry-picks that change onto main (merging is manual) → creates a GitHub Release marked as prerelease. Because BRAT reads `manifest.json` from the release assets, the build step copies `manifest-beta.json` over `manifest.json` before packaging, so BRAT sees the beta version.
- `versions.json` maps plugin versions to the minimum supported Obsidian version; `release.yml` appends the new version automatically using manifest.json's `minAppVersion`, so this file no longer needs manual upkeep.
- Both workflows push (and `release-beta.yml` also opens its PR) using an installation token for the `uphy-ops` GitHub App instead of `GITHUB_TOKEN`, because GITHUB_TOKEN-authored pushes and PRs don't trigger other workflows, which would starve the required "test" check. This requires the `RELEASE_APP_CLIENT_ID` repository variable (the App's Client ID, passed as `client-id`; it isn't secret, so it's a variable rather than a secret) and the `RELEASE_APP_PRIVATE_KEY` repository secret.

GitHub Release notes are auto-generated from PR labels according to `.github/release.yml`. Every PR should be labeled with one of `breaking-change`, `enhancement`, `bug`, `documentation`, or `chore` (Dependabot PRs get `dependencies` automatically). Unlabeled PRs fall into "Other Changes".

## Notes

- `moment` is not bundled: `src/model/moment.ts` re-exports the instance Obsidian provides, so it is the same object as `window.moment` and its locale is shared with everything else in the app. That means two things. Never call `moment.locale()` — it would change how Obsidian and this plugin *parse and write* dates (`DateTimeFormatter`), not just how they are displayed; to render a date in a specific language, apply the locale to a clone (`DateTime.formatForDisplay()`). And never `import "moment/locale/..."` — esbuild cannot resolve moment's dynamic locale requires, and the locale data that matters is whatever Obsidian ships. Under jest, `src/test/obsidian-mock.ts` substitutes the npm package.
- eslint's `quotes` rule is set to `single`, but `eslint-config-prettier` overrides this later in the chain, so prettier's default (double quotes) is effectively what's enforced. The actual code consistently uses double quotes.
- Import paths mostly use the absolute-path-style notation rooted at baseUrl (`src/`) (e.g. `model/reminder`), but some files mix in relative paths (`../../model/reminder`).
- See `.claude/rules/` for detailed conventions.
