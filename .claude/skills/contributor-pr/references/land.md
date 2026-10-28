# Land: merge master in, verify, thank, merge

Goal: the PR merges with its number and its author's credit intact, on top
of current master, after you've seen it work in a real vault.

## 1. Preconditions

- Follow-up found every point addressed (or the user chose to take the rest
  over).
- `gh pr view <N> --json maintainerCanModify` is `true`. If not, you can't
  push to the contributor's branch: stop, and ask the user whether to ask
  the contributor to rebase or enable "Allow edits by maintainers".
- The PR head has passed the `pr-review` gate, including any commits pushed
  since.

## 2. Merge master into the PR branch

In the worktree, on a branch for the landing work:

```
git -C .claude/worktrees/pr-<N> checkout -B land/pr-<N> origin/pr-<N>
git -C .claude/worktrees/pr-<N> merge --no-ff origin/master
```

Merge, don't rebase: rebasing rewrites the contributor's commits and needs a
force-push to their branch.

For each conflict:

- Work out what each side meant, not just which lines it touched. The usual
  shape is that master added a hook or a rule and the PR changed the code
  the hook replaced — #361 vs #377 was `todo.isChecked(registry)` (PR) vs
  `this.isDone(todo, parsed)` (master), resolved by keeping master's call and
  making the base `isDone()` use the registry.
- **Add a test for the combination** — one that would fail if you had
  taken either side alone. The PR's tests and master's tests each pass on
  their own side; nothing covers the two together until you write it.
- Write the resolution into the merge commit message (what conflicted, how,
  and why).

Then `mise run main:lint:fix` (zero ESLint warnings) and
`mise exec -- npx jest`.

## 3. Check the docs against the merged behavior

The PR's docs describe the PR's behavior; master's docs describe master's.
After a merge that combines them, read the docs that touch the feature and
the conflict area:

```
grep -rn -i "<feature words>" docs/src README.md
```

Look for statements the combination made wrong or incomplete, and for guide
pages that should point to a new setting. Commit doc fixes separately from
the merge (`docs: …`). In #361 the settings page was right for the PR alone,
but said nothing about the done/cancelled-date rule master had added, and
neither guide mentioned the new setting.

## 4. Verify in Obsidian

If the PR touches `src/plugin/`, `src/ui/`, or parsing visible in the vault,
verify in the test vault with the `obsidian-e2e` skill against the
worktree's build (`mise exec -- npm run build` in the worktree, then the
"Swapping the plugin under test without restarting" procedure there).

Pick scenarios from the review itself:

- every reproduction you posted in the review, now expected to behave,
- the behavior the conflict resolution combined,
- one plain case per format the PR touches (Done on an ordinary `- [ ]`),
  so a regression in the common path doesn't hide behind the edge cases.

Put the notes under `reminder-test/pr-<N>/` in the vault. Report each
scenario as expected/actual. Anything you couldn't drive (system
notifications, a toast that disappears when its file changes) — say how you
checked it instead, or hand it to `manual-verify`.

Restore the vault's plugin symlink to the main checkout when done.

## 5. Push to the contributor's branch — confirm first

Show the user the commits you're adding (`git log --oneline origin/pr-<N>..HEAD`)
and get approval. Then:

```
repo=$(gh pr view <N> --json headRepositoryOwner,headRepository --jq '.headRepositoryOwner.login+"/"+.headRepository.name')
branch=$(gh pr view <N> --json headRefName --jq .headRefName)
git -C .claude/worktrees/pr-<N> push "https://github.com/$repo.git" HEAD:"$branch"
```

No force-push, ever.

## 6. CI on a fork PR

Fork PR runs of `pr.yml` (workflow "CI", job `test`) wait for approval:

- `gh api "repos/{owner}/{repo}/actions/runs?head_sha=<sha>"` shows the CI run
  with `conclusion: action_required`. An older run that "failed" with zero
  jobs is the same thing, timed out or rejected.
- Before approving, check that the PR doesn't change `.github/` (the gate
  already stopped on it if it did, and the user saw it).
- Approve: `gh api -X POST repos/{owner}/{repo}/actions/runs/<id>/approve`,
  then `gh run watch <id> --exit-status`.

master's branch protection requires the `test` check; nothing merges
without it.

## 7. Label, comment, merge — confirm first

- Add a release-notes label if missing (`enhancement` for features, `bug`
  for fixes, …).
- Draft the closing comment in English and show it to the user with the
  merge:
  - thank the contributor for the work and for addressing the review,
    naming the parts that landed well; apologise for delays on your side,
  - what you added and why: the merge and its conflict resolution, the
    combination test, doc changes — with commit shas,
  - what you verified in the vault, as a short list of scenarios,
  - no @-mentions.
- After approval: `gh pr comment <N> --body-file <file>`, then
  `gh pr merge <N> --merge` (this repository merges with merge commits).
- Confirm `gh pr view <N> --json state,mergeCommit`.

Then do the cleanup in `SKILL.md`. If verification turned up a pre-existing
bug unrelated to the PR, tell the user and offer to file an issue — don't
fold it into the PR.
