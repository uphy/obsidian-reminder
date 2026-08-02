#!/usr/bin/env bash
# Rewrite the date/time on a reminder task line to a few minutes in the past, so
# the plugin's notification-worker treats it as expired and fires within
# seconds (no need to wait ~3 minutes for a real deadline). Because it also
# clears mute state, the same fixture line can be reused across runs by simply
# firing it again.
#
# This writes directly to a file inside the vault via the filesystem (not
# through CDP), so it carries its own, filesystem-side copy of the safety
# guards documented in obsidian-eval.mjs and SKILL.md:
#   1. OBSIDIAN_TEST_VAULT_NAME and OBSIDIAN_TEST_VAULT_PATH are both required.
#      No hardcoded defaults.
#   2. basename(realpath(OBSIDIAN_TEST_VAULT_PATH)) must equal
#      OBSIDIAN_TEST_VAULT_NAME.
#   3. OBSIDIAN_TEST_VAULT_PATH/.obsidian/obsidian-e2e-allowed must exist. This
#      marker file is the actual opt-in — matching the vault by name alone is
#      not enough (see "the wrong-vault write incident" in SKILL.md).
#   4. The target note path is realpath-normalized and must resolve to
#      somewhere inside the (realpath-normalized) vault root. This blocks
#      writes that escape the vault root via ../.. or a symlink.
#
# Usage:
#   reminder-fire.sh <note-path-relative-to-vault> <text-unique-to-the-line> [minutesAgo]
#
# <note-path-relative-to-vault>  e.g. reminder-test/1-toast.md
# <text-unique-to-the-line>      a substring that appears on exactly the task
#                                 line you want to fire, e.g. the task title
# [minutesAgo]                   how far in the past to set the date/time,
#                                 default 2 (minutes)
#
# Required env:
#   OBSIDIAN_TEST_VAULT_NAME
#   OBSIDIAN_TEST_VAULT_PATH
#
# Note: this only rewrites the file on disk. Obsidian must be running and
# watching the vault (see obsidian-launch.sh) for the file-change event and
# the notification-worker's periodic check to actually pick it up and fire.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKER_RELATIVE_PATH=".obsidian/obsidian-e2e-allowed"

usage() {
  echo "usage: reminder-fire.sh <note-path-relative-to-vault> <text-unique-to-the-line> [minutesAgo]" >&2
  echo "required env: OBSIDIAN_TEST_VAULT_NAME, OBSIDIAN_TEST_VAULT_PATH" >&2
  exit 2
}

if [[ $# -lt 2 ]]; then
  usage
fi

NOTE_RELATIVE_PATH="$1"
MATCH_TEXT="$2"
MINUTES_AGO="${3:-2}"

: "${OBSIDIAN_TEST_VAULT_NAME:?error: OBSIDIAN_TEST_VAULT_NAME is required (no default)}"
: "${OBSIDIAN_TEST_VAULT_PATH:?error: OBSIDIAN_TEST_VAULT_PATH is required (no default)}"

# --- Safety guard 1: path and name must agree ------------------------------
if ! REAL_VAULT_PATH="$(realpath "$OBSIDIAN_TEST_VAULT_PATH" 2>/dev/null)"; then
  echo "error: OBSIDIAN_TEST_VAULT_PATH does not resolve: $OBSIDIAN_TEST_VAULT_PATH" >&2
  exit 3
fi
VAULT_BASENAME="$(basename "$REAL_VAULT_PATH")"
if [[ "$VAULT_BASENAME" != "$OBSIDIAN_TEST_VAULT_NAME" ]]; then
  echo "refusing to run: basename(OBSIDIAN_TEST_VAULT_PATH) is '$VAULT_BASENAME', which does not match OBSIDIAN_TEST_VAULT_NAME '$OBSIDIAN_TEST_VAULT_NAME'." >&2
  exit 3
fi

# --- Safety guard 2: marker file (the actual opt-in) -----------------------
MARKER_PATH="$REAL_VAULT_PATH/$MARKER_RELATIVE_PATH"
if [[ ! -f "$MARKER_PATH" ]]; then
  echo "refusing to run: no marker file at $MARKER_PATH." >&2
  echo "A vault is only usable by obsidian-e2e scripts if it explicitly opts in by containing $MARKER_RELATIVE_PATH (see SKILL.md)." >&2
  exit 3
fi

# --- Safety guard 3: target note must resolve inside the vault root --------
TARGET_PATH="$REAL_VAULT_PATH/$NOTE_RELATIVE_PATH"
if [[ ! -f "$TARGET_PATH" ]]; then
  echo "error: note not found: $TARGET_PATH (this script only edits existing notes; create the fixture note first)" >&2
  exit 3
fi
if ! REAL_TARGET_PATH="$(realpath "$TARGET_PATH" 2>/dev/null)"; then
  echo "error: could not resolve target note path: $TARGET_PATH" >&2
  exit 3
fi
case "$REAL_TARGET_PATH" in
  "$REAL_VAULT_PATH"/*) ;;
  *)
    echo "refusing to run: resolved note path '$REAL_TARGET_PATH' is outside the vault root '$REAL_VAULT_PATH'." >&2
    exit 3
    ;;
esac

# --- Do the rewrite ----------------------------------------------------------
node "$SCRIPT_DIR/reminder-fire-rewrite.mjs" "$REAL_TARGET_PATH" "$MATCH_TEXT" "$MINUTES_AGO"
