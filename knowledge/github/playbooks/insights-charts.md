---
title: "Insights Charts — OpenDeck Roadmap"
description: Configuration for the three standard Insights charts on project #4
lastmod: 2026-04-24T00:00:00Z
created: 2026-04-24T00:00:00Z
---

# Playbook: Insights Charts

GitHub Projects v2 Insights has no public API, but chart creation can be automated via Playwright CDP.

**Automated:** `npm run insights` (`scripts/gh-create-insights.mjs`) — creates all 3 charts and renames them.
**Manual:** Navigate to `github.com/users/thisis-romar/projects/4` → Insights tab. Each chart takes ~3 min to configure.

**DOM gotchas (2026):**
- Configure panel is a right sidebar (not dialog): Layout + X-axis + Y-axis dropdowns + "Save to new chart"
- Rename: pencil button opens `[role="dialog"]`; fill input; click dialog's Save button
- Delete: hover the sidebar link to show "Chart options" button; click → "Delete chart"
- Chart ordering is creation order (no drag-to-reorder). Delete and recreate to change order.

---

## Chart 1: Burn-up per Milestone

**Purpose:** Shows how many items are completed vs. total per milestone over time. The key signal is whether the slope of "Done" is steep enough to hit the milestone due date.

**Type:** Historical (time-series)

| Setting | Value |
|---|---|
| Chart type | Line |
| X axis | Date (week grouping) |
| Y axis | Count of items |
| Group by | Status |
| Filter | `milestone:v2.3.0` |

Create one chart per active milestone. Clone the chart and update the filter for `v2.4.0`, `Catalog-v1`, etc. as they become active.

**How to read it:**
- The gap between the "total" line and the "Done" line is the remaining work.
- If "Done" is flat and the due date is approaching, escalate.
- "Blocked" items appearing in the line indicate a stall in the pipeline.

---

## Chart 2: Status by Area

**Purpose:** Shows the current distribution of items across areas, stacked by status. Reveals which areas are piled in Backlog vs. actively In Progress.

**Type:** Current (snapshot)

| Setting | Value |
|---|---|
| Chart type | Stacked bar |
| X axis | Area |
| Y axis | Count of items |
| Group by | Status |
| Filter | _(none)_ |

**How to read it:**
- A tall Backlog bar in Engine while Catalog has no In Progress items = unbalanced sprint.
- In Progress bars should match where the team is focused for the current sprint.
- Done bars accumulate over time and can be used to assess overall throughput.

---

## Chart 3: Priority Distribution

**Purpose:** Shows how many open items are at each priority level. A healthy backlog has most items at P2-Normal, with P0-Critical and P1-High representing the active sprint bet.

**Type:** Current (snapshot)

| Setting | Value |
|---|---|
| Chart type | Bar |
| X axis | Priority |
| Y axis | Count of items |
| Group by | _(none)_ |
| Filter | `-status:Done` |

**How to read it:**
- If P0-Critical is > 5 items, the project is in triage mode — re-prioritize immediately.
- If P1-High is > 30% of total open items, the priority ladder has inflated — reset.
- P3-Low items that never get touched should be closed as "not planned" on a quarterly basis.

---

## Refreshing charts

Charts update automatically when project items change. No manual refresh needed.

If a chart looks stale, try:
1. Add a filter and remove it (forces a re-query)
2. Reload the Insights tab (`Ctrl+Shift+R`)

---

## Chart ordering

GitHub displays charts in creation order. Recommended order: Burn-up → Status by Area → Priority Distribution. If you need to reorder, delete and recreate (no drag-to-reorder API or UI exists).
