# Playbook: Milestones vs the Target Field

## Two mechanisms, different purposes

| | GitHub Milestone | Projects v2 Target Field |
|---|---|---|
| **Lives on** | The issue/PR itself (repo-level) | The project item |
| **Queryable in project** | Via `milestone:` filter | Via `target:` field filter |
| **Shows in roadmap** | No (milestones don't map to roadmap dates) | Yes (if Target field is a date or iteration) |
| **Progress bar** | Yes (% closed issues) | No (use sub-issues progress instead) |
| **Cross-repo** | No | Yes (project can span repos) |
| **CLI** | `gh issue edit --milestone` | `gh project item-edit --field-id` |

## OpenDeck convention

**Use the `target` project field** (field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dv4`) for release targeting. Value format: `v2.x.0` (semver minor).

**Use milestones** only if you want a progress bar on a GitHub release page or are grouping issues for a changelog cut. Milestones and the target field are independent — you can set both.

## Creating a milestone

```bash
gh api repos/thisis-romar/opendeck-factory/milestones \
  -X POST \
  -f title="v2.3.0" \
  -f due_on="2026-06-01T00:00:00Z" \
  -f description="Catalog v1 + VS Code profile pack"
```

## Setting milestone on an issue

```bash
gh issue edit 19 --milestone "v2.3.0"
```

## Release cut cadence

OpenDeck uses **semver minor** (`v2.x.0`) for feature releases and **semver patch** (`v2.x.y`) for bug fixes. Major bumps (`v3.0.0`) require breaking API changes.

Create a milestone for each planned minor release once at least 2 issues are scoped to it.

## Known local anchors

- Milestones docs: `knowledge/github/reference/issues/docs_github_com_en_issues_using-labels-and-milestones-to-track-work_about-milest.md`
- Target field ID: `PVTSSF_lAHODNwyZM4BVh2azhQ9Dv4`
- Project field list: `gh project field-list 4 --owner thisis-romar --format json`
