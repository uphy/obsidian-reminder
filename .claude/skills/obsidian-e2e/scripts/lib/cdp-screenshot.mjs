#!/usr/bin/env node
// Screenshot an Obsidian window through CDP instead of the OS window server.
//
// This is obsidian-shot.sh's fallback for machines without PyObjC's Quartz
// bindings, which the preferred path needs to turn a window title into a
// window ID for `screencapture -l`. Quartz is not part of the system python3
// on macOS, so a checkout that has never had `pip install
// pyobjc-framework-Quartz` run against it cannot screenshot at all.
//
// What you lose compared to the window-ID capture: this renders the page, so
// the native title bar and window shadow are not in the image. Everything
// Obsidian draws itself — ribbon, tabs, editor, panels, modals — is.
//
// Safety: this only ever reads. It picks the page by the same title rules as
// the rest of the skill (lib/vault-window.mjs) and then, when the page has an
// `app` global, confirms `app.vault.getName()` before capturing — a read-only
// identity check, which is what routing a screenshot to the right window
// needs. The marker file is deliberately not required (see obsidian-shot.sh:
// a screenshot is not a write into the vault).
//
// A page with no `app` global cannot prove which vault it belongs to. That is
// the settings window Obsidian 1.13+ opens, and the whole reason
// --title-contains exists — so such a page is captured only when the caller
// narrowed the selection with --title-contains, never as an unattended guess.
//
// Usage:
//   node lib/cdp-screenshot.mjs --vault <name> [--port N] [--title-contains TEXT] <out.png>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { evaluateInPage, fetchTargets, vaultPages } from "./vault-window.mjs";

const argv = process.argv.slice(2);
function optionValue(name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

const vault = optionValue("--vault");
const port = optionValue("--port") || process.env.OBSIDIAN_CDP_PORT || "9333";
const titleContains = optionValue("--title-contains") ?? "";

// The one positional argument, skipping every flag and the value it consumes.
const FLAGS_WITH_VALUE = ["--vault", "--port", "--title-contains"];
let outputPath;
for (let i = 0; i < argv.length; i++) {
  if (FLAGS_WITH_VALUE.includes(argv[i])) {
    i++;
    continue;
  }
  if (!argv[i].startsWith("--")) {
    outputPath = argv[i];
    break;
  }
}

if (!vault || !outputPath) {
  console.error(
    "usage: node lib/cdp-screenshot.mjs --vault <name> [--port N] [--title-contains TEXT] <out.png>",
  );
  process.exit(2);
}

let targets;
try {
  targets = await fetchTargets(port);
} catch {
  console.error(
    `error: no CDP endpoint on port ${port}. Is Obsidian running with --remote-debugging-port? See obsidian-launch.sh.`,
  );
  process.exit(4);
}

const candidates = vaultPages(targets, vault).filter((page) =>
  (page.title ?? "").includes(titleContains),
);
if (candidates.length !== 1) {
  console.error(
    `refusing to run: expected exactly 1 CDP page for vault '${vault}'${
      titleContains ? ` whose title also contains '${titleContains}'` : ""
    }, found ${candidates.length}:`,
  );
  for (const page of vaultPages(targets, vault)) {
    console.error(`  - ${page.title ?? ""}`);
  }
  console.error(
    "(If this vault has several windows open — e.g. the settings window — narrow it with --title-contains.)",
  );
  process.exit(3);
}
const page = candidates[0];

// Read-only identity check. A page without `app` throws here; that is the
// settings window, which can only be captured when the caller named it.
let reportedVault = null;
let identityError = null;
try {
  reportedVault = await evaluateInPage(
    page.webSocketDebuggerUrl,
    "(async () => app.vault.getName())()",
    10_000,
  );
} catch (e) {
  identityError = e.message;
}

if (reportedVault === null) {
  if (!titleContains) {
    console.error(
      `refusing to run: the page titled '${page.title ?? ""}' could not report its vault, so there is nothing but its title to identify it by.`,
    );
    console.error(`  reason: ${identityError ?? "no value returned"}`);
    console.error(
      "Pass --title-contains to say explicitly which window you mean (this is how the settings window, which has no 'app' global, is captured).",
    );
    process.exit(3);
  }
  console.error(
    `note: '${page.title ?? ""}' could not report its vault (${identityError ?? "no value returned"}); capturing it on the strength of --title-contains '${titleContains}' alone.`,
  );
} else if (reportedVault !== vault) {
  console.error(
    `refusing to run: the matched page reports vault '${reportedVault}', not '${vault}'.`,
  );
  process.exit(3);
}

const data = await capture(page.webSocketDebuggerUrl);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.from(data, "base64"));
console.log(`saved: ${outputPath}`);

function capture(webSocketDebuggerUrl, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timed out waiting for the screenshot"));
    }, timeoutMs);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Page.captureScreenshot",
          params: { format: "png" },
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
      resolve(msg.result.data);
    });
    ws.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event.message || "unknown"}`));
    });
  });
}
