#!/usr/bin/env bash
# Ensure Obsidian is running with remote debugging (CDP) enabled, so
# obsidian-eval.mjs / obsidian-shot.sh / reminder-fire.sh have something to
# talk to.
#
# Starting the app is NOT vault-specific — it operates on the Obsidian
# *application*, which reopens whatever vaults were open last time as separate
# windows. That part never reads or writes inside any vault; it only
# starts/stops the app process and polls the CDP HTTP endpoint.
#
# Obsidian only reopens the vaults that happened to be open when it was last
# quit, and the test vault is frequently not among them — which used to leave
# every other script in this skill failing with "found no page target," with
# nothing explaining why. So if OBSIDIAN_TEST_VAULT_NAME is set and no window
# belongs to it, this script opens that one vault via the obsidian:// URI and
# waits for its window. That step *is* vault-specific, so it carries the same
# filesystem-side guards as the other scripts (name/path agreement plus the
# obsidian-e2e-allowed marker) before naming a vault to open. Opening a vault
# makes Obsidian write its own .obsidian/workspace.json, which is exactly the
# kind of write the marker exists to authorize.
#
# Restarting Obsidian does not lose vault data (Obsidian saves on every edit),
# but it does close whatever windows/dialogs/unsaved-modal-state existed, and
# it affects every open vault's window, not just the test one. This script
# only actually restarts when it has to (CDP not yet reachable, or the caller
# passes --restart).
#
# Usage:
#   obsidian-launch.sh              # ensure CDP is up; start/restart only if needed
#   obsidian-launch.sh --restart    # force a quit+relaunch even if CDP already works
#   obsidian-launch.sh --no-open-vault   # never open the test vault, even if missing
#
# Env:
#   OBSIDIAN_CDP_PORT          default 9333 (9222 is often already taken by Chrome)
#   OBSIDIAN_TEST_VAULT_NAME   optional here; when set (with _PATH), its window is ensured
#   OBSIDIAN_TEST_VAULT_PATH   required whenever _NAME is set

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDP_PAGES="$SCRIPT_DIR/lib/cdp-pages.mjs"

PORT="${OBSIDIAN_CDP_PORT:-9333}"
FORCE_RESTART=0
OPEN_VAULT=1
for arg in "$@"; do
  case "$arg" in
    --restart) FORCE_RESTART=1 ;;
    --no-open-vault) OPEN_VAULT=0 ;;
    *)
      echo "error: unknown argument $arg" >&2
      echo "usage: obsidian-launch.sh [--restart] [--no-open-vault]" >&2
      exit 2
      ;;
  esac
done

cdp_version_json() {
  curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/version" 2>/dev/null || true
}

list_page_titles() {
  node "$CDP_PAGES" --all --port "$PORT" 2>/dev/null | sed 's/^/  - /' || true
}

vault_page_count() {
  node "$CDP_PAGES" --vault "$1" --port "$PORT" --count 2>/dev/null || echo 0
}

# Ensures a window for OBSIDIAN_TEST_VAULT_NAME exists, opening that vault if
# it doesn't. Silently does nothing when the env vars aren't set — this script
# is also useful without a vault configured.
ensure_test_vault_open() {
  local vault="${OBSIDIAN_TEST_VAULT_NAME:-}"
  if [[ "$OPEN_VAULT" -eq 0 || -z "$vault" ]]; then
    return 0
  fi

  # Right after a launch, Obsidian's windows appear over a few seconds. Give
  # the vault a moment to show up on its own before deciding to open it.
  for _ in $(seq 1 16); do
    if [[ "$(vault_page_count "$vault")" != "0" ]]; then
      return 0
    fi
    sleep 0.5
  done

  local vault_path="${OBSIDIAN_TEST_VAULT_PATH:-}"
  if [[ -z "$vault_path" ]]; then
    echo "warning: vault '$vault' has no window open, but OBSIDIAN_TEST_VAULT_PATH is unset, so it cannot be opened safely." >&2
    return 0
  fi

  # Same filesystem-side guards the other scripts use: naming a vault is not
  # consent, the marker file is.
  local real_path
  real_path="$(cd "$vault_path" 2>/dev/null && pwd -P || true)"
  if [[ -z "$real_path" ]]; then
    echo "error: OBSIDIAN_TEST_VAULT_PATH does not resolve: $vault_path" >&2
    exit 3
  fi
  if [[ "$(basename "$real_path")" != "$vault" ]]; then
    echo "error: basename(OBSIDIAN_TEST_VAULT_PATH) is '$(basename "$real_path")', which does not match OBSIDIAN_TEST_VAULT_NAME '$vault'." >&2
    exit 3
  fi
  if [[ ! -f "$real_path/.obsidian/obsidian-e2e-allowed" ]]; then
    echo "refusing to open vault '$vault': no marker file at $real_path/.obsidian/obsidian-e2e-allowed (see SKILL.md)." >&2
    exit 3
  fi

  echo "Vault '$vault' has no window open; opening it..."
  local encoded
  encoded="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$vault")"
  open "obsidian://open?vault=${encoded}"

  for _ in $(seq 1 60); do
    if [[ "$(vault_page_count "$vault")" != "0" ]]; then
      echo "Vault '$vault' is open."
      return 0
    fi
    sleep 0.5
  done
  echo "error: vault '$vault' did not open within 30s." >&2
  exit 7
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
      ensure_test_vault_open
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
    ensure_test_vault_open
    echo "Open page targets:"
    list_page_titles
    exit 0
  fi
  sleep 0.5
done

echo "error: CDP did not become reachable on port $PORT within 30s." >&2
exit 6
