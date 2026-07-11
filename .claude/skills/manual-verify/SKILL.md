---
name: manual-verify
description: Set up the local test vault and guide the user through manual verification of obsidian-reminder changes. Use this whenever a change should be verified in a real Obsidian vault — after implementing a fix or feature, when preparing a PR for review, or when the user says things like "動作確認して", "動作確認を手伝って", "テスト環境を整えて", "vaultで確認したい", or asks how to check that a change actually works. It prepares the vault (plugin symlink, plugin settings, companion plugins, generated test notes with per-fix instructions) and then hands the user a short checklist to execute in Obsidian.
---

# Manual verification in a test vault

Automated tests only cover `src/model/`; anything touching the Obsidian API must be
verified by a human in a running Obsidian. This skill prepares everything so that the
user only has to launch Obsidian and walk through generated test notes.

## Environment-specific configuration

Never hardcode vault paths, plugin directory names, or other machine-specific details
in this skill, in test notes' front matter, or in any committed file. Read them from
`CLAUDE.local.md` at the repository root (auto-loaded into context, gitignored).
Expected entries: test vault path, plugin symlink location, installed companion
plugins. If `CLAUDE.local.md` is missing or lacks the vault path, ask the user where
their test vault is and offer to record it in `CLAUDE.local.md` for next time.

## Workflow

### 1. Build the code under verification

Run a production build in the checkout to verify (main repo or a worktree):

```bash
mise exec -- npm run build
```

Confirm the change is actually in the artifact before involving the user, e.g.
`grep -c "<some string unique to the change>" main.js`. The vault loads `main.js`,
`manifest.json`, and `styles.css` from the plugin directory; all three exist at the
checkout root after a build.

### 2. Point the vault at the checkout

```bash
ln -sfn <checkout-path> <vault>/.obsidian/plugins/<plugin-dir>
```

A git worktree works fine as the target: the hot-reload plugin watches any plugin
directory containing `.git`, and a worktree's `.git` file satisfies that.

### 3. Prepare plugin settings (the data.json gotcha)

Because of the symlink, the plugin's `data.json` lives at the checkout root (it is
gitignored). Two rules:

- **Never edit `data.json` while Obsidian is running.** The live plugin periodically
  saves its in-memory state and will silently overwrite your edits. Stage the desired
  file in the session scratchpad, ask the user to quit Obsidian, copy it into place,
  verify the copy, then ask them to relaunch.
- **Set `"scanned": false` and `"reminders": {}`** in the staged file. This forces a
  full vault rescan at startup; otherwise test notes created while Obsidian was
  closed may not be picked up (the plugin has no create-event listener, see #270).

Enable exactly the settings the tests need (e.g. `enableTasksPluginReminderFormat`,
`enableKanbanPluginReminderFormat`, `removeTagsForTasksPlugin`). Keys can be read
from an existing `data.json` or `src/plugin/settings/index.ts`.

### 4. Install companion plugins when the change involves interop

For fixes involving the Tasks/Kanban/etc. plugins, install the real plugin into the
vault (while Obsidian is closed):

```bash
mkdir -p <vault>/.obsidian/plugins/<plugin-id>
cd <vault>/.obsidian/plugins/<plugin-id>
gh release download -R <owner>/<repo> --pattern main.js --pattern manifest.json --pattern styles.css --clobber
```

Then write the companion plugin's `data.json` with the settings the test requires
(e.g. Kanban's `"link-date-to-daily-note": true`), and add its plugin id to
`<vault>/.obsidian/community-plugins.json`.

### 5. Generate test notes

Create one note per fix in a dedicated folder at the vault root (default:
`reminder-test/`), numbered in the order the user should execute them
(`1-<short title> (#<issue>).md`, ...). Write the notes in the user's conversation
language — the user reads them inside Obsidian, so they must be self-contained; the
user should never need to switch back to the chat mid-test.

Template for each note:

```markdown
# テスト<N>: <what is being verified> (#<issue>)

**手順**

1. <concrete step>
2. <concrete step>

**期待結果（修正後）**: <observable outcome>
**修正前の挙動**: <what the bug looked like, so the user can tell a real pass from a no-op>

<fixture lines the steps operate on, e.g. task lines>
```

Fixture rules:

- Use **future dates** (a week or more ahead) so reminders show up in the list
  without immediately firing notification popups during the test session.
- When a fix changes behavior on valid input, add a regression check to the same
  note (e.g. "insertion on a proper task line still works").

### 6. Hand the user a checklist

Post a compact message: quit/relaunch timing if settings were staged, the note order,
and a one-line expected result per note (a table works well). Mention that the first
launch rescans the vault and may take a few seconds. Ask for OK/NG per item, and for
NG ask what was observed.

### 7. After verification

- Offer to record the verification results as a PR comment (English, factual, one
  line per verified fix).
- Offer cleanup: restore the vault symlink to the main repository checkout (rebuild
  master first so the vault serves the merged code), remove the worktree/branch.
  Test notes and companion plugins can stay in the vault for next time — mention it
  and let the user decide.
