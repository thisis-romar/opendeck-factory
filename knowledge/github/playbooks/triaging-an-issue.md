# Playbook: Triaging an Issue

## Label taxonomy

Labels use a flat `type:value` convention. Current types in use:

| Label | Meaning |
|---|---|
| `enhancement` | New feature or improvement |
| `bug` | Something broken |
| `research` | Investigation/spike, no code yet |
| `devops` | CI, hooks, tooling, scripts |
| `distribution` | Publishing, marketplace, release channels |

Add labels on issue create:
```bash
gh issue create --label "enhancement" --title "..." --body "..."
```

Bulk-add to existing: `gh issue edit <N> --add-label "distribution"`

## Priority field

The `priority` custom field on the project has single-select options. Standard ladder:

| Value | Meaning |
|---|---|
| `P0-Critical` | Blocks a release or user can't use the product |
| `P1-High` | Important, do soon |
| `P2-Medium` | Nice to have, backlog |
| `P3-Low` | Someday/maybe |

Set via GraphQL (field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Du8`):
```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PVT_kwHODNwyZM4BVh2a"
      itemId: "<ITEM_NODE_ID>"
      fieldId: "PVTSSF_lAHODNwyZM4BVh2azhQ9Du8"
      value: { singleSelectOptionId: "<OPTION_ID>" }
    }) { projectV2Item { id } }
  }
'
```

Get option IDs: `gh project field-list 4 --owner thisis-romar --format json`

## Area field

The `area` custom field partitions work by product surface:

| Value | Meaning |
|---|---|
| `Core` | Engine, pack/extract/validate |
| `MCP` | MCP server tools |
| `Skills` | Claude Code skills |
| `Marketplace` | Distribution / submission |
| `DevOps` | Build, hooks, release |

Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9DvA`

## Status field

| Value | When to set |
|---|---|
| `Todo` | Accepted, not started |
| `In Progress` | Actively being worked on |
| `Done` | Closed / merged |

Status field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dtc`

Built-in automation: GitHub auto-sets Done when the closing PR merges (if "Item closed" workflow is enabled).

## Target version (Target field)

The `target` field marks which release milestone an issue belongs to. Convention: `v2.x.0` (semver minor). Field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dv4`.

## Triage checklist

For every new issue before it's worked on:
- [ ] Label set (at least one type label)
- [ ] Priority field set
- [ ] Area field set
- [ ] Target field set (if it's release-bound)
- [ ] Closing PR linked or issue assigned

## Known local anchors

- Project IDs: `.github/project-ids.json`
- Sync script: `scripts/gh-project-sync.js`
- Milestone docs: `knowledge/github/reference/issues/docs_github_com_en_issues_using-labels-and-milestones*`
