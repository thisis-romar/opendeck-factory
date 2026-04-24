---
title: "Revenue Tagging"
description: How to classify project items by Revenue Impact (Direct / Indirect / None) and how to read the Revenue — By Impact view
lastmod: 2026-04-24T00:00:00Z
created: 2026-04-24T00:00:00Z
---

# Playbook: Revenue Tagging

## The Revenue Impact Field

- Field: `Revenue Impact` (PVTSSF_lAHODNwyZM4BVh2azhRChIA)
- Type: SINGLE_SELECT
- Options: Direct (`7b7ee7fa`) | Indirect (`7259e310`) | None (`3dbad488`)

## Definitions

### Direct — `7b7ee7fa`

Work that **directly moves the $5K/month target**. A feature or fix that, when shipped, enables a paid customer to pay or upgrade.

Examples of Direct work:
- Catalog v1 release — customers pay for profiles
- Catalog billing/subscription harness — enables recurring revenue
- Plugin Pro tier — paid upgrade path from free engine
- MCP marketplace listing — gates paid Pro tier discovery
- Distribution: VS Code Marketplace listing — revenue channel

**Rule:** If the issue could appear in a pitch deck as "why you'd pay for this," it's Direct.

### Indirect — `7259e310`

Work that **enables or accelerates Direct work** but has no standalone revenue path.

Examples of Indirect work:
- Engine reliability improvements — catalog requires a solid engine
- MCP server stability — Pro tier depends on MCP
- CI/CD pipeline — faster iteration on Direct features
- Issue forms / project hygiene — reduces friction on roadmap execution
- Docs — lowers onboarding friction for paid contributors or freelancers

**Rule:** If shipping this makes a Direct issue faster, cheaper, or safer to ship — it's Indirect.

### None — `3dbad488`

Work with **no revenue bearing** — compliance, cleanup, or exploratory work that doesn't map to a paid feature.

Examples:
- FSL license annual review
- NOTICE file upkeep
- Exploratory research issues
- `v2.x.x` maintenance bugs in the free-tier engine

## How to Tag

When creating or triaging an issue:

```bash
gh project item-edit \
  --project-id PVT_kwHODNwyZM4BVh2a \
  --id ITEM_NODE_ID \
  --field-id PVTSSF_lAHODNwyZM4BVh2azhRChIA \
  --single-select-option-id 7b7ee7fa   # Direct
```

Or use the Revenue — By Impact view and edit inline via the table.

## Reading the "Revenue — By Impact" View

Layout: Table, grouped by Revenue Impact (Direct first).

How to read it:
- **Direct items In Progress** — these are the sprint's revenue bets. If more than 2 Direct items are Blocked, escalate.
- **Indirect items in Backlog** — identify which ones unblock the most Direct items. Pull those first.
- **None items** — should have a clear rationale (compliance, cleanup). If they're growing as a % of backlog, something is wrong.

A healthy sprint has Direct ≥ 40% of In Progress items. If it's < 25%, the sprint is too infrastructure-heavy.

## Cross-Field Analysis

Combine with Priority and Area to find the highest-leverage items:
- `Revenue Impact: Direct` + `Priority: P0-Critical` → must ship this sprint
- `Revenue Impact: Direct` + `Area: Catalog` → catalog release path items
- `Revenue Impact: Indirect` + `Area: Engine` → engine work that unblocks catalog

The Revenue — By Impact view lets you filter by status and see the full funnel from Backlog → Done sorted by revenue relevance.
