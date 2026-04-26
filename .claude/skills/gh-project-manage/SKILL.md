---
title: GitHub Project Management
name: gh-project-manage
description: User-invocable front door for managing the OpenDeck Roadmap (GitHub project #4). Runs preflight, routes to the right playbook, and delegates execution to the gh-project-manager subagent.
version: 1.0.0
created: 2026-04-24T17:52:03Z
lastmod: 2026-04-24T17:52:03Z
---

## Charter

Invoke this skill when you need to interact with the OpenDeck GitHub project (#4). It preflights the project anchors, routes the request to the right playbook, and delegates heavy execution to the `gh-project-manager` subagent. The skill itself never mutates the project directly — all mutations go through the subagent.

**Playbook-first principle.** Check `knowledge/github/playbooks/` before writing any `gh` or GraphQL commands from memory. The playbooks encode decisions (label taxonomy, target-version convention, view naming) that aren't derivable from the API docs.

## Inputs and Outputs

**Inputs:**
- Intent (what you want to do — audit, triage, add view, link PR, health check, etc.)
- Optional: issue/PR number to operate on
- Optional: field values to set (priority, area, target, status)

**Outputs:**
- Subagent hand-off report (what was done, what was skipped, any surprises)
- For audits: 6-point health-check results with action items
- For triage: confirmation of fields set (priority, area, target, status)
- Every recommendation cites the playbook path or graph node that justified it

## Pre-flight

Before delegating, verify:

1. **Anchors loaded** — read `.github/project-ids.json` to confirm field IDs are current
2. **Graph available** — `[ -f graphify-out/graph.json ]` (rebuild with `npm run brain:build` if missing)
3. **gh CLI authenticated** — `gh auth status` returns an active token with `project` scope

If condition 3 fails: ask the user to run `gh auth refresh -s project`.

## Intent Routing

| User intent | Playbook to read first |
|---|---|
| Health audit / "audit the project" | `knowledge/github/playbooks/project-health-audit.md` |
| Add or fix a view | `knowledge/github/playbooks/adding-a-view.md` |
| Triage an issue (set fields) | `knowledge/github/playbooks/triaging-an-issue.md` |
| Link a PR to an issue | `knowledge/github/playbooks/linking-a-pr.md` |
| Break a large issue into sub-issues | `knowledge/github/playbooks/sub-issue-hierarchies.md` |
| Choose milestone vs target field | `knowledge/github/playbooks/milestone-vs-target-field.md` |
| GraphQL / API question | `/graphify query "<question>"` → `knowledge/github/reference/graphql/` |

For any intent not listed, run `/graphify query "<intent>"` to surface the most relevant reference doc before proceeding.

## Workflow

### Step 1: Pre-flight

Run the three checks above. Do not delegate until all pass.

### Step 2: Read the Playbook

Navigate to the playbook matching the user's intent (see routing table). Read it fully before constructing any commands. The playbook's "Known local anchors" section points to the exact script, field ID, or memory note that operationalises it.

### Step 3: Delegate to gh-project-manager Subagent

Spawn the subagent with a precise task brief:

```
Task: [what needs to happen]
Relevant playbook: knowledge/github/playbooks/<file>.md
Project anchors: project #4 (PVT_kwHODNwyZM4BVh2a), repo thisis-romar/opendeck-factory
Field IDs: .github/project-ids.json
Items in scope: [issue/PR numbers if applicable]
Expected output: [what the subagent should return]
```

The subagent has full tool access (`Bash`, `gh` CLI, `gh api graphql`). It may not merge PRs or push branches without explicit user approval.

### Step 4: Receive Report and Verify

The subagent returns:
1. What was done (with citations to playbook or graph node)
2. What was skipped and why
3. Any surprises or anomalies
4. Recommended follow-up actions

For mutations (field updates, issue creation): verify with `gh project item-list 4 --owner thisis-romar --format json` that the expected field values are set.

## Known Fragile Areas

- **Primer portal dialogs** — Save/Delete/Cancel inside GitHub confirmation dialogs render in `#__primerPortalRoot__`. See the subagent's gotchas section for the exact Playwright selector.
- **GraphQL on Windows** — use `spawnSync('gh', ['api', 'graphql', '-f', ...])` not `execSync`. Shell argument splitting breaks multi-word queries.
- **View mutations** — the API cannot create or modify layout type. Use `npm run views:fix` (Playwright) when the 5 canonical views need repair.
- **Billing banner** — a payment-issue banner may appear on the project. Project automations may fail silently. Fixing billing is always out of scope for this skill; surface it in audit output only.

## Safety

- Never merge PRs or push branches without explicit user approval.
- Never touch `feat/windows-mcp-computer-use` or `feat/gh-projects-views` unless the user explicitly names them.
- Never hardcode credentials, tokens, or project IDs outside `.github/project-ids.json`.
