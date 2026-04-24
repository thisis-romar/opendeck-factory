---
type: reference
captured_at: 2026-04-24
source: GitHub REST + GraphQL API queries; linkProjectV2ToRepository mutations 2026-04-24
---

# Repo Linkage — OpenDeck Project #4

## Project

- Number: `4`
- ID: `PVT_kwHODNwyZM4BVh2a`
- Visibility: **public** (flipped 2026-04-24 via `updateProjectV2(public: true)`)
- URL: `https://github.com/users/thisis-romar/projects/4`

## Linked Repositories

| Repo | Node ID | Visibility | Linked Since | Notes |
|------|---------|-----------|--------------|-------|
| `thisis-romar/opendeck-factory` | `R_kgDOSF-8Xw` | public | 2026-04-24 | Engine, MCP server, Claude Code plugin |
| `thisis-romar/opendeck-planning` | `R_kgDOSKHk7A` | private | 2026-04-24 | Private planning vault for portfolio + sibling MCP servers |
| `thisis-romar/stream-deck-catalog` | `R_kgDOSHDbCg` | private | 2026-04-24 | Commercial catalog — All Rights Reserved |

## Cross-Visibility Behavior

When a **private** repo is linked to a **public** project:
- Project viewers who lack repo access see a **redacted row** — the item exists but title, body, and most fields are hidden.
- Field values set via `gh project item-edit` (Area, Status, Priority) are visible to project viewers even for private repo items — only the issue title/body is gated.
- This is the intended behavior for catalog items: high-level roadmap status is publicly visible; implementation details stay private.

## Auto-Add Workflow

When the auto-add workflow is configured with `is:issue,pr`, it fires for all linked repos. As of 2026-04-24 the filter is:
```
is:issue,pr repo:thisis-romar/opendeck-factory
```

Update to include all 3 repos once planning and catalog repos are actively tracked:
```
is:issue,pr repo:thisis-romar/opendeck-factory repo:thisis-romar/opendeck-planning repo:thisis-romar/stream-deck-catalog
```

Or configure three separate auto-add workflows — GitHub allows multiple.

## Mutation Used

```bash
gh api graphql -f query='
  mutation($p: ID!, $r: ID!) {
    linkProjectV2ToRepository(input: {projectId: $p, repositoryId: $r}) {
      repository { nameWithOwner }
    }
  }' \
  -F p="PVT_kwHODNwyZM4BVh2a" \
  -F r="REPO_NODE_ID"
```

**Important:** Repo Node IDs containing dashes (e.g. `R_kgDOSF-8Xw`) cannot be embedded inline in GraphQL queries — the parser treats `-8` as an integer literal. Always pass them via `-F varname=value` flags.
