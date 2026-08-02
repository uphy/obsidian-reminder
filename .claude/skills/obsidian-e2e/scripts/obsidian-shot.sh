#!/usr/bin/env bash
# Capture a screenshot of the Obsidian window for exactly one, explicitly
# named vault.
#
# Why not `screencapture -R x,y,w,h`: on Retina / multi-display setups the
# coordinate system screencapture -R expects doesn't line up with what
# CGWindowListCopyWindowInfo reports, and you silently get a blank, narrow
# sliver image instead of an error. Capturing by window ID
# (`screencapture -x -o -l <id>`) is the only approach that has actually
# worked in testing.
#
# Why not the Accessibility (AX) tree for locating the window: AXManualAccessibility
# + System Events enumeration has been unreliable/timeout-prone here. Window
# discovery instead goes through Quartz's CGWindowListCopyWindowInfo
# (PyObjC), matching kCGWindowOwnerName == "Obsidian" and a kCGWindowName
# containing " - <VAULT_NAME> - " (same title convention CDP page targets
# use — see obsidian-eval.mjs).
#
# This script never writes into any vault: it only reads the on-screen window
# list (OS-level, not vault content) and writes a PNG to the output path you
# give it. It therefore does not check for the obsidian-e2e-allowed marker
# file (that marker means "this vault's files may be rewritten by
# automation," which doesn't apply here) — but it does still require the
# vault name and enforces the same "exactly one match" rule as the other
# scripts, cross-checked against the CDP page list as a second, independent
# source of truth.
#
# Usage:
#   obsidian-shot.sh <output-path.png>
#
# Env:
#   OBSIDIAN_TEST_VAULT_NAME   required, no default
#   OBSIDIAN_CDP_PORT          default 9333 (used only for the cross-check)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "usage: obsidian-shot.sh <output-path.png>" >&2
  echo "required env: OBSIDIAN_TEST_VAULT_NAME" >&2
  exit 2
fi
OUTPUT_PATH="$1"

: "${OBSIDIAN_TEST_VAULT_NAME:?error: OBSIDIAN_TEST_VAULT_NAME is required (no default)}"
PORT="${OBSIDIAN_CDP_PORT:-9333}"

# --- Guard A: exactly one on-screen Obsidian window matching the vault -----
# (temporarily disable errexit: a non-zero exit here means "not exactly one
# match," which we want to report with our own message/exit code below, not
# let `set -e` kill the script mid-substitution before we get the chance)
set +e
WINDOW_ID="$(python3 - "$OBSIDIAN_TEST_VAULT_NAME" << 'PYEOF'
import sys
import Quartz

vault = sys.argv[1]
needle = f" - {vault} - "

wins = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID
)
matches = [
    w for w in wins
    if w.get("kCGWindowOwnerName") == "Obsidian" and needle in (w.get("kCGWindowName") or "")
]

if len(matches) != 1:
    print(f"COUNT:{len(matches)}", file=sys.stderr)
    for w in wins:
        if w.get("kCGWindowOwnerName") == "Obsidian":
            print(f"  - {w.get('kCGWindowName', '')!r}", file=sys.stderr)
    sys.exit(1)

print(matches[0]["kCGWindowNumber"])
PYEOF
)"
STATUS=$?
set -e
if [[ $STATUS -ne 0 || -z "$WINDOW_ID" ]]; then
  echo "refusing to run: expected exactly 1 on-screen Obsidian window titled with ' - $OBSIDIAN_TEST_VAULT_NAME - ', see counts/titles above." >&2
  exit 3
fi

# --- Guard B: cross-check against the CDP page list (independent source) ---
PAGE_COUNT="$(curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/list" 2>/dev/null \
  | node -e '
      let data = "";
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => {
        const vault = process.argv[1];
        const needle = ` - ${vault} - `;
        try {
          const targets = JSON.parse(data);
          const n = targets.filter(
            (t) => t.type === "page" && typeof t.title === "string" && t.title.includes(needle),
          ).length;
          console.log(n);
        } catch {
          console.log(0);
        }
      });
    ' "$OBSIDIAN_TEST_VAULT_NAME")"
if [[ "$PAGE_COUNT" != "1" ]]; then
  echo "refusing to run: window list found exactly 1 match, but the CDP page list found $PAGE_COUNT (expected 1). Refusing due to disagreement between the two sources." >&2
  echo "(Is Obsidian running with --remote-debugging-port=$PORT? See obsidian-launch.sh.)" >&2
  exit 3
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
screencapture -x -o -l "$WINDOW_ID" "$OUTPUT_PATH"
echo "saved: $OUTPUT_PATH"
