#!/usr/bin/env bash
# Read and click the macOS system notifications obsidian-reminder raises --
# the part CDP can't reach, since Electron's Notification lives outside the
# DOM. Works through the Accessibility API of Notification Center
# (lib/notification-center.swift); see that file for why it performs the
# notification row's custom AX actions instead of pressing buttons.
#
# This script never touches a vault: it reads Notification Center and
# delivers clicks to notifications, and the plugin reacts to those clicks.
# Check the effect (file rewritten, toast shown) through obsidian-eval.mjs.
# It only ever reads or acts on notifications titled "Obsidian Reminder";
# other apps' notifications are never printed.
#
# Usage:
#   system-notification.sh list
#   system-notification.sh act [--timeout SEC] [--banner-only] <reminder-title> <action>
#   system-notification.sh clear-all
#
#   <action>: "Mark as Done", a "Remind me later" label as configured
#             ("In 30 minutes", "Tomorrow", ...), click (the body), or close.
#
# `act` waits up to --timeout seconds (default 15) for the notification to
# appear. By default it opens Notification Center first and closes it again
# afterwards if it was closed, so the result doesn't depend on catching the
# banner during the ~5 seconds macOS shows it. --banner-only leaves
# Notification Center alone and acts on the on-screen banner instead (to test
# that path specifically); expect to miss it if the timeout outlasts the banner.
#
# `list` and `clear-all` look at the on-screen banner and, if open, the
# Notification Center panel; neither opens the panel by itself. `clear-all`
# opens it, closes every Obsidian Reminder notification, and restores it.
#
# Requirements: Accessibility permission for the app running this script (the
# terminal / IDE), and `swiftc` (Xcode Command Line Tools). The Swift file is
# compiled once into $TMPDIR and reused until it changes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/lib/notification-center.swift"

usage() {
  sed -n '/^# Usage:/,/^#   <action>/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

build() {
  if ! command -v swiftc >/dev/null 2>&1; then
    echo "swiftc not found. Install the Xcode Command Line Tools: xcode-select --install" >&2
    exit 1
  fi
  local hash cache bin
  hash="$(shasum "$SOURCE" | cut -c1-12)"
  cache="${TMPDIR:-/tmp}/obsidian-e2e"
  bin="$cache/notification-center-$hash"
  if [ ! -x "$bin" ]; then
    mkdir -p "$cache"
    swiftc -O -o "$bin.tmp" "$SOURCE" >&2
    mv "$bin.tmp" "$bin"
  fi
  NC="$bin"
}

[ $# -ge 1 ] || usage
command="$1"
shift
build

case "$command" in
  list)
    [ $# -eq 0 ] || usage
    "$NC" list
    ;;

  clear-all)
    [ $# -eq 0 ] || usage
    was="$("$NC" state)"
    "$NC" open
    "$NC" clear-all
    [ "$was" = "open" ] || "$NC" close
    ;;

  act)
    timeout=15
    banner_only=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --timeout) timeout="$2"; shift 2 ;;
        --banner-only) banner_only=1; shift ;;
        --) shift; break ;;
        -*) usage ;;
        *) break ;;
      esac
    done
    [ $# -eq 2 ] || usage
    title="$1"
    action="$2"

    was="$("$NC" state)"
    restore() { [ "$banner_only" = 1 ] || [ "$was" = "open" ] || "$NC" close; }
    [ "$banner_only" = 1 ] || "$NC" open

    errfile="$(mktemp)"
    trap 'rm -f "$errfile"' EXIT
    deadline=$(( $(date +%s) + timeout ))
    while :; do
      set +e
      out="$("$NC" act "$title" "$action" 2>"$errfile")"
      status=$?
      set -e
      err="$(cat "$errfile")"
      if [ "$status" -eq 0 ]; then
        echo "$out"
        restore
        exit 0
      fi
      # 3 = the notification isn't there (yet); anything else won't fix itself.
      if [ "$status" -ne 3 ] || [ "$(date +%s)" -ge "$deadline" ]; then
        echo "$err" >&2
        restore
        exit "$status"
      fi
      sleep 0.3
    done
    ;;

  *)
    usage
    ;;
esac
