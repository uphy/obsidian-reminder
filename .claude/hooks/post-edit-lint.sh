#!/bin/bash
# PostToolUse hook (matcher: Edit|Write)
#
# Runs a fast, single-file ESLint check right after Claude edits/writes a
# TypeScript or Svelte file under src/. Intentionally skips project-wide
# `tsc`/`svelte-check` here since those are comparatively slow; that work is
# deferred to the Stop hook (stop-check.sh).
#
# Reads the PostToolUse hook JSON payload from stdin, e.g.:
#   {"tool_input":{"file_path":"/abs/path/to/src/foo.ts"}, "cwd": "...", ...}
#
# Exit codes:
#   0 - nothing to do, or lint passed
#   2 - lint failed; details are written to stderr so Claude can see them

set -uo pipefail

input="$(cat)"

# --- helpers ---------------------------------------------------------------

# Extract a string field from the JSON payload on stdin using jq if
# available, otherwise fall back to a small Node.js one-liner.
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
        if (filter === ".tool_input.file_path") {
          value = data.tool_input && data.tool_input.file_path;
        } else if (filter === ".cwd") {
          value = data.cwd;
        }
        process.stdout.write(value ? String(value) : "");
      } catch (e) {
        process.stdout.write("");
      }
    ' 2>/dev/null
  fi
}

file_path="$(json_field '.tool_input.file_path')"

if [ -z "$file_path" ]; then
  exit 0
fi

# Only lint TypeScript / Svelte sources under src/.
case "$file_path" in
  *.ts | *.svelte) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  */src/* | src/*) ;;
  *) exit 0 ;;
esac

# Resolve the project root: prefer $CLAUDE_PROJECT_DIR, then the hook's own
# JSON "cwd" field, then fall back to this script's location.
project_dir="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$project_dir" ]; then
  project_dir="$(json_field '.cwd')"
fi
if [ -z "$project_dir" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_dir="$(cd "$script_dir/../.." && pwd)"
fi

cd "$project_dir" || exit 0

# The file may have been deleted/moved since the tool ran.
if [ ! -f "$file_path" ]; then
  exit 0
fi

# Prefer `mise exec` so we lint with the project's pinned Node/tooling, but
# don't hard-fail if mise isn't on PATH.
if command -v mise >/dev/null 2>&1; then
  runner=(mise exec --)
else
  runner=()
fi

if [ ! -x node_modules/.bin/eslint ] && ! command -v npx >/dev/null 2>&1; then
  # Tooling isn't installed; nothing we can do here.
  exit 0
fi

# --fix silently repairs auto-fixable problems (mostly prettier formatting);
# only unfixable issues remain in the output and block with exit 2.
lint_output="$("${runner[@]}" npx eslint --no-warn-ignored --fix "$file_path" 2>&1)"
lint_status=$?

if [ $lint_status -ne 0 ]; then
  {
    echo "ESLint found issues in: $file_path (auto-fixable ones are already fixed; the file on disk may have changed)"
    echo ""
    echo "$lint_output"
  } >&2
  exit 2
fi

exit 0
