#!/usr/bin/env node
// Small CLI over the CDP page list, so the bash scripts don't each carry their
// own inline copy of the title-matching rule (see lib/vault-window.mjs).
//
// Usage:
//   node lib/cdp-pages.mjs --vault <name> [--port 9333] [--count | --all]
//
//   (default)  print the titles of the pages belonging to <vault>, one per line
//   --count    print just how many pages belong to <vault>
//   --all      print every page title, whichever vault it belongs to
//
// Exits 4 if the CDP endpoint isn't reachable at all (prints nothing).

import { allPageTitles, fetchTargets, vaultPages } from "./vault-window.mjs";

const argv = process.argv.slice(2);
function optionValue(name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

const vault = optionValue("--vault");
const port = optionValue("--port") || process.env.OBSIDIAN_CDP_PORT || "9333";
const wantsCount = argv.includes("--count");
const wantsAll = argv.includes("--all");

if (!vault && !wantsAll) {
  console.error("usage: node lib/cdp-pages.mjs --vault <name> [--port N] [--count | --all]");
  process.exit(2);
}

let targets;
try {
  targets = await fetchTargets(port);
} catch {
  process.exit(4);
}

if (wantsAll) {
  for (const title of allPageTitles(targets)) {
    console.log(title);
  }
} else if (wantsCount) {
  console.log(vaultPages(targets, vault).length);
} else {
  for (const page of vaultPages(targets, vault)) {
    console.log(page.title);
  }
}
