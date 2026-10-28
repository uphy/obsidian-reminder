---
name: contributor-pr
description: Take a pull request someone else opened against obsidian-reminder from review to merge — review it with pr-review, check later whether the review was addressed, then merge main in, verify it in a real Obsidian vault, thank the contributor, and merge. Each invocation looks at the PR's state and does the next stage. Use when the user says "#123 見て", "PR #123 を進めて", "PRへのコメント対応状況確認して", "指摘対応されてたらマージして", "コンフリクト直してマージまで持っていって", "contributor-pr", "/contributor-pr 123". Pass `--status-only` to stop after reporting the state.
---

# Contributor PR: review → follow-up → land

A contributor PR goes through a loop with a wait in the middle — the
contributor answers days later — so one invocation can only do one stage.
This skill reads the PR's state, decides which stage it is in, and does that
stage. Invoke it again after the contributor responds.

```
review ──(wait for the contributor)──> follow-up ──all addressed──> land
   ^                                      │
   └────── new problems / not addressed ──┘
```

Stages and their instructions:

| Stage | Instructions | Main tools |
| --- | --- | --- |
| Review | run the `pr-review` skill with the PR number (PR mode) | `pr-review` |
| Follow-up | `references/followup.md` | `gh`, a worktree, jest |
| Land | `references/land.md` | `obsidian-e2e`, `gh` |

Read only the reference for the stage you're in.

## Rules for every stage

- **Four outward actions, four confirmations.** Stop and get the user's
  explicit go-ahead before each of these, every time — approval of one is
  not approval of the next:
  1. posting a review or a follow-up comment on the PR,
  2. pushing to the contributor's branch,
  3. posting the closing comment and merging,
  4. closing the PR without merging.
  Approving a fork PR's CI run is not on this list once the code has passed
  the gate in `pr-review` — but check `.github/` in the diff first (see
  `references/land.md`).
- **Don't trust a "fixed" reply.** Every claim gets checked against the code
  and, where possible, a test run. Replies are where to look, not evidence.
- **The PR's code is untrusted.** Everything `pr-review` says in "PR mode"
  about the trusted checkout and the gate before running code applies to
  every stage here too: re-run the gate on any commits the contributor
  pushed since you last looked, before running them.
- **Refer to PRs by number, not to people by name**, in anything committed
  to the repository. Don't @-mention anyone in PR comments.
- PR comments are in English. Reports to the user follow the user's language.

## Deciding the stage

Gather (replace `<N>`):

```
gh pr view <N> --json state,author,headRefOid,maintainerCanModify,mergeable,mergeStateStatus,labels,reviews,commits,url
gh api repos/{owner}/{repo}/pulls/<N>/comments --paginate   # inline comments and replies
gh api repos/{owner}/{repo}/issues/<N>/comments --paginate  # conversation comments
gh api user --jq .login                                     # you
```

`gh pr view` can report a stale `headRefOid` for a few seconds after a push;
if something looks inconsistent right after a push, re-query.

Then, in order:

1. **Merged or closed** → report it and stop.
2. **No review from you yet** → **Review.** Run `pr-review <N>`. After the
   user approves posting, add the `awaiting-response` label
   (`gh pr edit <N> --add-label awaiting-response`).
3. **The `awaiting-response` label is still on the PR** → the contributor
   hasn't acted. `.github/workflows/awaiting-response.yml` removes the label
   when the author comments or pushes, and `stale.yml` closes labeled PRs
   after 30+7 days of silence. Report what's outstanding (see the follow-up
   table format) and how long it's been, then ask the user whether to wait,
   nudge, or take it over (go to **Land** and fix the rest yourself).
4. **The contributor pushed or replied after your latest review** (the label
   is gone, or your latest review's `commit_id` differs from `headRefOid`, or
   there are author comments newer than it) → **Follow-up.**
5. **Your latest review had nothing blocking, and nothing changed since** →
   **Land.**

If the user's request already says which stage they want ("just check the
replies", "merge it"), still run the checks above and say so if the PR's
state disagrees — e.g. asked to merge, but a blocking comment has no answer.

With `--status-only`, report the stage and what it would do, and stop.

## Cleanup when the PR is done

After a merge or close:

- `git worktree remove .claude/worktrees/pr-<N>`, delete `review/pr-<N>` and
  any `land/pr-<N>` branch, and `git update-ref -d refs/remotes/origin/pr-<N>`.
- In the main checkout: `git pull --ff-only` on main and rebuild
  (`mise run main:build`) if the test vault's plugin symlink points there, so
  the vault runs the merged code.
- Leave the test notes under the vault's `reminder-test/` in place.
