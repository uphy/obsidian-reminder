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

- `src/model/` — Domain logic with no dependency on the Obsidian API: `Reminder`/`Reminders` (`model/reminder.ts`), date/time handling via `DateTime`/`Time` (`model/time.ts`), and the reminder-syntax parsers for Markdown (`model/format/`). This is the only layer with direct jest unit tests (because it never imports the `obsidian` module).
- `src/plugin/` — The plugin body, which depends on the Obsidian API. Bundles file watching, notifications, settings, and command registration (`plugin/index.ts` is the export entry point).
- `src/ui/` — Svelte components (`ui/*.svelte`) and the TS that supports them (e.g. calendar calculations). The Obsidian Modal/View code in `src/plugin/ui/` mounts the Svelte components.

Flow from reminder parsing to notification:
1. `src/plugin/filesystem.ts` (`ReminderPluginFileSystem`) watches the vault's modify/delete/rename events.
2. Changed files are passed to `src/model/content.ts` (`Content`), and `getReminders()` calls `parseReminder()` in `model/format/index.ts`.
3. `parseReminder()` goes through `CompositeReminderFormat` (`model/format/reminder-base.ts`), trying each enabled format in turn (the default format `reminder-default.ts`, the Tasks plugin format `reminder-tasks-plugin.ts`, the Kanban plugin format `reminder-kanban-plugin.ts`) to build an array of `Reminder`.
4. The result is stored in `Reminders` in `model/reminder.ts`, and a callback in `main.ts` notifies the UI whenever it changes.
5. `src/plugin/notification-worker.ts` (`NotificationWorker`) runs periodically via `registerInterval`, detects expired reminders with `Reminders.getExpiredReminders()`, and displays them through `ReminderPluginUI.showReminder()` in `plugin/ui/index.ts` → `ReminderModal` in `plugin/ui/reminder.ts` (which internally uses `ui/Reminder.svelte`).
6. The reminder list is shown by a custom View in `plugin/ui/reminder-list.ts` (`ui/ReminderList.svelte`, etc).

Settings are declared by `Settings` in `src/plugin/settings/index.ts` using a builder DSL called `SettingTabModel` (`plugin/settings/helper.ts`), and persisted by `PluginData` in `src/plugin/data.ts` via `loadData`/`saveData`.

## Local development

Symlink the dev vault's `.obsidian/plugins/obsidian-reminder-plugin` to this repository, and install and enable the hot-reload plugin ([pjeby/hot-reload](https://github.com/pjeby/hot-reload)) at `.obsidian/plugins/hot-reload`. hot-reload watches any plugin directory that contains `.git` or `.hotreload`, and automatically reloads just that plugin whenever it detects a change to `main.js`/`styles.css`.

With this set up, running `mise run dev` keeps esbuild's watch build resident, so every time you save a source file it automatically rebuilds and reloads in Obsidian. No manual copying or restarting Obsidian is needed.

Automated tests only cover `src/model/`. After implementing a change that affects runtime behavior in Obsidian (anything under `src/plugin/` or `src/ui/`, or parsing behavior visible in the vault), run the `manual-verify` skill to set up the test vault and walk the user through verification before opening a PR. A Stop hook (`.claude/hooks/manual-verify-reminder.sh`) reminds about this once per change state.

## Release flow

`release.sh` has been removed. Releases are done exclusively via `.github/workflows/release.yml` and `release-beta.yml`, both triggered manually via `workflow_dispatch`.

- Official release: run `release.yml` on master with a `bump` input (`patch`/`minor`/`major`, default `patch`) instead of an explicit version — e.g. `gh workflow run release.yml` (defaults to patch) or `gh workflow run release.yml -f bump=minor`. The workflow runs the test suite, checks that manifest.json's and package.json's versions are in sync (fails with an error otherwise), computes the next version from manifest.json via `npm version <bump>` (which also bumps package.json/package-lock.json), and updates manifest.json (version) and versions.json (appends the new version, paired with manifest.json's `minAppVersion`) → builds → commits and tags the version bump on master → creates a GitHub Release with auto-generated release notes → then (after the release job succeeds) deploys the docs site to gh-pages.
- Beta release: run `release-beta.yml` on the equivalent of the develop branch, still with a typed-in explicit version (e.g. `1.2.0-beta.1`) since beta versions don't map to a bump level → updates manifest-beta.json, pushes to develop, and tags it → automatically opens a PR from a branch that cherry-picks that change onto master (merging is manual) → creates a GitHub Release marked as prerelease. Because BRAT reads `manifest.json` from the release assets, the build step copies `manifest-beta.json` over `manifest.json` before packaging, so BRAT sees the beta version.
- `versions.json` maps plugin versions to the minimum supported Obsidian version; `release.yml` appends the new version automatically using manifest.json's `minAppVersion`, so this file no longer needs manual upkeep.

GitHub Release notes are auto-generated from PR labels according to `.github/release.yml`. Every PR should be labeled with one of `breaking-change`, `enhancement`, `bug`, `documentation`, or `chore` (Dependabot PRs get `dependencies` automatically). Unlabeled PRs fall into "Other Changes".

## Notes

- Unlike the common practice of using the `window.moment` that Obsidian itself provides, this plugin imports `moment` directly as an npm dependency (it's not listed in `esbuild.config.mjs`'s `external` either) and bundles it itself with esbuild. Don't write code that assumes Obsidian's bundled moment.
- eslint's `quotes` rule is set to `single`, but `eslint-config-prettier` overrides this later in the chain, so prettier's default (double quotes) is effectively what's enforced. The actual code consistently uses double quotes.
- Import paths mostly use the absolute-path-style notation rooted at baseUrl (`src/`) (e.g. `model/reminder`), but some files mix in relative paths (`../../model/reminder`).
- See `.claude/rules/` for detailed conventions.
