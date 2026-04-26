---
title: "Sprint Planning"
description: How to run 2-week sprints using the Sprint iteration field on OpenDeck Roadmap project #4
lastmod: 2026-04-24T00:00:00Z
created: 2026-04-24T00:00:00Z
---

# Playbook: Sprint Planning

## Sprint Configuration

- Field: `Sprint` (PVTIF_lAHODNwyZM4BVh2azhRChJY)
- Type: ITERATION
- Cadence: 2-week sprints
- Start date: 2026-04-27 (first sprint)
- Duration: 14 days

GitHub automatically generates iteration titles (e.g., "Sprint 1", "Sprint 2") and manages the `@current`, `@previous`, `@next` aliases.

## Starting a Sprint

1. Open the "Current Sprint" view (Board layout, filtered `sprint:@current`).
2. Drag items from Backlog to In Progress — or use the command line:

```bash
# Move an item into the current sprint
gh project item-edit \
  --project-id PVT_kwHODNwyZM4BVh2a \
  --id ITEM_NODE_ID \
  --field-id PVTIF_lAHODNwyZM4BVh2azhRChJY \
  --iteration-id ITERATION_ID
```

To get the current iteration ID:

```bash
gh api graphql -f query='{
  node(id: "PVTIF_lAHODNwyZM4BVh2azhRChJY") {
    ... on ProjectV2IterationField {
      configuration {
        iterations { id title startDate }
      }
    }
  }
}'
```

3. Set Status to `In Progress` for items pulled into the sprint.

## Sprint Review Checklist

At the end of each 2-week sprint:

- [ ] All items with Status `Done` — close the issues
- [ ] Carry-over items — move to next sprint iteration or return to Backlog
- [ ] Update Status on anything that got Blocked
- [ ] Post a status update via `createProjectV2StatusUpdate`

## "Current Sprint" View

Configured as a Board layout with filter `sprint:@current`. Shows:
- Columns: Backlog → Todo → In Progress → In Review → Done
- Only items in the active iteration appear

## How the Status-Update Cron Uses Sprint

The `status-update.yml` Actions workflow fires on the 1st and 15th of each month (aligning with sprint cadence). It:
1. Counts items by Status for the current sprint
2. Derives `ON_TRACK` / `AT_RISK` / `OFF_TRACK` based on completion rate
3. Posts via `createProjectV2StatusUpdate`

## Iteration Filter Syntax

```
sprint:@current    # active sprint
sprint:@previous   # last sprint
sprint:@next       # upcoming sprint
sprint:"Sprint 3"  # specific sprint by title
```

These work in view filters and GitHub search syntax within the project.
