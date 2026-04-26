# Playbook: Project Health Audit

Run this recipe whenever you want a snapshot of the OpenDeck Roadmap's state. The `gh-project-manager` subagent can execute this end-to-end.

## The 6-point checklist

### 1. Views correct?
Expected views (names + layouts):
- `Marketplace` — Table, filter `area:Marketplace`
- `Board — By Status` — Board
- `Board — By Area` — Board
- `Roadmap — By Target` — Roadmap
- `Active Work` — Table

Verify via GraphQL:
```bash
gh api graphql -f query='
{
  user(login: "thisis-romar") {
    projectV2(number: 4) {
      views(first: 20) { nodes { name layout } }
    }
  }
}'
```

Fix with: `npm run views:fix`

### 2. Every issue has required fields set?
Required fields: **status**, **priority**, **area**. Target is required for release-bound items.

```bash
gh project item-list 4 --owner thisis-romar --format json --limit 100 | \
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    d.items.forEach(i => {
      const missing = ['status','priority','area'].filter(f => !i.fieldValues?.nodes?.find(v => v.field?.name?.toLowerCase()===f && v.text));
      if (missing.length) console.log('#' + i.content?.number, i.content?.title, '-- missing:', missing.join(', '));
    });
  "
```

### 3. Every open PR is linked to an issue?
```bash
gh pr list --state open --json number,title,closingIssuesReferences | \
  node -e "
    const prs = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    prs.forEach(pr => {
      if (!pr.closingIssuesReferences?.length)
        console.log('UNLINKED PR #' + pr.number, pr.title);
    });
  "
```

### 4. No orphaned project items (items not in the repo)?
```bash
gh project item-list 4 --owner thisis-romar --format json --limit 100 | \
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    d.items.filter(i => !i.content?.number).forEach(i => console.log('ORPHAN:', i.id, i.title || '(no title)'));
  "
```

### 5. No views with wrong layouts?
See check 1 — the GraphQL query returns layout per view. Compare against the expected table above.

### 6. Billing status OK?
Check for the billing banner at https://github.com/users/thisis-romar/projects/4 — if "We are having a problem billing your account" appears, automations and paid-tier features may silently fail.

### 7. Every closed issue has a PR linkage?

Every closed issue should either:
- Have a merged PR with `Closes #N` in its body, OR
- Have an explicit comment explaining why it was closed without a PR (e.g. "resolved by configuration change")

```bash
gh issue list --state closed --json number,title,closingIssuesReferences,stateReason | \
  node -e "
    const issues = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    issues.forEach(i => {
      if (!i.closingIssuesReferences?.length && i.stateReason !== 'NOT_PLANNED')
        console.log('#' + i.number, i.title, '-- no linked PR');
    });
  "
```

If a PR closed an issue before `Closes #N` was in the body, add it retroactively via `gh pr edit` body append. See `knowledge/github/playbooks/retroactive-milestoning.md`.

## Frequency

Run before any release cut or when you notice project state drifting. Also run after bulk-importing issues.

## Known local anchors

- Project IDs: `.github/project-ids.json`
- View automation: `scripts/gh-create-views.mjs`
- Project sync: `scripts/gh-project-sync.js`
- Full view list: `graphify query "what are the five OpenDeck project views?"`
