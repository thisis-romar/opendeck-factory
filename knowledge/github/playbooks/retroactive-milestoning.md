---
title: "Retroactive Milestoning"
description: How to assign past closed issues to historical milestones when releases shipped without proper milestone setup
lastmod: 2026-04-24T00:00:00Z
created: 2026-04-24T00:00:00Z
---

# Playbook: Retroactive Milestoning

## When to use

- A release shipped (tag + GH release) but the GitHub milestone was never created
- Closed issues need to be bucketed into a past version for burndown/reporting
- PR body was missing `Closes #N` keywords and now the issues are already closed

## Step 1 — Create the backdated milestone

```bash
# Create a CLOSED milestone with a past due_on date
gh api repos/{owner}/{repo}/milestones \
  -X POST \
  -F title="v2.1.0" \
  -F state="closed" \
  -F description="MCP server + Claude Code plugin (2026-04-22)" \
  -F due_on="2026-04-22T23:59:59Z"
```

`due_on` accepts past dates. Close the milestone immediately (`state: closed`) so release automation tooling (release-please, git-cliff) excludes it from "upcoming" scans.

## Step 2 — Assign closed issues to the milestone

`gh issue edit --milestone` **does not work on closed issues** — GitHub blocks milestone edits on closed state. Use the REST PATCH instead:

```bash
# Get milestone number first
MILESTONE_NUM=$(gh api repos/{owner}/{repo}/milestones \
  --jq '.[] | select(.title=="v2.1.0") | .number')

# Assign via REST PATCH (works on closed issues)
gh api repos/{owner}/{repo}/issues/{N} \
  -X PATCH \
  -F milestone=$MILESTONE_NUM
```

For bulk assignment:

```bash
for ISSUE in 3 8 10; do
  gh api repos/thisis-romar/opendeck-factory/issues/$ISSUE \
    -X PATCH \
    -F milestone=4
  echo "Milestoned #$ISSUE"
done
```

**Note:** `-X PATCH` requires PowerShell on Windows (Git Bash rewrites `/repos/...` as a filesystem path). Use the PowerShell tool or prefix with `MSYS_NO_PATHCONV=1`.

## Step 3 — Add retroactive Closes comments

GitHub won't rewrite issue close events when you edit an old PR body, but adding a comment on each issue links it visually in the sidebar:

```bash
gh issue comment 3 --repo {owner}/{repo} \
  --body "Shipped in PR #2 (v2.1.0, 2026-04-22). Retroactive link — Closes keyword was missing from the PR body."
```

Then edit the PR body to add `Closes #N` keywords:

```bash
OLD_BODY=$(gh pr view 2 --json body -q .body)
gh pr edit 2 --repo {owner}/{repo} \
  --body "$OLD_BODY

---

**Retroactive linkage (added 2026-04-24):** Closes #3, Closes #8, Closes #10"
```

**Critical:** editing the PR body does NOT re-trigger close events on the issues — they stay closed with their original timestamps. The edit only updates the sidebar linkage display.

## Step 4 — Verify

```bash
# All milestones exist
gh api repos/{owner}/{repo}/milestones?state=all \
  --jq '.[] | {number, title, state}'

# Closed issues have milestone assigned
gh api repos/{owner}/{repo}/issues?state=closed \
  --jq '.[] | {number, title, milestone: .milestone.title}'
```

## Worked Example — OpenDeck v2.0.0–v2.2.0

In the 2026-04-24 audit, milestones v2.0.0, v2.1.0, v2.2.0 were missing. The following 12 closed issues were retroactively assigned:

| Issue | Milestone |
|-------|-----------|
| #1 | v2.0.0 |
| #3, #8, #10 | v2.1.0 |
| #4, #5, #6, #7, #9, #11, #12, #16 | v2.2.0 |

PR #2 body was edited to add `Closes #3, #8, #10`. PR #24 was edited to drop `Closes #16` (issue already closed). Comments were added to each closed issue.

## Caveats

- **Past due_on dates** may show as "overdue" in some GitHub UI views for closed milestones. This is cosmetic — it does not affect issue state.
- **`gh issue edit --milestone` on closed issues** silently succeeds but doesn't actually set the milestone (GitHub API quirk). Always use REST PATCH.
- **Force-push to inject Closes keywords** into a merged commit is possible but destructive and requires `--force` on a protected branch. Never do this — retroactive PR body edits achieve the same visual result safely.
