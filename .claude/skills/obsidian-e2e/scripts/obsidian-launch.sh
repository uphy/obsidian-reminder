#!/usr/bin/env bash
# Ensure Obsidian is running with remote debugging (CDP) enabled, so
# obsidian-eval.mjs / obsidian-shot.sh / reminder-fire.sh have something to
# talk to.
#
# This script is NOT vault-specific — it operates on the Obsidian *application*,
# which on this machine reopens whatever vaults were open last time as separate
# windows. It never reads or writes inside any vault; it only starts/stops the
# app process and polls the CDP HTTP endpoint. The per-vault safety guards
# (marker file, vault name match) live in the other scripts, which is where
# they matter.
#
# Restarting Obsidian does not lose vault data (Obsidian saves on every edit),
# but it does close whatever windows/dialogs/unsaved-modal-state existed, and
# it affects every open vault's window, not just the test one. This script
# only actually restarts when it has to (CDP not yet reachable, or the caller
# passes --restart).
#
# Usage:
#   obsidian-launch.sh          # ensure CDP is up; start/restart only if needed
#   obsidian-launch.sh --restart  # force a quit+relaunch even if CDP already works
#
# Env:
#   OBSIDIAN_CDP_PORT   default 9333 (9222 is often already taken by Chrome)

set -euo pipefail

PORT="${OBSIDIAN_CDP_PORT:-9333}"
FORCE_RESTART=0
if [[ "${1:-}" == "--restart" ]]; then
  FORCE_RESTART=1
fi

cdp_version_json() {
  curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/version" 2>/dev/null || true
}

list_page_titles() {
  curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/list" 2>/dev/null \
    | node -e '
        let data = "";
        process.stdin.on("data", (c) => (data += c));
        process.stdin.on("end", () => {
          try {
            const targets = JSON.parse(data);
            for (const t of targets) {
              if (t.type === "page") console.log("  - " + t.title);
            }
          } catch {
            // ignore
          }
        });
      '
}

cdp_is_obsidian() {
  # The /json/version User-Agent embeds a lowercase "obsidian/<version>" token
  # (e.g. "... obsidian/1.12.7 Chrome/... Electron/..."), not "Obsidian" — match
  # case-insensitively so this doesn't silently fail again.
  local info="$1"
  [[ "${info,,}" == *"obsidian/"* ]]
}

if [[ "$FORCE_RESTART" -eq 0 ]]; then
  version_info="$(cdp_version_json)"
  if [[ -n "$version_info" ]]; then
    if cdp_is_obsidian "$version_info"; then
      echo "Obsidian already reachable via CDP on port $PORT."
      echo "Open page targets:"
      list_page_titles
      exit 0
    else
      echo "error: something is already listening on port $PORT via CDP, but it doesn't look like Obsidian." >&2
      echo "  response: $version_info" >&2
      echo "Pick a different OBSIDIAN_CDP_PORT (9222 is commonly used by Chrome)." >&2
      exit 4
    fi
  fi
fi

# Nothing (usable) is listening on the port. If Obsidian is running without
# debugging enabled (or --restart was requested), quit it first — you cannot
# turn on --remote-debugging-port for an already-running process.
if pgrep -x "Obsidian" > /dev/null 2>&1; then
  echo "Quitting the running Obsidian instance (it isn't exposing CDP on port $PORT, or --restart was requested)..."
  osascript -e 'tell application "Obsidian" to quit' > /dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    if ! pgrep -x "Obsidian" > /dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  if pgrep -x "Obsidian" > /dev/null 2>&1; then
    echo "error: Obsidian did not quit within 15s. Quit it manually and re-run this script." >&2
    exit 5
  fi
fi

echo "Launching Obsidian with --remote-debugging-port=$PORT..."
open -a Obsidian --args --remote-debugging-port="$PORT"

echo "Waiting for CDP to become reachable..."
for _ in $(seq 1 60); do
  version_info="$(cdp_version_json)"
  if [[ -n "$version_info" ]] && cdp_is_obsidian "$version_info"; then
    echo "Obsidian is up, CDP reachable on port $PORT."
    echo "Open page targets:"
    list_page_titles
    exit 0
  fi
  sleep 0.5
done

echo "error: CDP did not become reachable on port $PORT within 30s." >&2
exit 6
