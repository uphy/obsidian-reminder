#!/usr/bin/env bash
# Wait until the reminder plugin in the test vault's window is actually ready
# to be tested, instead of guessing with `sleep 20`.
#
# "Ready" means, in order: the vault's window answers CDP at all, the plugin
# object exists, and its initial full-vault scan has completed
# (`data.scanned.value === true`). Until the scan finishes, `reminders` is
# empty and any assertion about reminders is meaningless — which is what makes
# fixed sleeps flaky here.
#
# --min-reminders additionally waits for (and then asserts) a reminder count.
# Use it as a cheap "did my fixtures actually parse?" check: reminder syntax
# depends on which formats are enabled in settings, and a vault whose settings
# don't enable the format your fixtures use reports zero reminders with no
# error anywhere. See "Fixtures depend on settings" in SKILL.md.
#
# Usage:
#   obsidian-wait.sh                        # wait for the plugin + initial scan
#   obsidian-wait.sh --timeout 90           # default 60 seconds
#   obsidian-wait.sh --min-reminders 3      # also require >= 3 parsed reminders
#
# Env: same as obsidian-eval.mjs (OBSIDIAN_TEST_VAULT_NAME/_PATH required).
#
# Exits 0 once ready (printing the final state as JSON), 1 on timeout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TIMEOUT_SEC=60
MIN_REMINDERS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT_SEC="$2"; shift 2 ;;
    --min-reminders) MIN_REMINDERS="$2"; shift 2 ;;
    *)
      echo "usage: obsidian-wait.sh [--timeout SEC] [--min-reminders N]" >&2
      exit 2
      ;;
  esac
done

read -r -d '' PROBE <<EOF || true
const plugin = app.plugins.plugins["obsidian-reminder-plugin"];
if (!plugin) {
  return { ready: false, reason: "plugin not loaded yet" };
}
if (!plugin.data || !plugin.data.scanned.value) {
  return { ready: false, reason: "initial vault scan has not finished" };
}
const reminders = plugin._reminders.reminders.length;
if (reminders < ${MIN_REMINDERS}) {
  return { ready: false, reason: "only " + reminders + " reminders parsed", reminders };
}
return { ready: true, reminders, overdue: plugin._reminders.getExpiredReminders(plugin.settings.reminderTime.value).length };
EOF

DEADLINE=$(( $(date +%s) + TIMEOUT_SEC ))
LAST_OUTPUT=""
while [[ "$(date +%s)" -lt "$DEADLINE" ]]; do
  if LAST_OUTPUT="$(node "$SCRIPT_DIR/obsidian-eval.mjs" "$PROBE" 2>&1)"; then
    if [[ "$LAST_OUTPUT" == *'"ready": true'* ]]; then
      echo "$LAST_OUTPUT"
      exit 0
    fi
  fi
  sleep 1
done

echo "error: not ready within ${TIMEOUT_SEC}s. Last response:" >&2
echo "$LAST_OUTPUT" >&2
exit 1
