#!/bin/bash
# Stop hook
#
# Reminds Claude to update the documentation site (docs/src/) when a change
# set touches user-facing source (src/**/*.ts, src/**/*.svelte, excluding
# *.test.ts) but nothing under docs/ has been touched. Several PRs (new
# settings, new reminder syntax) have shipped without the corresponding docs
# update; this hook is the recurrence prevention.
#
# Unlike manual-verify-reminder.sh (which only looks at uncommitted changes),
# this hook also looks at commits already made on the current branch that
# aren't on the default branch yet, because docs omissions are usually
# noticed after the code has already been committed on a feature branch.
#
# This is a one-shot reminder, not a hard gate: some changes are genuinely
# internal (refactors, CI, types, tests) and don't need doc updates. A hash
# of the changed-file list + HEAD commit + content of uncommitted changed
# files is cached in .claude/hooks/.docs-update-state; once the reminder has
# fired for a given state, the same state is let through. Any further
# relevant change (new commit, new edit) changes the hash and re-arms the
# reminder.
#
# Reads the Stop hook JSON payload from stdin, e.g.:
#   {"cwd": "/abs/project/dir", ...}
#
# Exit codes:
#   0 - nothing to remind about, docs were already touched, or already
#       reminded for this state
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

# 1. Working-tree changes (tracked + untracked), any path.
worktree_files="$(git status --porcelain 2>/dev/null | awk '{print $2}')"

# 2. Commits on the current branch not yet on the default branch. If we're
# on the default branch itself, detached, or can't find a sensible
# merge-base, fall back to working-tree-only (branch_files stays empty).
branch_files=""
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -n "$current_branch" ] && [ "$current_branch" != "HEAD" ] && [ "$current_branch" != "master" ] && [ "$current_branch" != "main" ]; then
  base_ref=""
  if git rev-parse --verify -q origin/master >/dev/null; then
    base_ref="origin/master"
  elif git rev-parse --verify -q master >/dev/null; then
    base_ref="master"
  fi
  if [ -n "$base_ref" ]; then
    merge_base="$(git merge-base HEAD "$base_ref" 2>/dev/null)"
    if [ -n "$merge_base" ]; then
      branch_files="$(git diff --name-only "$merge_base" HEAD 2>/dev/null)"
    fi
  fi
fi

all_changed_files="$(printf '%s\n%s\n' "$worktree_files" "$branch_files" | sed '/^$/d' | sort -u)"

if [ -z "$all_changed_files" ]; then
  exit 0
fi

# Filter to potentially user-facing source: src/**/*.ts or src/**/*.svelte,
# excluding *.test.ts.
source_files="$(printf '%s\n' "$all_changed_files" | grep -E '^src/.*\.(ts|svelte)$' | grep -v '\.test\.ts$')"

if [ -z "$source_files" ]; then
  exit 0
fi

# If docs were touched anywhere in the same change set, assume the docs
# question has already been considered.
docs_files="$(printf '%s\n' "$all_changed_files" | grep -E '^docs/' || true)"
if [ -n "$docs_files" ]; then
  exit 0
fi

state_dir=".claude/hooks"
state_file="$state_dir/.docs-update-state"
mkdir -p "$state_dir"

hash_cmd=""
if command -v shasum >/dev/null 2>&1; then
  hash_cmd="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  hash_cmd="sha256sum"
fi

head_sha="$(git rev-parse HEAD 2>/dev/null)"

current_hash=""
if [ -n "$hash_cmd" ]; then
  current_hash="$(
    {
      printf '%s\n' "$source_files"
      printf 'HEAD:%s\n' "$head_sha"
      while IFS= read -r f; do
        [ -f "$f" ] && cat "$f"
      done <<<"$worktree_files"
    } | $hash_cmd | awk '{print $1}'
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
  echo "Docs reminder: this change set touches src/ but nothing under docs/src/."
  echo ""
  echo "If this change is user-facing (new/changed settings, reminder syntax, UI"
  echo "behavior, notification behavior), update the VuePress docs before finishing:"
  echo "  - Settings reference: docs/src/setting/README.md"
  echo "  - Guides: docs/src/guide/*.md"
  echo ""
  echo "If this change is genuinely internal (refactor, CI, types, tests), briefly"
  echo "state that reasoning to the user and finish. This reminder fires once per"
  echo "change state and will not block again until the sources or commits change"
  echo "further."
} >&2
exit 2
