# Playbook: Linking a Pull Request to an Issue

## Closing keywords (auto-link on merge)

Add one of these in the PR description body to auto-close the issue when the PR merges to the default branch:

```
Closes #16
Fixes #16
Resolves #16
```

Case-insensitive. Only auto-closes when merged to the **default branch** (master/main). Merging to a non-default branch links but does not close.

Cross-repo: `Closes owner/repo#16`

## Verify the link landed

1. After creating the PR, open the issue — check the "Development" panel on the right sidebar. The linked PR should appear there.
2. Or via CLI: `gh issue view 16 --json developmentBranch`
3. Via GraphQL:
```graphql
query {
  repository(owner: "thisis-romar", name: "opendeck-factory") {
    issue(number: 16) {
      closedByPullRequestsReferences(first: 5) {
        nodes { number title }
      }
    }
  }
}
```

## Adding a PR to the project manually

If a PR doesn't automatically appear in the project (happens when the closing issue isn't in the project, or the PR was created before the workflow was set up):

```bash
gh project item-add 4 --owner thisis-romar --url <PR-URL>
```

Or via GraphQL:
```graphql
mutation {
  addProjectV2ItemById(input: {projectId: "PVT_kwHODNwyZM4BVh2a", contentId: "<PR-node-id>"}) {
    item { id }
  }
}
```

## Discipline

- Every PR in this repo should close at least one issue via keyword.
- If a PR is exploratory (no issue), create the issue first, then link.
- PRs that fix things across multiple issues: `Closes #N, Closes #M` (comma-separated) in one body.

## Known local anchors

- Project ID: `PVT_kwHODNwyZM4BVh2a` (`.github/project-ids.json`)
- Project number: `4`
- Add item CLI: `gh project item-add 4 --owner thisis-romar --url <URL>`
- Check development panel: `gh issue view <N> --json title,state`
