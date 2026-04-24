---
type: reference
captured_at: 2026-04-24
source: git tags, GH release publishedAt, PR mergedAt
---

# Historical Release Timeline

Point-of-truth for OpenDeck release dates. Derived from git tags and GitHub release metadata — survives tag deletion or repo moves.

## Releases

| Version | Date (UTC) | GitHub Milestone # | Source |
|---------|------------|-------------------|--------|
| v2.0.0 | 2026-04-22 ~16:15 EDT | #3 (closed) | git tag `v2.0.0` on commit `f5a764e` |
| v2.1.0 | 2026-04-22 ~19:40 EDT | #4 (closed) | git tag `v2.1.0`, PR #2 mergedAt |
| v2.2.0 | 2026-04-23 04:07:30 UTC | #5 (closed) | GitHub release publishedAt |
| v2.3.0 | 2026-05-15 (target) | #1 (open) | planned |
| v2.4.0 | 2026-06-30 (target) | #6 (open) | planned |
| v2.5.0 | 2026-08-15 (target) | #7 (open) | planned |
| v3.0.0 | 2026-10-01 (target) | #2 (open) | planned |
| v3.1.0 | 2026-12-15 (target) | #10 (open) | planned |
| Catalog-v1 | 2026-06-01 (target) | #8 (open) | planned |
| Catalog-v2 | 2026-09-15 (target) | #9 (open) | planned |

## What Shipped Per Release

### v2.0.0 (2026-04-22)
- Initial engine: ProfileEditor, hotkey builder, extract/pack/validate pipeline
- `src/constants.js` KEY_CODES
- `profiles/_template/` bootstrap
- Commitlint + husky git hooks
- CHANGELOG.md, README.md, CLAUDE.md
- FSL-1.1-ALv2 license

**Closed issues:** #1 (No readme — resolved at v2.0.0 baseline)

### v2.1.0 (2026-04-22)
- MCP server with 9 tools
- Claude Code plugin manifest (`.claude-plugin/plugin.json`)
- Reference profile (all action type schemas)

**Closed issues:** #3, #8, #10  
**Merged PRs:** #2

### v2.2.0 (2026-04-23)
- `install-profile.js`, `verify-profile.js` scripts
- `live_test_profile` MCP tool
- v2.2.0 GitHub Release artifact
- 3 Claude Code skills with SKILL.md frontmatter
- Marketplace research: claudemarketplace.com, skills.sh
- GitHub Projects v2 board (project #4 created)

**Closed issues:** #4, #5, #6, #7, #9, #11, #12, #16

### v2.3.0 (target: 2026-05-15)
- Schema refactor: 5 new project fields (Size, Start Date, Target Date, Sprint, Revenue Impact)
- Status options expanded (Backlog, In Review, Blocked)
- Area options expanded (Plugin, Distribution, Licensing)
- Target options expanded (granular per-version)
- gh-project-manage skill + gh-project-manager subagent
- knowledge/github/ brain (75 docs + playbooks)
- Issue forms (.github/ISSUE_TEMPLATE/)
- View automation (gh-create-views.mjs)

**In flight:** PR #24, PR #30
