# GitHub PM Brain

Knowledge base for project-managing the OpenDeck Roadmap (project #4).
Consumed by the `gh-project-manager` subagent and indexed by graphify.

## Structure

```
knowledge/github/
├── README.md             ← this file
├── reference/            ← fetched GitHub docs (~75 files, fetched 2026-04-24)
│   ├── projects-v2/      ← Projects v2: creating, views, fields, automations, insights, access
│   ├── issues/           ← Issues: templates, labels, milestones, sub-issues, linking
│   ├── pull-requests/    ← PRs: auto-merge, merge queue, reviews, drafts
│   ├── cli/              ← gh project, gh issue, gh pr, gh api manuals
│   ├── graphql/          ← ProjectV2 schema, mutations, pagination, auth
│   └── automations/      ← Actions automation, branch protection, billing
└── playbooks/            ← hand-curated runbooks (13 total)
    ├── adding-a-view.md            ← create/reconfigure views; roadmap date-field gotcha; rename race fix
    ├── linking-a-pr.md             ← closing keywords, manual add
    ├── triaging-an-issue.md        ← labels, priority, area, target on new issues
    ├── sub-issue-hierarchies.md    ← break large issues into sub-issues; addSubIssue mutation
    ├── project-health-audit.md     ← 7-point checklist (views, field coverage, PR links, orphans, billing, linkage)
    ├── milestone-vs-target-field.md
    ├── retroactive-milestoning.md  ← bucket past issues into closed milestones
    ├── sprint-planning.md          ← 2-week Sprint field + @current iteration filter
    ├── revenue-tagging.md          ← Direct/Indirect/None taxonomy + Revenue view
    ├── github-app-setup.md         ← one-time setup of opendeck-project-sync GitHub App
    ├── insights-charts.md          ← 3 standard Insights charts; Playwright automation via npm run insights
    ├── setting-dates.md            ← historical dates (gh-set-dates.mjs) + milestone backfill (gh-set-milestone-dates.mjs)
    └── workflow-management.md      ← 8 enabled workflows; Auto-add filter; gh-toggle-workflows.mjs
```

Also see `knowledge/audit/` for structured audit outputs:

```
knowledge/audit/
├── 2026-04-24-linkage-audit.md              ← linkage gaps found + fixes applied
├── historical-timeline.md                   ← release dates derived from git tags + GH releases
├── field-taxonomy.md                        ← all 9 project fields with option IDs
├── repo-linkage.md                          ← which repos are linked, visibility behavior
├── 2026-04-26-views-and-subissues-audit.md  ← view state, roadmap date-field gotcha, sub-issue epic structure
└── 2026-04-26-dates-and-insights.md         ← milestone date backfill (99 items); 3 Insights charts created
```

## Rebuild the graph

```bash
npm run brain:build   # graphify knowledge/github → graphify-out/
npm run brain:query   # graphify query "<question>"
```

Graph outputs live in `graphify-out/` (gitignored — regenerate from this source).

## Refresh stale docs

Docs fetched with `graphify add <url> --dir knowledge/github/reference/<subdir>`.
Each file header contains `<!-- source: URL -->`. Re-fetch if older than 6 months.

## Project anchors

- Project number: `4`
- Project ID: `PVT_kwHODNwyZM4BVh2a`
- Field IDs: `.github/project-ids.json`
- Repo: `thisis-romar/opendeck-factory`
