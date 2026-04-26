---
title: "GitHub Projects v2 Workflow Management"
description: Enabling and configuring built-in project workflows
lastmod: 2026-04-26T00:00:00Z
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
