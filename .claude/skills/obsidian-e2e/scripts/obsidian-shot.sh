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
# One vault can own several windows: Obsidian 1.13+ opens Settings in its own
# window, and notes can be popped out. "Exactly one window for this vault" then
# refuses to capture anything at all, which is what made the settings screen
# impossible to screenshot. --title-contains narrows the candidates by an extra
# substring of the window title, so `--title-contains 設定` (or whatever the
# Settings screen is called in your Obsidian's language) picks that window.
#
# The narrowing is deliberately explicit rather than a main/settings guess:
# a popped-out note and the settings window have title shapes that can't be
# told apart reliably, and this script never evaluates anything inside a page,
# so it has nothing but the title to go on. obsidian-eval.mjs, which can look
# at the DOM, does classify windows — use --window there.
#
# Window discovery needs PyObjC's Quartz bindings, which are NOT part of the
# system python3 on macOS. Rather than fail — which used to surface as a
# misleading "expected exactly 1 window" — this falls back to capturing the
# page through CDP (lib/cdp-screenshot.mjs). That image has no native title
# bar or window shadow, but everything Obsidian draws itself is in it. Install
# `python3 -m pip install pyobjc-framework-Quartz` for true window captures, or
# pass --cdp to take the fallback path deliberately.
#
# Usage:
#   obsidian-shot.sh <output-path.png>
#   obsidian-shot.sh --title-contains '設定' <output-path.png>
#   obsidian-shot.sh --cdp <output-path.png>          # skip Quartz, capture via CDP
#
# Env:
#   OBSIDIAN_TEST_VAULT_NAME   required, no default
#   OBSIDIAN_CDP_PORT          default 9333 (the cross-check, and the fallback)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDP_PAGES="$SCRIPT_DIR/lib/cdp-pages.mjs"
CDP_SHOT="$SCRIPT_DIR/lib/cdp-screenshot.mjs"

TITLE_CONTAINS=""
OUTPUT_PATH=""
FORCE_CDP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --title-contains) TITLE_CONTAINS="$2"; shift 2 ;;
    --cdp) FORCE_CDP=1; shift ;;
    *) OUTPUT_PATH="$1"; shift ;;
  esac
done

if [[ -z "$OUTPUT_PATH" ]]; then
  echo "usage: obsidian-shot.sh [--title-contains TEXT] <output-path.png>" >&2
  echo "required env: OBSIDIAN_TEST_VAULT_NAME" >&2
  exit 2
fi

: "${OBSIDIAN_TEST_VAULT_NAME:?error: OBSIDIAN_TEST_VAULT_NAME is required (no default)}"
PORT="${OBSIDIAN_CDP_PORT:-9333}"

capture_via_cdp() {
  # An array, not `${VAR:+--flag "$VAR"}`: that expands unquoted and would
  # split a title containing spaces into several arguments.
  local args
  args=(--vault "$OBSIDIAN_TEST_VAULT_NAME" --port "$PORT")
  if [[ -n "$TITLE_CONTAINS" ]]; then
    args+=(--title-contains "$TITLE_CONTAINS")
  fi
  exec node "$CDP_SHOT" "${args[@]}" "$OUTPUT_PATH"
}

if [[ "$FORCE_CDP" -eq 1 ]]; then
  capture_via_cdp
fi

# Quartz is what turns a window title into the window ID `screencapture -l`
# needs. Without it there is no window-ID path at all, so take the fallback
# instead of reporting the missing module as a guard failure.
if ! python3 -c 'import Quartz' > /dev/null 2>&1; then
  echo "note: PyObjC's Quartz bindings are not installed, so the window list is unavailable." >&2
  echo "  Capturing the page through CDP instead (no native title bar in the image)." >&2
  echo "  For true window captures: python3 -m pip install pyobjc-framework-Quartz" >&2
  capture_via_cdp
fi

# --- Guard A: exactly one on-screen Obsidian window matching the vault -----
# (temporarily disable errexit: a non-zero exit here means "not exactly one
# match," which we want to report with our own message/exit code below, not
# let `set -e` kill the script mid-substitution before we get the chance)
set +e
WINDOW_ID="$(python3 - "$OBSIDIAN_TEST_VAULT_NAME" "$TITLE_CONTAINS" << 'PYEOF'
import sys
import Quartz

vault = sys.argv[1]
extra = sys.argv[2]

# Same two title shapes lib/vault-window.mjs matches: "<note> - <vault> - ..."
# once a note is open, and "<vault> - Obsidian ..." while none is.
def belongs_to_vault(name):
    return f" - {vault} - " in name or name.startswith(f"{vault} - Obsidian")

wins = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID
)
candidates = [
    w for w in wins
    if w.get("kCGWindowOwnerName") == "Obsidian" and belongs_to_vault(w.get("kCGWindowName") or "")
]
matches = [w for w in candidates if extra in (w.get("kCGWindowName") or "")]

if len(matches) != 1:
    print(f"COUNT:{len(matches)}", file=sys.stderr)
    for w in wins:
        if w.get("kCGWindowOwnerName") == "Obsidian":
            print(f"  - {w.get('kCGWindowName', '')!r}", file=sys.stderr)
    sys.exit(1)

print(f"{matches[0]['kCGWindowNumber']} {len(candidates)}")
PYEOF
)"
STATUS=$?
set -e
if [[ $STATUS -ne 0 || -z "$WINDOW_ID" ]]; then
  echo "refusing to run: expected exactly 1 on-screen Obsidian window for vault '$OBSIDIAN_TEST_VAULT_NAME'${TITLE_CONTAINS:+ whose title also contains '$TITLE_CONTAINS'}, see counts/titles above." >&2
  echo "(If this vault has several windows open — e.g. the settings window — narrow it with --title-contains.)" >&2
  exit 3
fi
WINDOW_CANDIDATES="${WINDOW_ID##* }"
WINDOW_ID="${WINDOW_ID%% *}"

# --- Guard B: cross-check against the CDP page list (independent source) ---
# The two sources must agree on how many windows this vault has. They are
# allowed to be more than one (settings window, popped-out notes); what must
# not happen is the on-screen window list and Obsidian's own page list telling
# different stories about which windows exist.
PAGE_COUNT="$(node "$CDP_PAGES" --vault "$OBSIDIAN_TEST_VAULT_NAME" --port "$PORT" --count 2>/dev/null || echo 0)"
if [[ "$PAGE_COUNT" != "$WINDOW_CANDIDATES" ]]; then
  echo "refusing to run: the on-screen window list found $WINDOW_CANDIDATES window(s) for vault '$OBSIDIAN_TEST_VAULT_NAME', but the CDP page list found $PAGE_COUNT. Refusing due to disagreement between the two sources." >&2
  echo "(Is Obsidian running with --remote-debugging-port=$PORT? See obsidian-launch.sh.)" >&2
  exit 3
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
screencapture -x -o -l "$WINDOW_ID" "$OUTPUT_PATH"
echo "saved: $OUTPUT_PATH"
