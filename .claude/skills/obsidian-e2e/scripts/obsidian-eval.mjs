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
//   3. Among the CDP page targets, exactly one page's title must contain
//      " - <VAULT_NAME> - " (the substring Obsidian puts between the active
//      note's title and "Obsidian <version>" in its window/tab title). Zero
//      matches or more than one match both abort the run.
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
//
// The JavaScript is treated as the body of an async function: `return <value>;`
// sends a value back, and `await` works. The result is printed to stdout as JSON
// (or bare text for a plain string result). Exceptions go to stderr with a
// non-zero exit code.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";

const MARKER_RELATIVE_PATH = ".obsidian/obsidian-e2e-allowed";

function usageError(message) {
  console.error(`error: ${message}`);
  console.error("");
  console.error("usage:");
  console.error("  node obsidian-eval.mjs '<javascript>'");
  console.error("  node obsidian-eval.mjs --file path/to/script.js");
  console.error("");
  console.error("required env: OBSIDIAN_TEST_VAULT_NAME, OBSIDIAN_TEST_VAULT_PATH");
  console.error("optional env: OBSIDIAN_CDP_PORT (default 9333)");
  process.exit(2);
}

function parseArgs(argv) {
  if (argv.length === 0) {
    usageError("missing JavaScript to evaluate");
  }
  if (argv[0] === "--file") {
    const path = argv[1];
    if (!path) {
      usageError("--file requires a path argument");
    }
    return readFileSync(path, "utf8");
  }
  if (argv[0] === "-h" || argv[0] === "--help") {
    usageError("help requested");
  }
  return argv[0];
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
  const code = parseArgs(process.argv.slice(2));

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
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    targets = await res.json();
  } catch (e) {
    console.error(
      `error: could not reach CDP endpoint at http://127.0.0.1:${port}/json/list (${e.message}). ` +
        "Is Obsidian running with --remote-debugging-port? See obsidian-launch.sh.",
    );
    process.exit(4);
  }

  const needle = ` - ${vault} - `;
  const pages = targets.filter(
    (t) => t.type === "page" && typeof t.title === "string" && t.title.includes(needle),
  );

  if (pages.length !== 1) {
    console.error(
      `refusing to run: expected exactly 1 page target whose title contains ${JSON.stringify(
        needle,
      )}, found ${pages.length}.`,
    );
    const allPages = targets.filter((t) => t.type === "page");
    if (allPages.length === 0) {
      console.error("  (no page targets at all)");
    } else {
      console.error("  page titles seen:");
      for (const t of allPages) {
        console.error(`    - ${t.title}`);
      }
    }
    process.exit(3);
  }

  const target = pages[0];

  // --- Safety guard 4: re-check vault name AND marker file from inside the page
  const guardedExpression = `(async () => {
    const __vault = app.vault.getName();
    if (__vault !== ${JSON.stringify(vault)}) {
      throw new Error(
        "obsidian-eval safety guard: expected vault " + ${JSON.stringify(vault)} +
        " but this page reports vault " + __vault
      );
    }
    const __allowed = await app.vault.adapter.exists(${JSON.stringify(MARKER_RELATIVE_PATH)});
    if (!__allowed) {
      throw new Error(
        "obsidian-eval safety guard: marker file " + ${JSON.stringify(MARKER_RELATIVE_PATH)} +
        " not found in this vault. Refusing to run user code."
      );
    }
    return await (async () => {
${code}
    })();
  })()`;

  const value = await evaluateInPage(target.webSocketDebuggerUrl, guardedExpression);

  if (value === undefined) {
    console.log("(undefined)");
  } else if (typeof value === "string") {
    console.log(value);
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

function evaluateInPage(webSocketDebuggerUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timed out waiting for CDP response"));
    }, 30_000);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data.toString());
      } catch {
        return;
      }
      if (msg.id !== 1) return;
      clearTimeout(timeout);
      ws.close();

      if (msg.error) {
        reject(new Error(`CDP error: ${JSON.stringify(msg.error)}`));
        return;
      }
      const result = msg.result;
      if (result.exceptionDetails) {
        reject(
          new Error(
            result.exceptionDetails.exception?.description ||
              JSON.stringify(result.exceptionDetails),
          ),
        );
        return;
      }
      resolve(result.result?.value);
    });

    ws.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event.message || "unknown"}`));
    });
  });
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
