#!/bin/bash
# Stop hook
#
# Runs once per assistant turn completion. Full `tsc --noEmit` +
# `svelte-check` are comparatively slow to run on every single Stop event,
# so this script only runs them when there are actually uncommitted
# TypeScript/Svelte changes in the working tree (tracked or untracked).
#
# To avoid looping forever if the same failure can't be resolved (or is a
# false positive), a hash of the changed files' contents is cached in
# .claude/hooks/.stop-check-state. If the same failing hash is seen twice in
# a row, the hook lets Claude stop instead of blocking again.
#
# Reads the Stop hook JSON payload from stdin, e.g.:
#   {"cwd": "/abs/project/dir", ...}
#
# Exit codes:
#   0 - nothing to check, or checks passed
#   2 - tsc/svelte-check failed; details written to stderr

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
state_file="$state_dir/.stop-check-state"
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
  # Same failing state as the previous Stop hook run for these files;
  # avoid blocking forever on an unresolved/unresolvable issue.
  exit 0
fi

if command -v mise >/dev/null 2>&1; then
  runner=(mise exec --)
else
  runner=()
fi

tsc_output="$("${runner[@]}" npx tsc --noEmit --pretty 2>&1)"
tsc_status=$?

svelte_output="$("${runner[@]}" npx svelte-check 2>&1)"
svelte_status=$?

if [ $tsc_status -ne 0 ] || [ $svelte_status -ne 0 ]; then
  if [ -n "$current_hash" ]; then
    printf '%s' "$current_hash" >"$state_file"
  fi
  {
    echo "Static checks failed for changed .ts/.svelte files. Please fix before finishing:"
    echo ""
    echo "--- tsc --noEmit --pretty (exit $tsc_status) ---"
    echo "$tsc_output"
    echo ""
    echo "--- svelte-check (exit $svelte_status) ---"
    echo "$svelte_output"
  } >&2
  exit 2
fi

rm -f "$state_file"
exit 0
