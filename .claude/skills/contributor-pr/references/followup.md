# Follow-up: check whether the review was addressed

Goal: for every point you raised, know whether it is fixed, partly fixed, or
not addressed — from the code, not from the replies — and review whatever
the contributor added on top.

## 1. Collect every point you raised

Three places, and the third is the one that gets missed:

- inline comments (`pulls/<N>/comments` with `in_reply_to_id == null`, by
  you) and the replies under each (`in_reply_to_id == <id>`),
- conversation comments (`issues/<N>/comments`) — contributors often answer
  everything in one summary comment instead of per thread,
- **review bodies** (`reviews[].body`) — requests that aren't tied to a diff
  line live only here ("could you add a docs section…").

Make one list. Each item: where you raised it, what you asked for.

## 2. Bring the PR head in

```
git fetch -q origin master +pull/<N>/head:refs/remotes/origin/pr-<N>
git log --oneline <your latest review's commit_id>..origin/pr-<N>
```

Use the worktree `.claude/worktrees/pr-<N>` as described in `pr-review`'s PR
mode (create it, or reset it if it's clean). If the contributor rebased,
`<commit_id>..origin/pr-<N>` is meaningless — compare against
`git merge-base origin/master origin/pr-<N>` and treat the whole PR as new
code for the gate.

Run the `pr-review` gate (step 3 of its PR mode) on the commits added since
your review **before** running anything.

## 3. Check each point against the code

For each item:

- find the commit that claims to address it (the reply usually names it;
  otherwise `git log -p` the touched file),
- read the change and check it actually covers your scenario — not a
  neighbouring one,
- where your original comment had a reproduction, rerun it, and keep the
  output.

Then run the suite in the worktree: `mise exec -- npx jest`,
`mise exec -- npx eslint .` (zero warnings — CI fails on warnings, not just
errors), `mise exec -- npx tsc --noEmit`.

## 4. Review what's new

If the contributor added more than fixes, run `pr-review <N>` again — the
workflow takes the merge-base as `base`, so it re-reads the whole PR; tell
the user that's what it does. For a few small fix commits, reading them
yourself is enough.

## 5. Find what blocks merging

- Conflicts with master: `git merge-tree --write-tree --name-only origin/master origin/pr-<N>`.
- CI: `gh pr checks <N>`. A run that "failed" with zero jobs, or a run in
  `action_required`, is a fork run waiting for approval, not a code failure
  (see `land.md`).
- Label: every PR needs one of `breaking-change`, `enhancement`, `bug`,
  `documentation`, `chore` for the release notes.
- Threads with no reply.

## 6. Report

To the user, one table:

| Point | Where raised | Addressed by | What you checked | Result |
| --- | --- | --- | --- | --- |

followed by the blockers from step 5. Then one of:

- **Everything addressed, nothing new** → propose moving to Land. If the
  only blockers are conflicts, CI approval, or a label, Land handles them;
  ask whether to take those on yourself rather than sending the PR back.
- **Something not addressed or newly broken** → draft a follow-up comment
  (English; quote real output; keep it to what's still open, and thank them
  for what was fixed). Post it only after approval, as replies in the
  existing threads where a thread exists, and add the `awaiting-response`
  label again.
