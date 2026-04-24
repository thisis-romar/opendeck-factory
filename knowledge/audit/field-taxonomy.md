---
type: reference
captured_at: 2026-04-24
source: GraphQL pre-flight queries on project PVT_kwHODNwyZM4BVh2a
---

# Project #4 Field Taxonomy

Canonical list of all 9 fields on OpenDeck Roadmap project #4. This is the authoritative point-of-truth for anyone writing `item-edit` mutations or field documentation.

Project ID: `PVT_kwHODNwyZM4BVh2a`

## Fields

### Status
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dtc`
- Type: SINGLE_SELECT
- Options:

| Name | ID | Color |
|------|----|-------|
| Todo | `f75ad846` | GRAY |
| In Progress | `47fc9ee4` | YELLOW |
| Done | `98236657` | GREEN |
| Backlog | `a9b4da7c` | PURPLE |
| In Review | `d550a360` | BLUE |
| Blocked | `81b534ec` | RED |

### Priority
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Du8`
- Type: SINGLE_SELECT
- Options:

| Name | ID | Color |
|------|----|-------|
| P0-Critical | `ac1c6265` | RED |
| P1-High | `2b3f7957` | ORANGE |
| P2-Normal | `d671e2b3` | YELLOW |
| P3-Low | `365e940f` | GRAY |

### Area
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9DvA`
- Type: SINGLE_SELECT
- Options:

| Name | ID |
|------|----|
| Engine | `edfd7714` |
| MCP | `af9547e7` |
| Skills | `e83a1002` |
| Marketplace | `1d59c6da` |
| Catalog | `acc0349e` |
| Docs | `6f2cabf6` |
| DevOps | `c7875317` |
| Plugin | `d5d0cdf9` |
| Distribution | `0e5e1d63` |
| Licensing | `65ef9548` |

### Target
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dv4`
- Type: SINGLE_SELECT
- Options:

| Name | ID |
|------|----|
| v2.0.0 | `cc258467` |
| v2.1.0 | `9fc5b34c` |
| v2.2.0 | `2fb2a68f` |
| v2.2.x | `330a1e30` |
| v2.3.0 | `b288508c` |
| v2.4.0 | `09176c83` |
| v2.5.0 | `0bfc3644` |
| v3.0.0 | `7a56148a` |
| v3.1.0 | `aa9b7019` |
| Catalog-v1 | `bed37432` |
| Catalog-v2 | `c749f808` |
| Future | `9b08c8c8` |

### Size
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhRChH8`
- Type: SINGLE_SELECT
- Options:

| Name | ID | Meaning |
|------|----|---------|
| XS | `cd6e339b` | < 1 day |
| S | `6e934628` | 1–3 days |
| M | `9d590ead` | 1 week |
| L | `f699cc0b` | 2 weeks |
| XL | `4e310e4c` | > 2 weeks |

### Revenue Impact
- Field ID: `PVTSSF_lAHODNwyZM4BVh2azhRChIA`
- Type: SINGLE_SELECT
- Options:

| Name | ID | Meaning |
|------|----|---------|
| Direct | `7b7ee7fa` | Moves the $5K/mo needle directly |
| Indirect | `7259e310` | Enables or accelerates Direct work |
| None | `3dbad488` | Not revenue-bearing |

### Start Date
- Field ID: `PVTF_lAHODNwyZM4BVh2azhRChJQ`
- Type: DATE

### Target Date
- Field ID: `PVTF_lAHODNwyZM4BVh2azhRChJU`
- Type: DATE

### Sprint
- Field ID: `PVTIF_lAHODNwyZM4BVh2azhRChJY`
- Type: ITERATION
- Config: startDate 2026-04-27, duration 14 days (2-week sprints)

## Mutation Pattern

```bash
# Set a single-select field
gh project item-edit \
  --project-id PVT_kwHODNwyZM4BVh2a \
  --id ITEM_NODE_ID \
  --field-id FIELD_ID \
  --single-select-option-id OPTION_ID

# Set a date field
gh project item-edit \
  --project-id PVT_kwHODNwyZM4BVh2a \
  --id ITEM_NODE_ID \
  --field-id PVTF_lAHODNwyZM4BVh2azhRChJQ \
  --date "2026-05-01"
```

## Notes

- `updateProjectV2Field` with `singleSelectOptions` **overwrites** the full list. Always pass existing option IDs back alongside new ones. Dropping an existing option ID wipes all item values for that option.
- Color enum: `GRAY | BLUE | GREEN | YELLOW | ORANGE | RED | PINK | PURPLE`
- `description` is required per option — pass `""` when none.
