---
name: pre-pr-review
description: Review the current branch of obsidian-reminder from five repository-specific perspectives in parallel (CodeMirror/Obsidian lifecycle, reminder format, time and notifications, Obsidian plugin guidelines, testability), verify every finding adversarially, and auto-fix the confirmed ones with one commit each in the current worktree. Use before opening a PR, or when the user says "PR前にレビューして", "レビューして直して", "pre-pr-review", "/pre-pr-review". Pass `--no-fix` to only report.
---

# Pre-PR review with auto-fix

Runs the saved workflow `.claude/workflows/pre-pr-review.js`. Invoking this
skill is the user's opt-in to running that multi-agent workflow (about 11
agents per run, plus up to 5 per re-review round).

The perspective, verifier, and fixer roles are defined in `.claude/agents/`
(`review-*.md`). Edit those files to tune what each perspective looks for.

## Steps

1. **Check where you are.** All of these must hold, otherwise stop and tell
   the user which one failed:
   - The current directory is a git worktree of this repository on a branch
     other than `master` (`git rev-parse --abbrev-ref HEAD`). The fixer
     commits to the current branch, so never run this on `master`.
   - The working tree is clean (`git status --porcelain` is empty). The fixer
     refuses to start otherwise; commit or discard first.
   - The branch has commits to review:
     `git fetch -q origin master && git merge-base origin/master HEAD` gives
     the base, and `git log --oneline <base>..HEAD` is not empty.
   - `node_modules` exists (the fixer runs lint and jest). If not, run
     `mise exec -- npm install` — not a bare `npm install`.
2. **Run the workflow** with the Workflow tool:
   `name: "pre-pr-review"`, `args: { base: "<merge-base sha>", fix: <false if --no-fix, else true> }`.
3. **Report the result** to the user from the returned object:
   - fixed: one line each — perspective, `file:line`, what was fixed, commit
     sha.
   - reverted / skipped: what the problem is and why it wasn't fixed — these
     need the user's judgment.
   - plausible: findings the verifier couldn't confirm or refute; list them
     as items to check by hand.
   - `notReReviewed`, if present: the commit range that no perspective has
     re-read yet.
   - `refutedCount`: just the number.
   Then show `git log --oneline <base>..HEAD` so the user can see the new
   commits.
4. **Point to runtime verification.** If any fix commit touched `src/plugin/`
   or `src/ui/`, say that automated checks don't render anything and suggest
   `manual-verify` (or `obsidian-e2e` for what it can automate) before the
   PR.

Never push or open a PR from this skill; the user decides that after reading
the report.
