#!/usr/bin/env node
// Evaluate JavaScript inside a running Obsidian window over the Chrome DevTools
// Protocol (CDP), for exactly one, explicitly named and explicitly opted-in vault.
//
// Safety model (do not weaken — see "the wrong-vault write incident" in SKILL.md for why
// each layer exists):
//   1. The vault to target must be given via OBSIDIAN_TEST_VAULT_NAME AND
//      OBSIDIAN_TEST_VAULT_PATH. There are no hardcoded defaults — either being
//      unset is a hard error, so an accidental invocation does nothing rather
//      than hitting the wrong vault. The two must agree: basename(realpath(PATH))
//      must equal NAME.
//   2. Marker file, checked from the filesystem side: OBSIDIAN_TEST_VAULT_PATH
//      must contain .obsidian/obsidian-e2e-allowed. This is the real safety
//      boundary. Matching a vault by *name* is not enough — a name is just a
//      string anyone can type into an env var, correctly or by mistake, and
//      would otherwise happily resolve to someone's real vault. The marker file
//      is an explicit, physical, per-vault opt-in that has to be placed by a
//      human who understands "scripts under this skill will rewrite whatever is
//      in this vault."
//   3. Among the CDP page targets, the pages belonging to <VAULT_NAME> are
//      selected by title (see lib/vault-window.mjs), and exactly one of them
//      must survive the --window filter. Zero matches or more than one match
//      both abort the run.
//
//      One vault can legitimately own several windows: Obsidian 1.13+ opens
//      Settings in its own window, and notes can be popped out. Rather than
//      refusing outright whenever there is more than one (which is what this
//      script used to do, and which made anything involving the settings tab
//      untestable), the candidates are classified with a fixed, read-only DOM
//      probe and --window picks the one you meant. The probe runs through the
//      same guard as user code, so a page that isn't the expected vault still
//      never executes anything.
//   4. The code that actually runs in the page is wrapped so its first actions
//      are to re-read app.vault.getName() from inside the page and compare it
//      again to VAULT_NAME, AND re-check the marker file via
//      app.vault.adapter.exists(".obsidian/obsidian-e2e-allowed") from inside
//      the page itself. User code only executes if both hold. This guards
//      against the CDP target list being stale (e.g. a vault was swapped into
//      an existing window) between step 3 and the call actually landing, and
//      against the marker file having been removed/renamed between step 2 and
//      now.
//
// Only Node's built-in fetch/WebSocket/fs are used (Node >= 22), so this works
// even in a worktree that has no node_modules yet.
//
// Usage:
//   node obsidian-eval.mjs '<javascript>'
//   node obsidian-eval.mjs --file path/to/script.js
//   node obsidian-eval.mjs --window any '<javascript>'
//
// The JavaScript is treated as the body of an async function: `return <value>;`
// sends a value back, and `await` works. The result is printed to stdout as JSON
// (or bare text for a plain string result). Exceptions go to stderr with a
// non-zero exit code.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import {
  MARKER_RELATIVE_PATH,
  WINDOW_KIND_PROBE,
  allPageTitles,
  evaluateInPage,
  fetchTargets,
  guardExpression,
  vaultPages,
} from "./lib/vault-window.mjs";

// "settings" is deliberately absent: Obsidian 1.13+ opens settings in a window
// whose JS context has no `app`, so the vault guard can never pass there and
// nothing may be evaluated in it. Screenshot it instead (obsidian-shot.sh
// --title-contains).
const WINDOW_KINDS = ["main", "any"];

function usageError(message) {
  console.error(`error: ${message}`);
  console.error("");
  console.error("usage:");
  console.error("  node obsidian-eval.mjs '<javascript>'");
  console.error("  node obsidian-eval.mjs --file path/to/script.js");
  console.error("  node obsidian-eval.mjs --window <main|any> '<javascript>'");
  console.error("");
  console.error("required env: OBSIDIAN_TEST_VAULT_NAME, OBSIDIAN_TEST_VAULT_PATH");
  console.error("optional env: OBSIDIAN_CDP_PORT (default 9333)");
  process.exit(2);
}

function parseArgs(argv) {
  let windowKind = "main";
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--window") {
      windowKind = argv[++i];
      if (!WINDOW_KINDS.includes(windowKind)) {
        usageError(`--window must be one of ${WINDOW_KINDS.join(", ")}`);
      }
      continue;
    }
    rest.push(argv[i]);
  }
  if (rest.length === 0) {
    usageError("missing JavaScript to evaluate");
  }
  if (rest[0] === "-h" || rest[0] === "--help") {
    usageError("help requested");
  }
  if (rest[0] === "--file") {
    if (!rest[1]) {
      usageError("--file requires a path argument");
    }
    return { code: readFileSync(rest[1], "utf8"), windowKind };
  }
  return { code: rest[0], windowKind };
}

/**
 * Narrows several windows of the same vault down to the one the caller means.
 * Only reached when the title match alone is ambiguous, so the common
 * single-window case costs no extra CDP round trips.
 *
 * A page that fails the probe is recorded as unusable rather than treated as a
 * candidate: the probe runs behind the vault/marker guard, so failing it means
 * the page could not prove which vault it belongs to, and running anything
 * there is exactly what the guard exists to prevent.
 */
async function classifyPages(pages, vault) {
  const probe = guardExpression(WINDOW_KIND_PROBE, vault);
  const classified = [];
  for (const page of pages) {
    try {
      const info = await evaluateInPage(page.webSocketDebuggerUrl, probe, 10_000);
      classified.push({ page, kind: info.kind, title: page.title });
    } catch (e) {
      classified.push({
        page,
        kind: "unusable",
        title: page.title,
        reason: e.message.split("\n")[0],
      });
    }
  }
  return classified;
}

async function main() {
  const vault = process.env.OBSIDIAN_TEST_VAULT_NAME;
  const vaultPath = process.env.OBSIDIAN_TEST_VAULT_PATH;
  if (!vault || !vaultPath) {
    usageError(
      "OBSIDIAN_TEST_VAULT_NAME and OBSIDIAN_TEST_VAULT_PATH are both required " +
        "(no defaults — this is intentional: an unset vault must never silently " +
        "fall back to some vault).",
    );
  }
  const port = process.env.OBSIDIAN_CDP_PORT || "9333";
  const { code, windowKind } = parseArgs(process.argv.slice(2));

  // --- Safety guard 1: path and name must agree ------------------------------
  let realVaultPath;
  try {
    realVaultPath = realpathSync(vaultPath);
  } catch (e) {
    console.error(`error: OBSIDIAN_TEST_VAULT_PATH does not resolve: ${e.message}`);
    process.exit(3);
  }
  if (basename(realVaultPath) !== vault) {
    console.error(
      `refusing to run: basename(OBSIDIAN_TEST_VAULT_PATH) is ${JSON.stringify(
        basename(realVaultPath),
      )}, which does not match OBSIDIAN_TEST_VAULT_NAME ${JSON.stringify(vault)}.`,
    );
    process.exit(3);
  }

  // --- Safety guard 2: marker file, checked from the filesystem side --------
  const markerPath = join(realVaultPath, MARKER_RELATIVE_PATH);
  if (!existsSync(markerPath)) {
    console.error(
      `refusing to run: no marker file at ${markerPath}. ` +
        "A vault is only usable by obsidian-e2e scripts if it explicitly opts in " +
        `by containing ${MARKER_RELATIVE_PATH} (see SKILL.md). Matching by vault ` +
        "name alone is not treated as consent.",
    );
    process.exit(3);
  }

  // --- Safety guard 3: exactly one matching CDP page target ------------------
  let targets;
  try {
    targets = await fetchTargets(port);
  } catch (e) {
    console.error(
      `error: could not reach CDP endpoint at http://127.0.0.1:${port}/json/list (${e.message}). ` +
        "Is Obsidian running with --remote-debugging-port? See obsidian-launch.sh.",
    );
    process.exit(4);
  }

  const pages = vaultPages(targets, vault);

  function abortWithPageList(reason) {
    console.error(`refusing to run: ${reason}`);
    const titles = allPageTitles(targets);
    if (titles.length === 0) {
      console.error("  (no page targets at all)");
    } else {
      console.error("  page titles seen:");
      for (const title of titles) {
        console.error(`    - ${title}`);
      }
    }
    process.exit(3);
  }

  if (pages.length === 0) {
    abortWithPageList(
      `found no page target belonging to vault ${JSON.stringify(vault)}. ` +
        "Is that vault open? obsidian-launch.sh opens it for you.",
    );
  }

  let target = pages[0];
  if (pages.length > 1) {
    const classified = await classifyPages(pages, vault);
    const usable = classified.filter((c) => c.kind !== "unusable");
    const wanted = windowKind === "main" ? usable.filter((c) => c.kind === "main") : usable;
    if (wanted.length !== 1) {
      console.error(
        `refusing to run: vault ${JSON.stringify(vault)} has ${pages.length} windows open, ` +
          `and ${wanted.length} of them match --window ${windowKind} (expected exactly 1).`,
      );
      for (const c of classified) {
        console.error(`    - ${c.title} => ${c.kind}${c.reason ? ` (${c.reason})` : ""}`);
      }
      process.exit(3);
    }
    target = wanted[0].page;
  }

  // --- Safety guard 4: re-check vault name AND marker file from inside the page
  const value = await evaluateInPage(target.webSocketDebuggerUrl, guardExpression(code, vault));

  if (value === undefined) {
    console.log("(undefined)");
  } else if (typeof value === "string") {
    console.log(value);
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
