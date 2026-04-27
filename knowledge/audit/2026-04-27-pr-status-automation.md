---
title: "PR Status Automation — 2026-04-27"
description: Gaps closed in GitHub project automation — PR→In Review, Draft→In Progress, reopen revert, multi-repo Auto-add docs
lastmod: 2026-04-27T00:00:00Z
created: 2026-04-27T00:00:00Z
---

# Audit: PR Status Automation (2026-04-27)

## Why

Investigation confirmed that 6 of 10 project automation scenarios were already working via built-in GitHub workflows and the existing `triage` + `sync` jobs. Four gaps remained:

1. PR opened (non-draft) → linked issues not moved to **In Review**
2. Draft PR opened → linked issues not moved to **In Progress**
3. Reopened issue stuck at **Done** instead of reverting to **Todo**
4. `stream-deck-catalog` and `opendeck-planning` repos not covered by Auto-add

## Changes made

### New scripts

| File | Purpose |
|---|---|
| `scripts/gh-sync-pr-status.mjs` | Read PR's `closingIssuesReferences`; set Status = In Review (non-draft) or In Progress (draft) |
| `scripts/gh-sync-reopen.mjs` | Read reopened issue's current Status; revert Done → Todo |

Both use `scripts/lib/gql.mjs` (`gql()` helper) and `.github/project-ids.json` for field/option IDs.

### Updated workflow: `.github/workflows/project-sync.yml`

- Expanded `pull_request.types` to include `ready_for_review` and `converted_to_draft`
- Added `pr-status` job (fires on all PR events except `closed`)
- Added `issue-reopened` job (fires on `issues.reopened`)

### Updated docs

- `knowledge/github/playbooks/workflow-management.md` — added "Custom event handlers" table and "Multi-repo Auto-add" manual steps

## Coverage after this change

| Scenario | Automated? | Mechanism |
|---|---|---|
| Issue opened → Todo + triage | ✅ | triage job |
| Issue closed → Done | ✅ | Built-in "Item closed" |
| PR merged (Closes #N) → Done | ✅ | Built-in "Pull request merged" |
| PR opened (non-draft) → In Review | ✅ | pr-status job |
| Draft PR opened → In Progress | ✅ | pr-status job |
| PR ready_for_review → In Review | ✅ | pr-status job |
| PR converted_to_draft → In Progress | ✅ | pr-status job |
| Reopened issue reverts from Done | ✅ | issue-reopened job |
| Sub-issues auto-add | ✅ | Built-in |
| 6-hour sweep / backfill | ✅ | sync job |
| Auto-add catalog + planning repos | ⚠️ Blocked — GitHub plan limit | Upgrade plan at github.com/settings/billing |

## Follow-up (2026-04-27): Multi-repo Auto-add — plan limit discovered

**Final understanding (confirmed via Playwright probe):**

The repo picker is **single-select** (confirmed by probe screenshot of the open dropdown). The `...` kebab on the "Auto-add to project" sidebar item shows **"Duplicate workflow"** but it is **greyed out** on the free plan with message:

> *"Maximum number of auto-add workflows reached. Delete a workflow or upgrade your plan to continue."*

**GitHub free plan = 1 Auto-add workflow per project.** `opendeck-factory` is covered; `stream-deck-catalog` and `opendeck-planning` cannot be added without a plan upgrade.

`scripts/gh-toggle-workflows.mjs` was updated to:
- `createAutoAddForRepo(page, repo, filter)` — hovers sidebar item → clicks `...` → finds Duplicate → **detects if disabled** and logs clear plan-limit warning → if enabled, clicks, sets repo (single-select picker), sets filter, saves
- `selectRepoInPill(page, repo)` — searches in picker and clicks the target repo
- `probeAutoAddDropdown(page)` — also probes the kebab menu and dumps `[role="menuitem"]` text
- `EXTRA_REPOS` constant and step 4 in `main()` for the full flow

When billing is upgraded: run `npm run workflows:toggle` — it will detect Duplicate is now enabled and create the 2 extra workflows automatically.

## Blocker note

All CI/Actions workflows currently fail due to an account billing issue (payment method needs updating at `github.com/settings/billing`). The script code is correct but won't execute until billing is resolved.
