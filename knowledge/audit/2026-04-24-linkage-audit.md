---
type: audit
captured_at: 2026-04-24
source: Agent-driven audit of thisis-romar/opendeck-factory issues, PRs, milestones, and GitHub project #4
---

# Linkage Audit — 2026-04-24

## Summary

Audit of opendeck-factory GitHub state against the OpenDeck Roadmap project #4, conducted prior to Phase 1b–1c execution.

## Issues

| # | Title | State | Milestone (pre-audit) | In project #4? | Linked PR |
|---|-------|-------|-----------------------|----------------|-----------|
| 1 | No readme | closed | none | ❌ | none |
| 2 | (doesn't exist) | — | — | — | — |
| 3 | MCP server — 9 tools shipped | closed | none | ✅ | PR #2 (no Closes keyword) |
| 4 | Agent 3: install-profile.js | closed | none | ✅ | none |
| 5 | Agent 3: verify-profile.js | closed | none | ✅ | none |
| 6 | Agent 3: live_test_profile MCP tool | closed | none | ✅ | none |
| 7 | v2.2.0 GitHub Release | closed | none | ✅ | none |
| 8 | Claude Code plugin manifest | closed | none | ✅ | PR #2 (no Closes keyword) |
| 9 | 3 Claude Code skills with SKILL.md | closed | none | ✅ | none |
| 10 | Reference profile — all action type schemas | closed | none | ✅ | PR #2 (no Closes keyword) |
| 11 | Marketplace — claudemarketplace.com | closed | none | ✅ | none |
| 12 | Marketplace — skills.sh / npx skills | closed | none | ✅ | none |
| 16 | GitHub Projects v2 board | closed | none | ✅ | PR #24 (Closes #16, #29 — duplicated) |
| 28 | gh-pm-brain tracking issue | open | none | ✅ | PR #30 |
| 29 | gh-project-manage skill | open | none | ✅ | PR #24 |

## Pull Requests

| PR | Title | State | Merged | Closes keywords |
|----|-------|-------|--------|-----------------|
| 2 | MCP server + plugin | merged | 2026-04-22 | none (retroactive: Closes #3, #8, #10 added in body) |
| 24 | gh-create-views: view automation | open | — | `Closes #16, Closes #29` (Closes #16 removed retroactively) |
| 30 | gh-pm-brain: knowledge base + schema | open | — | `Closes #28` |

## Milestone State (pre-audit)

Only v2.3.0 (#1) and v3.0.0 (#2) existed. Both had `due_on: null`. No closed milestones for historical releases.

## Project #4 State (pre-audit)

- Visibility: **private**
- Repos linked: **0** (factory, planning, catalog all unlinked)
- Fields: Status, Priority, Area, Target (4 fields total — no Size, Sprint, dates, Revenue Impact)
- Items: 28
- Views: Board By Status, Board By Area, Roadmap By Target, Marketplace, Active Work (5 views)

## Gaps Found

1. **Issue #1 not in project** — orphaned after creation, never added
2. **PR #2 body missing `Closes` keywords** for #3, #8, #10
3. **PR #30 open but not in project** — brain PR should be tracked
4. **Issue #16 double-counted** — manually closed but still referenced by open PR #24
5. **Milestones v2.0.0/v2.1.0/v2.2.0 missing** — releases shipped but milestones never created
6. **All 3 repos unlinked** from project #4
7. **Project private** — roadmap not publicly visible despite engine being public

## Fixes Applied (Phase 1b, 1c)

- Created milestones v2.0.0 (#3, closed), v2.1.0 (#4, closed), v2.2.0 (#5, closed) backdated
- Patched v2.3.0 due_on=2026-05-15, v3.0.0 due_on=2026-10-01
- Created milestones v2.4.0 (#6), v2.5.0 (#7), Catalog-v1 (#8), Catalog-v2 (#9), v3.1.0 (#10)
- Retroactively milestoned 12 closed issues via REST PATCH
- Added `Closes #3, #8, #10` to PR #2 body
- Removed `#16` from PR #24 Closes list; left `Closes #29`
- Added comment on issue #16 explaining reconciliation
- Added `Closes #28` to PR #30 body
- Added issue #1 and PR #30 to project #4
- Linked factory, planning, catalog repos to project #4
- Flipped project #4 to public
