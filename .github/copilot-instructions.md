# Copilot instructions — obsidian-reminder

Obsidian plugin (TypeScript + Svelte 4, bundled with esbuild, tested with jest).
Fork of `uphy/obsidian-reminder` plus a TaskNotes YAML-reminder feature. Entry point: `src/main.ts`.

## Repo map (the layout changes during `REFACTOR_PLAN.md`; its "Target layout" is the end state)
- `src/model/` — pure domain logic. MUST NOT import `obsidian`. Most tests live here.
  - `reminder.ts` (Reminder, Reminders), `time.ts` (DateTime, Time), `content.ts`
  - `format/` markdown reminder parsers · `ntfy/` push-notification planning
  - `tasknotes/` TaskNotes frontmatter -> reminders (`index.ts`, `state.ts`, `completion.ts`, `settings-import.ts`)
- `src/plugin/` — Obsidian glue: file watching, notifications, commands, `settings/`, `tasknotes.ts`, `ntfy.ts`, `ui/` (modals, views)
- `src/ui/` — Svelte components
- `src/i18n/` — en / ja / zh-cn. UI text uses `t("...")`; settings-tab names are plain English.
- `docs/` — VuePress site. `.claude/` belongs to another tool: never edit it.
- More detail: `CLAUDE.md` (architecture, notes).

## Commands (repo root; PowerShell is fine)
- Type-check: `npx tsc --noEmit`
- Tests: `npm test` — one file: `npx jest src/model/tasknotes/index.test.ts`
- Lint (eslint + tsc + svelte-check): `npm run lint`
- Build: `npm run build`

## Code rules
- 2-space indent, semicolons, double quotes (prettier), LF line endings, trailing newline.
- Imports are src-rooted (`model/reminder`), not `../../`. Type-only imports use `import type`.
- Strict TypeScript: array/Map access may be `undefined`; use `override` on overridden methods.
- Never call `moment.locale()`. Import moment from `model/moment`, never from `"moment"`.
- Comments and commit messages in English. Tests sit beside the source as `*.test.ts`.
- No new dependencies. Svelte files keep `<script lang="typescript">`.
- File names are kebab-case; a file's main export is named after it; one concern per file; folders are by feature.
- Setting keys (`.key("...")` in `src/plugin/settings/`) are saved in users' `data.json`: never rename or reorder them. `settings-layout.test.ts` guards this.

## Refactoring rules (whenever asked to split, move, rename, restructure or tidy)
1. Behaviour-preserving only: no logic changes, no "improvements", no renamed exports unless the task says so.
2. One task = one concern, at most 5 files. State which files you will create/change BEFORE editing.
3. When moving code: cut and paste verbatim (never retype or clean up) and update every importer directly. No re-export shims unless the task says so. Prefer VS Code's own refactors (Move to a new file, drag a file in Explorer, F2 rename) over rewriting code by hand.
4. New modules must not import from the file they were extracted from (avoid import cycles).
5. Never change a test's expectations to make it pass. The only allowed test edit is an import path.
6. Do not touch: `package*.json`, `manifest*.json`, `versions.json`, `main.js`, `data.json`, `.claude/`, `.github/workflows/`, `docs/` — unless the task names them.
7. After every task run `npx tsc --noEmit` and `npm test`. If either fails and two fix attempts do not work, run `git restore .` and report why.
8. Keep new files under ~300 lines. Give each new file a 2-4 line purpose comment at the top.
9. If something is unclear, stop and ask ONE question instead of guessing.

## End every refactor reply with this block
Files created: … | Files changed: … | Symbols moved: … | tsc: pass/fail | tests: pass/fail | Manual Obsidian check needed: yes/no (yes if anything under `src/plugin/` or `src/ui/` changed)
