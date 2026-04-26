---
title: "Dates & Insights Audit — 2026-04-26"
type: audit
captured_at: 2026-04-26
---

# Dates & Insights Audit

## Milestone Date Backfill (Phase 13)

**Script:** `scripts/gh-set-milestone-dates.mjs`
**Run:** `npm run dates:backfill` (idempotent; `--force` to overwrite existing)

**Result (2026-04-26):**
- Updated: **99 open project items** with Start Date + Target Date
- Skipped: 2 (already had dates)
- No milestone / Future: 5 (left blank intentionally)

**Milestone → date bands applied:**

| Milestone | Start Date | Target Date |
|---|---|---|
| v2.3.0 | 2026-04-27 | 2026-05-15 |
| v2.4.0 | 2026-05-16 | 2026-06-30 |
| v2.5.0 | 2026-07-01 | 2026-08-15 |
| Catalog-v1 | 2026-04-27 | 2026-06-01 |
| Catalog-v2 | 2026-06-02 | 2026-09-15 |
| v3.0.0 | 2026-08-16 | 2026-10-01 |
| v3.1.0 | 2026-10-02 | 2026-12-15 |

Items with no milestone or Target=Future are left without dates (appear as unscheduled in the roadmap).

Previously, only 18 **completed** items had dates (from `scripts/gh-set-dates.mjs`, which derived dates from git history). This backfill adds all **open** items.

**Date field IDs:**
- Start Date: `PVTF_lAHODNwyZM4BVh2azhRChJQ`
- Target Date: `PVTF_lAHODNwyZM4BVh2azhRChJU`

---

## Insights Charts Created (Phase 12)

**Script:** `scripts/gh-create-insights.mjs`
**Run:** `npm run insights` (idempotent — skips charts that already exist by name)

**3 charts live on project #4 Insights tab:**

| Chart | Type | X axis | Group by | Filter |
|---|---|---|---|---|
| Burn-up per Milestone | Line (Historical) | Time | Status | `milestone:v2.3.0` |
| Status by Area | Stacked bar (Current) | Area | Status | _(none)_ |
| Priority Distribution | Bar (Current) | Priority | _(none)_ | `-status:Done` |

**DOM patterns (2026 UI):**
- Configure panel = right sidebar; Layout + X-axis + Y-axis dropdowns + "Save to new chart"
- Rename = pencil button → `[role="dialog"]` → fill input → click Save in dialog
- X-axis options: `Time` (Historical), `Area`, `Priority`, `Status`, `Target`, `Revenue Impact`, `Size`, `Sprint`, `Milestone`, etc.
- Layout options: `Bar`, `Column`, `Line`, `Stacked area`, `Stacked bar`, `Stacked column`

---

## views:fix Now Chains Roadmap Date Fix

`npm run views:fix` was updated to chain `gh-fix-roadmap-view.mjs` automatically:

```json
"views:fix": "node scripts/gh-create-views.mjs --reapply --headed && node scripts/gh-fix-roadmap-view.mjs"
```

This prevents the recurring "Welcome to Roadmap!" reset that occurred every time `views:fix` navigated to view #13.

---

## Workflow State (confirmed 2026-04-26)

8 of 11 workflows are ON:

| Workflow | State |
|---|---|
| Auto-add sub-issues to project | ON |
| Auto-archive items | ON |
| Auto-close issue | ON |
| Item added to project | ON |
| Item closed | ON |
| Pull request linked to issue | ON |
| Pull request merged | ON |
| Auto-add to project | ON (filter: `is:issue,pr`, repo: opendeck-factory) |
| Code changes requested | OFF |
| Code review approved | OFF |
| Item reopened | OFF |
