#!/usr/bin/env bash
# Run QA cases against the test vault, one after another.
#
# Usage:
#   qa-run.sh [--step NAME] [--shot FILE.png] <case.js>...
#
# Each case is the body of an async function evaluated inside Obsidian, with
# qa-lib.js prepended. A case that returns `finish()` passes when its
# `failed` list is empty; this script exits non-zero when any case fails or
# throws.
#
#   --step NAME   Sets `window.__step` before the case runs, for cases that
#                 do one step per call (the screenshot tours).
#   --shot FILE   Takes a screenshot of the window after the last case.
#
# Requires OBSIDIAN_TEST_VAULT_NAME and OBSIDIAN_TEST_VAULT_PATH, and goes
# through obsidian-eval.mjs of the obsidian-e2e skill, so every guard of
# that skill applies (the vault must carry the opt-in marker file).
set -u

here="$(cd "$(dirname "$0")" && pwd)"
e2e="$here/../../obsidian-e2e/scripts"

step=""
shot=""
while [ $# -gt 0 ]; do
  case "$1" in
    --step) step="$2"; shift 2 ;;
    --shot) shot="$2"; shift 2 ;;
    --) shift; break ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done
if [ $# -eq 0 ]; then
  echo "usage: qa-run.sh [--step NAME] [--shot FILE.png] <case.js>..." >&2
  exit 2
fi
: "${OBSIDIAN_TEST_VAULT_NAME:?set OBSIDIAN_TEST_VAULT_NAME}"
: "${OBSIDIAN_TEST_VAULT_PATH:?set OBSIDIAN_TEST_VAULT_PATH}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
status=0

for case_file in "$@"; do
  name="$(basename "$case_file")"
  {
    printf 'window.__step = %s;\n' "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$step")"
    cat "$here/qa-lib.js"
    printf '\n'
    cat "$case_file"
  } > "$tmp/case.js"
  if ! node "$e2e/obsidian-eval.mjs" --file "$tmp/case.js" > "$tmp/out.json" 2> "$tmp/err.txt"; then
    echo "ERROR $name"
    cat "$tmp/err.txt"
    status=1
    continue
  fi
  node -e '
    const fs = require("fs");
    const name = process.argv[2];
    const raw = fs.readFileSync(process.argv[1], "utf8").trim();
    let v = raw;
    try { v = JSON.parse(raw); } catch {}
    if (typeof v === "string") { try { v = JSON.parse(v); } catch {} }
    if (v && Array.isArray(v.failed) && Array.isArray(v.passed)) {
      console.log(`${v.failed.length === 0 ? "PASS" : "FAIL"} ${name}: ${v.passed.length} passed, ${v.failed.length} failed`);
      if (v.failed.length > 0) {
        console.log(JSON.stringify({ failed: v.failed, extra: v.extra }, null, 1));
        process.exit(1);
      }
    } else {
      console.log(`DONE ${name}`);
      console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1));
    }
  ' "$tmp/out.json" "$name" || status=1
done

if [ -n "$shot" ]; then
  "$e2e/obsidian-shot.sh" --cdp "$shot" 2>&1 | tail -1
fi
exit $status
