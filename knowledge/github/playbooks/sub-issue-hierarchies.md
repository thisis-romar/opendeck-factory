# Playbook: Sub-Issue Hierarchies

## When to split an issue into sub-issues

Split when:
- An issue is too large to finish in a single PR
- Parts of it can be parallelized across branches
- You want separate progress tracking per sub-component

Don't split when:
- The work is naturally atomic (one commit, one PR)
- The sub-tasks aren't independently releasable or reviewable

## Sub-issues vs tasklists

| Mechanism | When to use |
|---|---|
| **Sub-issues** | Each piece of work needs its own PR, labels, assignee, or status tracking |
| **Markdown tasklist** (`- [ ] item`) | Simple checklist within one issue body — no separate tracking needed |

Note: GitHub's old "tasklist block" syntax (```` ```[tasklist] ````) was retired. Use sub-issues for structured hierarchies, plain markdown checkboxes for inline checklists.

## Creating sub-issues

Via CLI (GitHub CLI 2.x+):
```bash
gh issue create --title "Sub-task: ..." --body "Part of #<parent>"
# Then link as sub-issue via UI or API
```

Via GraphQL (add existing issue as sub-issue):
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

## Max depth

GitHub supports up to **8 levels** of nesting. In practice, more than 2 levels is unusual and hard to navigate. Keep it flat: one parent, N children.

## Viewing hierarchy

The "Sub-issues progress" field shows a progress bar in project views. Add it as a visible field in any Table or Board view.

CLI: `gh issue view <N> --json subIssues`

## OpenDeck pattern

For large features (e.g. "Agentic pipeline v1" — issue #20):
1. Parent issue: captures the full scope and acceptance criteria
2. Child issues: one per discrete deliverable (Agent 1, Agent 2, etc.)
3. Each child closes via its own PR
4. Parent auto-closes when all children are closed (or close manually after last child)

## Known local anchors

- Sub-issues docs: `knowledge/github/reference/issues/docs_github_com_en_issues_tracking-your-work-with-issues_using-issues_adding-sub.md`
- Tasklists docs: `knowledge/github/reference/issues/docs_github_com_en_get-started_writing-on-github_working-with-advanced-formattin.md`
