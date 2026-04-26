---
title: "Views + Sub-Issue Hierarchy Audit — 2026-04-26"
type: audit
captured_at: 2026-04-26
---

# Views + Sub-Issue Hierarchy Audit

## View State (as of 2026-04-26)

| # | View Name | Layout | Notes |
|---|---|---|---|
| 1 | Roadmap — By Target | Roadmap | Existing — groups by Target field |
| 2 | Board — By Status | Board | Existing |
| 3 | Board — By Area | Board | Existing |
| 4 | Marketplace | Table | Filter: area:Marketplace |
| 5 | Active Work | Table | Filter: -status:Done |
| 13 | Roadmap — By Target Date | Roadmap | **Newly created** — Start Date + Target Date configured |

**Still missing (3 views to create):** Revenue — By Impact, Current Sprint, Blocked.
Run `npm run views:headed` to create them. The post-creation navigation fix has been applied to `scripts/gh-create-views.mjs`.

## Roadmap View Date Fields Gotcha

GitHub's roadmap view shows "Welcome to Roadmap! Your project needs at least one date or iteration field" on first open. This is not an error — it's a first-run prompt to configure which date fields to use for the bar start/end.

**How to configure via Playwright (DOM-confirmed 2026-04-26):**

The "Date fields" button has `aria-label="Select date fields"`. The dropdown is a `[role="menu"]` with `[role="menuitemradio"]` items in this fixed order:

```
Index 0: Start Date        (start slot — use "Start Date" field)
Index 1: Target Date       (start slot — use "Target Date" field)
Index 2: Sprint start      (start slot — use Sprint iteration)
Index 3: No start date     (start slot — no field, default selected)
Index 4: Start Date        (target slot — use "Start Date" field)
Index 5: Target Date       (target slot — use "Target Date" field)
Index 6: Sprint end        (target slot — use Sprint iteration end)
Index 7: No target date    (target slot — no field, default selected)
```

To set Start Date → "Start Date" field, Target Date → "Target Date" field:
```javascript
await page.locator('[role="menuitemradio"]').nth(0).click({ force: true }); // start
await page.locator('[role="menuitemradio"]').nth(5).click({ force: true }); // target
```

Script: `scripts/gh-fix-roadmap-view.mjs`

## View Rename Race Condition

`scripts/gh-create-views.mjs` creates views correctly but the rename step can lose the commit if the script navigates away too fast. The view ends up named "View N" (sequential GitHub auto-name). Fix applied 2026-04-26: added `page.goto(PROJECT_URL)` + 3s settle delay after each creation so rename is committed before the next view is attempted.

If a "View N" ghost appears:
1. The script auto-detects and deletes it (step 3.5 ghost cleanup)
2. Then recreates with the correct name on the next run
3. Or use `scripts/gh-fix-roadmap-view.mjs` for targeted repair

## Sub-Issue Hierarchy (Phase 10 — 2026-04-26)

### Status
**Epics defined, children mapped, script authored — NOT YET RUN.**

Script: `scripts/gh-link-subissues.mjs`
Manifest: `scripts/component-epics.json` (14 epics)
Children: `scripts/component-inventory.json` (80 entries, all `parent_title` populated)

### Epic structure (14 epics: 3 reused + 11 new)

| # | Epic | Reuse? | Target | Children count |
|---|---|---|---|---|
| 1 | Catalog v1 — VS Code profile pack | #19 | Catalog-v1 | 3 (#70-72) |
| 2 | Agentic pipeline v1 — Agents 1+2 | #20 | v2.3.0 | 5 (#75, #103-106) |
| 3 | Pro tier — hosted icon generation | #22 | v3.0.0 | 2 (#40, #51) |
| 4 | MCP server v2.3.0 — 9 tools shipped | NEW | v2.3.0 | 9 (#41-49) |
| 5 | MCP distribution | NEW | v2.4.0 | 2 (#50, #52) |
| 6 | Engine core API surface | NEW | v2.3.0 | 9 (#31-39) |
| 7 | DevOps foundation — workflows + scripts | NEW | v2.3.0 | 16 (#73,74,76-78,89-91,95-97,99-102,107) |
| 8 | Repo hygiene — branch protection + templates | NEW | v2.3.0 | 6 (#79,80,92-94,98) |
| 9 | Skills + subagents v2.3.0 | NEW | v2.3.0 | 5 (#53-57) |
| 10 | Claude Code plugin packaging | NEW | v2.4.0 | 6 (#58-63) |
| 11 | Distribution channels | NEW | v2.4.0 | 5 (#64-68) |
| 12 | Marketplace listings | NEW | v2.4.0 | 3 (#108-110) |
| 13 | Docs v2.3.0 | NEW | v2.3.0 | 5 (#81-85) |
| 14 | Licensing — FSL + trademark | NEW | Future | 3 (#86-88, reorder includes #98) |

**Duplicates to close (run before `epics:link`):**
- Close #17 → duplicate of #79 (commitlint + husky)
- Close #18 → duplicate of #80 (CHANGELOG automation)
- Close #69 → duplicate of #19 (Catalog v1 epic)

**To run:** `npm run epics:dry` then `npm run epics:link`

### addSubIssue mutation

```graphql
mutation {
  addSubIssue(input: {
    issueId: "<PARENT_NODE_ID>"
    subIssueId: "<CHILD_NODE_ID>"
  }) {
    issue { number title }
  }
}
```

Requires GraphQL node IDs (not issue numbers). The linking script resolves these by fetching all open issues and building a title→{number,id} map.
