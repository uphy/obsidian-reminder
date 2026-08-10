---
name: obsidian-e2e
description: Drive a real, running Obsidian instance over the Chrome DevTools Protocol (CDP) to automatically test obsidian-reminder — evaluate JS inside the app, fire reminders on demand, and screenshot the window. Use this when the user wants automated end-to-end checks against a live Obsidian ("自動でテストして", "CDPで確認して", "obsidian-e2eで", "reminderを自動で発火させて確認して"), as opposed to manual-verify, which prepares a vault for a human to click through. Runs exclusively against the user's dedicated test vault — never against their personal or work vaults.
---

# obsidian-e2e: automated testing against a live Obsidian

## Relationship to `manual-verify`

`manual-verify` prepares a test vault (symlink, settings, fixture notes) and then
hands the user a checklist to click through by hand. This skill instead drives that
same running Obsidian over CDP so an agent can fire reminders, click UI, and read
back internal state without a human in the loop.

They are complementary, not interchangeable:

- Things this skill **can** verify automatically: reminder firing timing, toast
  contents, button clicks and their effect on the file, settings state,
  `Reminders`/`ReminderNotifier` internal state.
- Things only a **human** can verify (see "What cannot be automated" below): the
  look and feel of macOS system notifications, whether a system notification click
  actually does the right thing, and anything that depends on the user's macOS
  notification style settings (Banners vs. Alerts, etc).

For anything touching `src/plugin/` or `src/ui/`, prefer running both: this skill
for the parts it can check unattended, `manual-verify` for the rest.

## The absolute safety requirement

**This machine typically has several vaults registered and multiple open at once.
Only a vault explicitly and physically marked as safe for testing (see "The
actual guard" below) may ever be touched. Every other vault — personal or work —
must never be written to, and, per the incident below, not even read.**

### The wrong-vault write incident (read this before changing any guard)

Earlier in this skill's development, a guard was verified by actually calling
`app.vault.adapter.write(...)` with `OBSIDIAN_TEST_VAULT_NAME` pointed at a real,
non-test vault, on the reasoning that "the guard should reject this." **It did
not.** The guard at the time only checked that the vault *name* in the CDP page
title was unambiguous and matched what the in-page code re-read from
`app.vault.getName()` — and a real vault's actual name is, by definition, a
perfectly real, unambiguous, matching vault name. The write silently succeeded,
creating a stray file in a real personal vault, which then had to be cleaned up.

Two lessons are now load-bearing parts of the design, not just advice:

1. **Matching a vault by name is not a safety guard — it is a routing
   mechanism.** A name is just a string; anyone (human or agent) can type the name
   of a real vault into an env var, on purpose or by typo, and a name-matching
   guard will happily "correctly" route to it. Name/title matching (the
   `" - <VAULT_NAME> - "` checks below) exists to prevent *ambiguity* (which window
   is it?) and *staleness* (did the window change vaults?) — it does not and
   cannot express *consent* ("is this vault okay to test against?").
2. **Verifying that a guard rejects something must never use a destructive
   operation to prove the point.** A non-zero exit code and a stderr message are
   sufficient proof of rejection. If you need to convince yourself a guard works,
   test it with a read-only expression (`return 1;`, `return app.vault.getName();`)
   or — better, so that no real vault is touched at all, not even for a read — a
   synthetic directory of your own that mimics a vault's `.obsidian/` layout.
   Never call `write`/`delete`/`rename`/`process` against a vault you don't
   already know is the test vault.

### The actual guard: an opt-in marker file, not a name

Because name matching cannot express consent, the real permission boundary is a
marker file: **`<vault>/.obsidian/obsidian-e2e-allowed`**. A vault is only usable
by these scripts if this file physically exists inside it. The dedicated test
vault has one (see its contents for the rationale, copied below); no other vault
may ever have one added.

```
This file marks this vault as safe for the obsidian-reminder repository's
obsidian-e2e skill (.claude/skills/obsidian-e2e/). Its scripts write to and
otherwise operate on any vault that has this marker, without asking again.

Do NOT copy this file into another vault (any other personal or work vault).
A vault with this file present WILL be rewritten by automated tests — files
created, task lines edited, reminders fired.

If this file is missing, the obsidian-e2e scripts refuse to run against the
vault, even if OBSIDIAN_TEST_VAULT_NAME/OBSIDIAN_TEST_VAULT_PATH happen to
point at it. This is the actual safety boundary — matching a vault by name
alone is not enough, since a name can be typed (or mistyped) into an env var
by anyone.
```

**Never copy this marker file into another vault**, and never add logic that
creates it automatically for a vault the user hasn't explicitly prepared.

### The full guard stack, per script

Every script that can affect a vault (`obsidian-eval.mjs`, `reminder-fire.sh`)
implements all of the following, independently (filesystem-side and, where
applicable, page-side — see below for why both):

1. **Required env vars, no hardcoded defaults.** `OBSIDIAN_TEST_VAULT_NAME` and
   `OBSIDIAN_TEST_VAULT_PATH` must both be set, or the script exits immediately
   with a usage error. An accidentally-run script with no environment configured
   must do nothing.
2. **Name/path agreement.** `basename(realpath(OBSIDIAN_TEST_VAULT_PATH))` must
   equal `OBSIDIAN_TEST_VAULT_NAME`. This catches copy-paste mistakes where the two
   env vars disagree about which vault is meant.
3. **Marker file check, from the filesystem side.**
   `OBSIDIAN_TEST_VAULT_PATH/.obsidian/obsidian-e2e-allowed` must exist. This is
   checked with plain `fs`/`test -f`, before any CDP call is made — an unmarked
   vault is rejected before the script even talks to Obsidian.
4. **CDP target selection.** Among the CDP page targets, the pages whose titles
   belong to `<VAULT_NAME>` are collected (two title shapes — see "Known
   limitations"), and exactly one must survive. Zero aborts the run. More than
   one is legitimate (settings window, popped-out notes), so the candidates are
   classified by a fixed, read-only DOM probe that runs behind the very same
   guard as user code, and `--window` picks one; if that still doesn't leave
   exactly one, the run aborts. A candidate that fails the probe is never used —
   failing it means the page could not prove which vault it belongs to.
5. **Re-check from inside the page.** The JS actually evaluated in the page is
   wrapped so that, before any of your code runs, it re-reads
   `app.vault.getName()` **and** re-checks
   `await app.vault.adapter.exists(".obsidian/obsidian-e2e-allowed")` from inside
   Obsidian's own JS context. Both must hold. This exists because steps 2–4 above
   run in a separate `node`/`bash` process against a point-in-time snapshot (the
   CDP target list, the filesystem); the vault shown in a given window could in
   principle change between that snapshot and the code actually executing.

`obsidian-wait.sh` is a polling loop around `obsidian-eval.mjs`, so it inherits
every guard above rather than implementing its own.

`obsidian-shot.sh` is the one exception: it never writes into a vault (it only
reads the on-screen window list and writes a screenshot file wherever you tell it
to), so it does not check the marker file — but it still requires
`OBSIDIAN_TEST_VAULT_NAME` and still narrows to exactly one window, cross-checked
against both the OS window list and the CDP page list independently.

`obsidian-launch.sh` mostly doesn't touch any vault (it starts/stops the Obsidian
process and polls the CDP HTTP endpoint). The one part that does is opening the
test vault when it has no window, since that names a specific vault and makes
Obsidian write its `.obsidian/workspace.json` — so that step runs guards 1–3
above before it opens anything. Everything else in the script runs without a
vault configured at all.

## Environment-specific configuration

Exactly as in `manual-verify`: never hardcode vault paths or names in scripts,
skill docs, or committed files. Read them from `CLAUDE.local.md` at the repository
root (auto-loaded into context, gitignored). Expected entries: test vault path
(`OBSIDIAN_TEST_VAULT_PATH`), and its `basename` doubles as
`OBSIDIAN_TEST_VAULT_NAME`, plus the plugin symlink location (same entries
`manual-verify` uses). If `CLAUDE.local.md` is missing this, ask the user and
offer to record it.

## Scripts

All scripts live in `scripts/` and use only Node's built-ins (`fetch`,
`WebSocket`, `fs`) plus macOS system tools (`osascript`, `screencapture`, `python3`
+ PyObjC's `Quartz`) — no `npm install` required, so they work in a worktree
before dependencies have ever been installed.

`scripts/lib/` holds the pieces more than one script needs: `vault-window.mjs`
(which CDP page belongs to which vault, the guard wrapper, the CDP evaluate
call) and `cdp-pages.mjs`, a tiny CLI over the page list so the bash scripts
don't each carry their own copy of the title rule.

### `obsidian-launch.sh [--restart] [--no-open-vault]`

Ensures Obsidian is running with `--remote-debugging-port=$OBSIDIAN_CDP_PORT`
(default port `9333` — `9222` is often already taken by a running Chrome). If CDP
is already reachable and belongs to Obsidian, it's a no-op (prints the open page
titles and exits). Otherwise it quits any running Obsidian instance (Electron apps
can't have `--remote-debugging-port` turned on after the fact) and relaunches it
with the flag, then polls until CDP responds.

Starting the app is not vault-specific — it affects every open vault's window
(all vaults reopen, no data loss, but any unsaved modal/dialog state in another
vault's window is lost). It only actually restarts when required; running it
opportunistically before other scripts is safe and usually a no-op.

**It also makes sure the test vault has a window.** Obsidian only reopens the
vaults that were open when it was last quit, and the test vault frequently isn't
one of them — which used to leave every other script failing with "found no page
target" and nothing explaining why. When `OBSIDIAN_TEST_VAULT_NAME` is set, this
script waits ~8s for that vault's window to appear on its own and, if it doesn't,
opens the vault via `obsidian://open?vault=<name>` and waits for it. Opening a
vault by name is vault-specific, so that step runs the same filesystem-side
guards as the other scripts (name/path agreement plus the marker file) before it
names anything — opening a vault makes Obsidian write its own
`.obsidian/workspace.json`, which is the kind of write the marker authorizes.
Pass `--no-open-vault` to suppress this.

### `obsidian-wait.sh [--timeout SEC] [--min-reminders N]`

```
.claude/skills/obsidian-e2e/scripts/obsidian-wait.sh --min-reminders 3
# => { "ready": true, "reminders": 13, "overdue": 0 }
```

Blocks until the plugin in the test vault's window is actually ready: the window
answers CDP, `app.plugins.plugins["obsidian-reminder-plugin"]` exists, and its
initial full-vault scan has finished (`data.scanned.value === true`). Use this
instead of `sleep 20` after a launch or restart — it typically returns in well
under a second, and it can't return too early the way a fixed sleep can.

`--min-reminders N` additionally waits for, and then asserts, a parsed reminder
count. Always pass it: a settings mismatch makes fixtures parse to *zero*
reminders with no error anywhere (see "Fixtures depend on settings" below), and
without this assertion that failure shows up much later as a confusing "the
reminder never fired."

### `obsidian-eval.mjs`

```
# OBSIDIAN_TEST_VAULT_NAME / OBSIDIAN_TEST_VAULT_PATH come from CLAUDE.local.md —
# export them once per shell session before using any of these scripts.
export OBSIDIAN_TEST_VAULT_NAME=<test vault name>
export OBSIDIAN_TEST_VAULT_PATH=<test vault path>

node .claude/skills/obsidian-e2e/scripts/obsidian-eval.mjs 'return app.vault.getName();'

# or, for longer scripts:
node .claude/skills/obsidian-e2e/scripts/obsidian-eval.mjs --file /path/to/script.js
```

Evaluates JavaScript inside the matched Obsidian window as the body of an async
function (`return`/`await` both work). Prints the result as JSON to stdout;
exceptions go to stderr with a non-zero exit.

**When the vault has several windows** (a popped-out note, or the separate
window Obsidian 1.13+ uses for settings), the candidates are classified with a
fixed read-only DOM probe and `--window` picks one: `main` (default) is the
window with the ribbon and the root split, `any` accepts whichever single window
can be driven. There is deliberately no `--window settings`: **the settings
window's JS context has no `app` global**, so it can't prove which vault it
belongs to, the safety guard can never pass there, and nothing may be evaluated
in it. To see the settings screen, screenshot it (`obsidian-shot.sh
--title-contains`).

Because production builds don't mangle property names (esbuild only does that with
an explicit `mangleProps`, which this project's `esbuild.config.mjs` doesn't set),
internal plugin state is directly reachable. Confirmed working as of this writing:

- `app.plugins.plugins["obsidian-reminder-plugin"]` → `_reminders`, `settings`,
  `ui`, etc.
- `.ui.reminderNotifier.toastManager.toasts` → `Map` of currently-shown toasts,
  keyed by `<file><title><time>`.
- `.ui.reminderNotifier.systemNotifier.systemNotifications` → `Map` of tracked
  system notifications. **This is how you detect that a system notification fired
  even though you can't click it** (see "What cannot be automated").
- `.ui.reminderNotifier.systemNotifier.isAvailable()` → whether system
  notifications are usable on this platform.

**This is refactor-fragile.** These paths reflect the `ReminderNotifier`/
`SystemNotifier` split (PR #353). If a future refactor moves things around, this
code will throw `TypeError: Cannot read properties of undefined`. When that
happens, don't guess — run
`node obsidian-eval.mjs 'return Object.keys(app.plugins.plugins["obsidian-reminder-plugin"]);'`
(and drill in from there) to rediscover the actual structure, and update this file.

### `reminder-fire.sh <note-path-relative-to-vault> <text-unique-to-the-line> [minutesAgo]`

```
# (OBSIDIAN_TEST_VAULT_NAME / OBSIDIAN_TEST_VAULT_PATH already exported — see above)
.claude/skills/obsidian-e2e/scripts/reminder-fire.sh \
  reminder-test/e2e-skill/smoke.md e2e-skill-smoke-task1 5
```

Rewrites the first `YYYY-MM-DD` or `YYYY-MM-DD HH:mm` date pattern on the first
line containing the given text to `minutesAgo` minutes before now (default 2). A
reminder past its time fires within about 5 seconds — there's no need to wait the
"real" 3 minutes a fresh reminder would take. Because firing also clears mute
state, the same fixture line can be re-fired indefinitely by calling this again
(it'll pick a new, slightly different past timestamp each time).

This edits the file directly via the filesystem (not through CDP/`app.vault`), so
it carries its own copy of the filesystem-side guards (env vars, name/path
agreement, marker file) plus a `realpath`-based check that the target note
resolves inside the vault root — this is what blocks `../`-style escapes or a
symlink pointing outside the vault. Obsidian must already be running and watching
the vault for the external file change to be picked up.

### `obsidian-shot.sh [--title-contains TEXT] <output-path.png>`

```
# (OBSIDIAN_TEST_VAULT_NAME already exported — see above)
.claude/skills/obsidian-e2e/scripts/obsidian-shot.sh /path/to/scratchpad/shot.png

# when the vault has several windows open, narrow by an extra title substring
# (the settings window's title starts with the localized name of that screen):
.claude/skills/obsidian-e2e/scripts/obsidian-shot.sh --title-contains '設定' /path/to/settings.png
```

Screenshots the on-screen Obsidian window belonging to the named vault.
**Do not use `screencapture -R x,y,w,h`** — on Retina/multi-display setups its
coordinate system doesn't match what window enumeration reports, and you silently
get a blank, narrow sliver image instead of an error. **Do not try to use the
Accessibility (AX) tree either** (`osascript`/System Events element enumeration) —
even with `AXManualAccessibility` set, enumerating elements has been unreliable and
prone to timing out in testing; drive the UI through CDP/DOM instead (see
`obsidian-eval.mjs`), and use this script only for pixel screenshots.

Window discovery goes through Quartz's `CGWindowListCopyWindowInfo` (via
`python3` + PyObjC), matching `kCGWindowOwnerName == "Obsidian"` and a
`kCGWindowName` that belongs to the vault (same two title shapes as the CDP
side — see "Known limitations"), then `screencapture -x -o -l <windowID>`. Write
the output somewhere outside any vault (the session scratchpad is the right
place) — this script does not stop you from pointing the output path inside a
vault, so don't.

Exactly one window must survive the filter. If the vault has more than one open,
narrow it with `--title-contains`; the error message lists the titles it saw.
The cross-check against the CDP page list still runs, and now requires the two
sources to agree on *how many* windows the vault has, rather than requiring that
number to be one.

This is the only way to inspect the settings screen, since CDP can't evaluate
anything in that window (no `app` global — see `obsidian-eval.mjs` above).

## What cannot be automated

Be upfront about these with the user rather than trying to fake a check:

- **Clicking macOS system notifications.** They're rendered by Electron's
  `Notification` API, which lives outside the DOM entirely — CDP cannot see or
  click them. You *can* detect that one was raised (see
  `systemNotifier.systemNotifications` above), but not interact with it.
- **How a system notification actually looks**, including anything that depends
  on the user's System Settings → Notifications style (Banners vs. Alerts,
  grouping, etc). This has to be eyeballed by a human.
- **Subjective UI/UX judgment** — animation smoothness, whether a layout "looks
  right." This skill can assert DOM state and pixel-diff screenshots at best; it
  can't judge aesthetics.
- **Clicking anything in the settings window.** Its JS context has no `app`, so
  the vault guard can't pass and nothing may be evaluated there. You can
  screenshot it, and you can read and write every setting's value from the main
  window via `plugin.settings.<key>.rawValue.value` — what you can't do is drive
  the actual toggles and text fields.

For these, hand off to `manual-verify`.

## Fixtures depend on settings

The plugin's `data.json` does not live in the vault. It lives in the plugin
directory, which is a symlink to a repository checkout — so **swapping the
symlink swaps the settings too**, and a fresh worktree that has never been used
starts with no `data.json` at all, i.e. every setting at its default.

That matters because reminder syntax is only recognized when the matching format
is enabled. The `⏰ YYYY-MM-DD HH:mm` fixtures under `reminder-test/` need both
`enableTasksPluginReminderFormat` and `useCustomEmojiForTasksPlugin` on, and
neither is on by default. With defaults, every fixture parses to **zero
reminders, with no error anywhere** — nothing fires, and it looks like the
feature under test is broken.

So set the baseline explicitly at the start of a run and assert it took effect:

```
# one-time per checkout, from the main window
node .../obsidian-eval.mjs '
  const p = app.plugins.plugins["obsidian-reminder-plugin"];
  p.settings.settings.forEach(s => {
    if (s.key === "enableTasksPluginReminderFormat") s.rawValue.value = true;
  });
  p.settings.useCustomEmojiForTasksPlugin.rawValue.value = true;
  await p.fileSystem.reloadRemindersInAllFiles();
  await p.data.save(true);
  return p._reminders.reminders.length;'

.../obsidian-wait.sh --min-reminders 3   # fails loudly if the fixtures did not parse
```

Note `p.settings.settings.forEach` for the format toggles: the per-format
settings aren't exposed as named fields on `Settings`, only through the
collection.

## Testing startup / restart behavior

Anything about what happens *when Obsidian starts* (mute state surviving a
restart, do-not-disturb resuming, the initial scan) needs state on disk before
the restart, and the plugin only writes `data.json` when it considers itself
changed. Force it rather than hoping a periodic save lands:

```
# 1. get into the state you want to persist (fire, mute, run a command, ...)
# 2. force a save and confirm it hit the disk
node .../obsidian-eval.mjs 'await app.plugins.plugins["obsidian-reminder-plugin"].data.save(true); return "saved";'
grep -o '"muted":[a-z]*' <checkout>/data.json

# 3. restart, wait properly, then assert
.../obsidian-launch.sh --restart
.../obsidian-wait.sh --min-reminders 3
node .../obsidian-eval.mjs '
  const p = app.plugins.plugins["obsidian-reminder-plugin"];
  return { toasts: [...p.ui.reminderNotifier.toastManager.toasts.keys()] };'
```

Reading `data.json` back between steps 2 and 3 is worth the extra line: it
separates "the plugin never persisted it" from "the plugin persisted it and
discarded it on load," which are the two failure modes that look identical from
the UI.

## Typical workflow

1. **Build** the checkout under test:
   `mise exec -- npm run build` (in a worktree with no `node_modules` yet, run
   `mise exec -- npm install` first — **not** `mise run main:init`, whose shell
   picks up a different npm and rewrites `package-lock.json`).
2. **Point the vault's plugin symlink** at that checkout (same gotcha as
   `manual-verify`: this is disruptive to whoever else might be using the
   symlink, and Obsidian must not be actively writing `data.json` while you swap
   it — quit Obsidian first if you're also touching settings).
3. **Ensure Obsidian is up with CDP and the test vault is open**:
   `obsidian-launch.sh`.
4. **Wait for readiness and check the fixtures parsed**:
   `obsidian-wait.sh --min-reminders <N>`.
5. **Fire** the reminder(s) you need: `reminder-fire.sh`.
6. **Operate/verify** via `obsidian-eval.mjs` (click buttons, read state) and/or
   `obsidian-shot.sh` (visual capture for the user to glance at, or for
   comparison).
7. **Clean up** (see below).

## A concrete, actually-run verification example

This exact sequence was run against the dedicated test vault while building this
skill, using the fixture at `reminder-test/e2e-skill/smoke.md`
(`- [ ] e2e-skill-smoke-task1 ⏰ 2026-08-01 10:00`):

```
$ reminder-fire.sh reminder-test/e2e-skill/smoke.md e2e-skill-smoke-task1 5
2026-08-02 20:23
```

After a few seconds, confirm the toast actually appeared (reading internal state,
not guessing):

```js
// via obsidian-eval.mjs
const plugin = app.plugins.plugins["obsidian-reminder-plugin"];
const toasts = [...plugin.ui.reminderNotifier.toastManager.toasts.keys()];
return { toastKeys: toasts.filter(k => k.includes("e2e-skill-smoke-task1")) };
// => { toastKeys: ["reminder-test/e2e-skill/smoke.mde2e-skill-smoke-task12026-08-02 20:23"] }
```

Then click "Done" on that toast's card and confirm the file changed:

```js
// via obsidian-eval.mjs
const card = [...document.querySelectorAll(".reminder-toast-card")]
  .find(c => c.querySelector(".reminder-title")?.textContent === "e2e-skill-smoke-task1");
const btn = [...card.querySelectorAll("button")].find(b => b.textContent.trim() === "Done");
btn.click();
```

The file went from `- [ ] e2e-skill-smoke-task1 ⏰ 2026-08-01 10:00` to
`- [x] e2e-skill-smoke-task1 ⏰ 2026-08-02 20:23 ✅ 2026-08-02` — verified by reading
the file back, not by assuming the click worked.

The toast DOM shape used above: `.reminder-toast-card` is one toast; inside it,
`.reminder-title`, `.reminder-file`, `button` (`×` / the note name / `Done` /
`Mute`), and `select.later-select` for the Snooze options.

## Cleanup

- Restore the vault's plugin symlink to wherever it should point when you're done
  (main checkout, typically — rebuild it first so the vault serves the merged
  code).
- If you ran `obsidian-launch.sh --restart` or it had to relaunch Obsidian, that's
  already back to normal (it launches with the same `--remote-debugging-port` — if
  you want CDP off again for normal use, quit and relaunch Obsidian without the
  flag).
- Test fixtures under `<vault>/reminder-test/` can stay for next time, same as
  `manual-verify`.
- Never remove the `.obsidian/obsidian-e2e-allowed` marker from the test vault as
  part of routine cleanup — it's meant to persist.

## Known limitations

- **A vault's window is recognized by two title shapes**, because Obsidian uses
  both: `"<note> - <vault> - Obsidian <version>"` once a note is open, and
  `"<vault> - Obsidian <version>"` while none is. Matching only the first (which
  this skill originally did) loses the window during the first seconds after a
  launch — exactly when a script is polling for it. The rule lives in one place,
  `scripts/lib/vault-window.mjs`, with a deliberate second copy in Python inside
  `obsidian-shot.sh`, which can't import it.
- **Neither title shape is airtight.** If the *active note's own title* happens
  to contain a hyphen-padded segment that matches another vault's name (e.g. a
  note titled `"Report - otherVault - Draft"` open inside the test vault), a
  script targeting `otherVault` could match the wrong window. This is why the
  marker-file check is the real guard and the title match is only used for
  disambiguating *which already-approved vault's window* to talk to — never treat
  title matching alone as sufficient permission.
- **The settings window can't be driven, only photographed** — no `app` global,
  so the guard can't pass. See `obsidian-eval.mjs` and `obsidian-shot.sh` above.
- **Internal state access (`ui.reminderNotifier`, etc.) is refactor-fragile** by
  nature — see the note under `obsidian-eval.mjs` above.
- **Marker-file existence is checked at two different times** (filesystem-side
  before any CDP call, and page-side inside the guarded expression) but there is
  necessarily a small window between them where the marker could theoretically be
  removed. This is an accepted, understood gap (same class of TOCTOU issue any
  filesystem-then-network guard has) — not something to "fix" by adding more
  checks; understand the two-phase check as strong-but-not-atomic.
