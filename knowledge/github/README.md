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
└── playbooks/            ← hand-curated runbooks
    ├── adding-a-view.md
    ├── linking-a-pr.md
    ├── triaging-an-issue.md
    ├── sub-issue-hierarchies.md
    ├── project-health-audit.md
    └── milestone-vs-target-field.md
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
