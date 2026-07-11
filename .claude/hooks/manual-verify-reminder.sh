#!/bin/bash
# Stop hook
#
# Reminds Claude to run the manual-verify skill (real-vault verification)
# before finishing a turn that changed TypeScript/Svelte sources. Automated
# tests only cover src/model/, so anything touching the Obsidian API needs a
# human check in a running Obsidian.
#
# This is a one-shot reminder, not a hard gate: manual verification requires
# the user's participation (restarting Obsidian, clicking through), and some
# changes (docs, tests, model-only logic fully covered by unit tests) don't
# need it. A hash of the changed files' contents is cached in
# .claude/hooks/.manual-verify-state; once the reminder has fired for a given
# state, the same state is let through. Any further source edit changes the
# hash and re-arms the reminder.
#
# Reads the Stop hook JSON payload from stdin, e.g.:
#   {"cwd": "/abs/project/dir", ...}
#
# Exit codes:
#   0 - nothing to remind about, or already reminded for this state
#   2 - reminder fired; instructions written to stderr

set -uo pipefail

input="$(cat)"

json_field() {
  local filter="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r "$filter // empty" 2>/dev/null
  elif command -v node >/dev/null 2>&1; then
    NODE_JSON_INPUT="$input" NODE_JSON_FILTER="$filter" node -e '
      try {
        const data = JSON.parse(process.env.NODE_JSON_INPUT || "{}");
        const filter = process.env.NODE_JSON_FILTER;
        let value;
        if (filter === ".cwd") {
          value = data.cwd;
        }
        process.stdout.write(value ? String(value) : "");
      } catch (e) {
        process.stdout.write("");
      }
    ' 2>/dev/null
  fi
}

project_dir="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$project_dir" ]; then
  project_dir="$(json_field '.cwd')"
fi
if [ -z "$project_dir" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_dir="$(cd "$script_dir/../.." && pwd)"
fi

cd "$project_dir" || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Tracked + untracked .ts/.svelte changes (excludes ignored files like main.js).
changed_files="$(git status --porcelain -- '*.ts' '*.svelte' 2>/dev/null | awk '{print $2}')"

if [ -z "$changed_files" ]; then
  exit 0
fi

state_dir=".claude/hooks"
state_file="$state_dir/.manual-verify-state"
mkdir -p "$state_dir"

hash_cmd=""
if command -v shasum >/dev/null 2>&1; then
  hash_cmd="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  hash_cmd="sha256sum"
fi

current_hash=""
if [ -n "$hash_cmd" ]; then
  current_hash="$(
    while IFS= read -r f; do
      [ -f "$f" ] && cat "$f"
    done <<<"$changed_files" | $hash_cmd | awk '{print $1}'
  )"
fi

last_hash=""
if [ -f "$state_file" ]; then
  last_hash="$(cat "$state_file" 2>/dev/null)"
fi

if [ -n "$current_hash" ] && [ "$current_hash" = "$last_hash" ]; then
  # Already reminded for exactly this set of changes.
  exit 0
fi

if [ -n "$current_hash" ]; then
  printf '%s' "$current_hash" >"$state_file"
fi

{
  echo "Manual verification reminder: this turn ends with uncommitted .ts/.svelte changes."
  echo ""
  echo "Automated tests only cover src/model/. If these changes affect runtime behavior"
  echo "in Obsidian (anything under src/plugin/ or src/ui/, parsing behavior visible in"
  echo "the vault, etc.), invoke the manual-verify skill now to set up the test vault and"
  echo "guide the user through verification."
  echo ""
  echo "If manual verification is genuinely unnecessary (docs/test-only changes, or"
  echo "model-layer logic fully covered by unit tests), briefly state that reasoning to"
  echo "the user and finish. This reminder fires once per change state and will not"
  echo "block again until the sources change further."
} >&2
exit 2
