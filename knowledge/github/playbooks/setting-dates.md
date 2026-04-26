---
title: "Setting Dates on Project Items"
description: How to populate Start Date and Target Date fields for roadmap visibility
lastmod: 2026-04-26T00:00:00Z
created: 2026-04-26T00:00:00Z
---

# Playbook: Setting Dates on Project Items

The `Roadmap — By Target Date` view requires `Start Date` and `Target Date` field values on each item to render timeline bars. There are two scripts for this.

## Script 1 — Historical dates (`gh-set-dates.mjs`)

**Purpose:** Sets Start + Target dates on **completed / closed** items from git history.

**Run:**
```bash
node scripts/gh-set-dates.mjs
```

**How it works:** Uses a hardcoded `DATE_MAP` (issue number → {start, end}) derived from commit timestamps and GitHub release dates. Only updates items in the map; all others are skipped.

**When to use:** After closing a new milestone / merging a PR — add the closed issue numbers to `DATE_MAP` and re-run.

---

## Script 2 — Milestone dates (`gh-set-milestone-dates.mjs`)

**Purpose:** Sets Start + Target dates on **open** items based on their GitHub milestone's due date.

**Run:**
```bash
npm run dates:dry       # preview without mutating
npm run dates:backfill  # apply
npm run dates:backfill -- --force  # overwrite existing dates
```

**How it works:**
1. Fetches all open project items with their current field values
2. For each item: looks up its milestone's title
3. Maps milestone → date band (hardcoded in script)
4. Sets `Start Date` = milestone sprint start, `Target Date` = milestone due date
5. Skips items that already have dates (unless `--force`)
6. Items with no milestone or Target=`Future` are left undated

**Milestone bands (as of 2026-04-26):**

| Milestone | Start Date | Target Date |
|---|---|---|
| v2.3.0 | 2026-04-27 | 2026-05-15 |
| v2.4.0 | 2026-05-16 | 2026-06-30 |
| v2.5.0 | 2026-07-01 | 2026-08-15 |
| Catalog-v1 | 2026-04-27 | 2026-06-01 |
| Catalog-v2 | 2026-06-02 | 2026-09-15 |
| v3.0.0 | 2026-08-16 | 2026-10-01 |
| v3.1.0 | 2026-10-02 | 2026-12-15 |

Update the `MILESTONE_TARGET` and `MILESTONE_START` maps in the script when milestones change.

**When to re-run:**
- After bulk-creating new issues (they start with no dates)
- After changing a milestone's due_on date
- After moving issues between milestones

---

## Date field IDs

From `.github/project-ids.json`:
- `start_date`: `PVTF_lAHODNwyZM4BVh2azhRChJQ`
- `target_date`: `PVTF_lAHODNwyZM4BVh2azhRChJU`

## GraphQL mutation

```graphql
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHODNwyZM4BVh2a"
    itemId: "<ITEM_NODE_ID>"
    fieldId: "PVTF_lAHODNwyZM4BVh2azhRChJU"
    value: { date: "2026-05-15" }
  }) { projectV2Item { id } }
}
```

Use `PVTF_lAHODNwyZM4BVh2azhRChJQ` for Start Date, `PVTF_lAHODNwyZM4BVh2azhRChJU` for Target Date.

## Roadmap view date field reset

The `Roadmap — By Target Date` view (view #13) loses its field config when Playwright navigates to it while the "Welcome to Roadmap!" dialog is active. Symptom: empty timeline, welcome dialog.

Fix: `node scripts/gh-fix-roadmap-view.mjs` (idempotent, ~10s). Also runs automatically as part of `npm run views:fix`.
