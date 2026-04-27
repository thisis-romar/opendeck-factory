---
title: "GitHub Projects v2 Workflow Management"
description: Enabling and configuring built-in project workflows and custom event handlers
lastmod: 2026-04-27T00:00:00Z
created: 2026-04-26T00:00:00Z
---

# Playbook: Workflow Management

## Current workflow state (confirmed 2026-04-26)

8 of 11 workflows are ON. Workflows 9–11 are not needed.

| Workflow | State | Effect |
|---|---|---|
| Item closed | ON | → Status: Done |
| Pull request merged | ON | → Status: Done |
| Item added to project | ON | → Status: Todo |
| Auto-add sub-issues to project | ON | adds sub-issues to project when parent added |
| Auto-archive items | ON | archives items in Done for 14+ days |
| Auto-close issue | ON | closes issue when PR merged with Closes keyword |
| Pull request linked to issue | ON | links PR to issue sidebar |
| **Auto-add to project** | ON | adds new issues/PRs from opendeck-factory matching `is:issue,pr` |
| Code changes requested | OFF | not needed |
| Code review approved | OFF | not needed |
| Item reopened | OFF | not needed |

## Auto-add to project — filter config

Currently scoped to `thisis-romar/opendeck-factory` repo with filter `is:issue,pr`.

For multi-repo coverage (stream-deck-catalog, opendeck-planning), create **additional** Auto-add workflows — one per repo. The filter box does NOT accept `repo:` qualifiers; the repo is selected via a separate pill in the UI.

## Automation script

```bash
npm run workflows:toggle   # runs scripts/gh-toggle-workflows.mjs --headed
```

The script enables the two OFF-by-default workflows (Auto-archive, Auto-add) and configures the Auto-add filter. Re-run after project reset or if workflows are accidentally disabled.

## GitHub Workflows UI gotchas (2026)

1. **Viewing mode** — clicking a workflow opens it read-only. Must click **Edit** to reveal the save button.
2. **Save button** — "Save and turn on workflow" (not a toggle switch). Use `page.getByRole('button', { name: /save and turn on workflow/i })`.
3. **Auto-add filter** — the text input does not accept `repo:` qualifiers. Use `is:issue,pr` only; the repo is set via the repo-selector pill.
4. **Workflow count** — `Workflows N` in the header shows how many are enabled. Expect 8 after running the toggle script.

## Manual steps

Navigate to: `github.com/users/thisis-romar/projects/4/workflows`

To enable a disabled workflow:
1. Click it in the left sidebar
2. Click **Edit**
3. Adjust filter if needed
4. Click **Save and turn on workflow** (green button, top-right)

---

## Custom event handlers (Actions-based)

These jobs live in `.github/workflows/project-sync.yml` and supplement the built-in workflows:

| Job | Trigger | Script | What it does |
|---|---|---|---|
| `triage` | `issues.opened` | `gh-triage-new-issue.mjs` | Add to project #4; set Status=Todo, Area, Priority from form body |
| `pr-status` | `pull_request.*` (not `closed`) | `gh-sync-pr-status.mjs` | Draft PR → In Progress; non-draft → In Review on closing issues |
| `issue-reopened` | `issues.reopened` | `gh-sync-reopen.mjs` | Revert Status: Done → Todo |
| `sync` | all events + 6h cron | `gh-project-sync.js` | Idempotent manifest backfill |

The `pr-status` job fires on: `opened`, `reopened`, `ready_for_review`, `converted_to_draft`. It reads `closingIssuesReferences` (Closes / Fixes keywords + sidebar-linked issues). Skips any issue already at Done.

### Dry-run testing

```bash
GH_PR_NUMBER=24 node scripts/gh-sync-pr-status.mjs --dry-run
GH_ISSUE_NUMBER=23 node scripts/gh-sync-reopen.mjs --dry-run
# or via npm:
npm run pr-status:dry
npm run reopen:dry
```

---

## Multi-repo Auto-add (catalog + planning)

**Current state (confirmed 2026-04-27 via Playwright probe):**

The repo picker inside the Auto-add workflow is **single-select** — one repo per workflow instance. The `...` kebab on the sidebar item shows a **"Duplicate workflow"** option to create additional instances, but it is **greyed out** with the message:

> *"Maximum number of auto-add workflows reached. Delete a workflow or upgrade your plan to continue."*

**GitHub free plan allows only 1 Auto-add workflow per project.** The existing workflow covers `opendeck-factory` only.

### To cover all 3 repos: upgrade plan

1. Upgrade at `github.com/settings/billing` (Team or Enterprise plan removes the Auto-add limit)
2. Run `npm run workflows:toggle` — the script handles the rest:
   - Detects if Duplicate is disabled and logs a clear warning
   - Once unblocked, clicks `...` → Duplicate → changes repo → saves for each extra repo

### Probe mode (to re-verify state after plan change)

```bash
npm run autoadd:probe      # opens dropdown + kebab menu, screenshots without saving
```

Inspect:
- `.gh-workflows-debug/probe-autoadd-dropdown.png` — repo picker contents
- `.gh-workflows-debug/probe-kebab-menu.png` — whether Duplicate is still greyed out

### Manual fallback (once plan upgraded)

1. Navigate to `github.com/users/thisis-romar/projects/4/workflows`
2. Hover **Auto-add to project** → click **`...`** → **Duplicate workflow**
3. In the duplicate: click repo pill → select `stream-deck-catalog` → set filter `is:issue,pr` → **Save and turn on workflow**
4. Repeat step 2–3 for `opendeck-planning`

### Known gotcha: repo picker is single-select

The picker opens with "Select a repository" and "Items will be filtered as you type" (search input). Clicking a repo **replaces** the current selection — it does NOT add a second repo. One Auto-add instance = one repo.
