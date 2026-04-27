---
title: "Autoresearch Loop — 2026-04-27"
description: Karpathy-style iterative profile optimizer — Loop A (algorithm) + Loop B (profile-level subagent). Epic #124 + sub-issues #125–130 created.
lastmod: 2026-04-27T00:00:00Z
created: 2026-04-27T00:00:00Z
---

# Audit: Autoresearch Loop (2026-04-27)

## Why

Inspired by Karpathy's `autoresearch` pattern (agent modifies candidate file → locked evaluator scores → keep/revert). Applied to the Stream Deck profile generation pipeline in two complementary loops.

## What was built

### Shared infrastructure

| File | Purpose |
|---|---|
| `scripts/autoresearch/score.mjs` | Numeric scorer: coverage (40%) + P1-density (35%) + coherence (25%). Matches placed button labels back to shortcut data by normalised label. Writes `autoresearch/score.json`. |
| `autoresearch/program.md` | Research strategy doc: score breakdown, 5 optimization directions, constraints, anti-cheat rules. Referenced by both loops. |

### Loop A — algorithm-level (`scripts/autoresearch/loop.mjs`)

Modifies `generate-from-shortcuts.js` (the layout algorithm) via Claude API (`claude-sonnet-4-6`). Per iteration:
1. Reads generator + program.md + current score
2. Calls Claude API → `{ reason, code }` JSON response
3. Writes proposed code → runs generator → scores
4. If improved: keeps code + saves to `autoresearch/best/generator/`
5. If regressed: restores best code from memory (no git dep)
6. Early-stop after 3 consecutive misses

Requires `ANTHROPIC_API_KEY`. `@anthropic-ai/sdk` added as devDependency.

Usage: `npm run autoresearch:run <app> -- --max-iter 10`

### Loop B — profile-level (`.claude/skills/autoresearch/SKILL.md`)

Modifies a specific built profile directly using the existing MCP toolchain. Per iteration:
1. Snapshots `profiles/<app>/`
2. Invokes `autoresearch-driver` subagent (`.claude/agents/autoresearch-driver.md`) which uses `mcp__opendeck__list_profile`, `validate_profile`, `pack_profile` + ProfileEditor via Bash
3. Scores modified profile
4. If improved: saves to `autoresearch/best/<app>/`
5. If regressed: restores snapshot
6. Tier 3 `live_test_profile` every 5th iteration

No new API dependencies. Runs inside user's Claude Code session.

Usage: `/autoresearch profile <app> --max-iter 10`

## Three-tier evaluation

| Tier | Tool | Cost | Cadence |
|---|---|---|---|
| 1 | `score.mjs` (numeric) | ~50ms | every iteration |
| 2 | `quality_check` (structural gate) | ~300ms | every iteration |
| 3 | `live_test_profile` (real device) | ~30s | every 5th iter + final |

## GitHub project linkage

Epic: #124 — "Autoresearch loop — profile layout optimizer" (v2.4.0, Engine, M, Indirect, Sprint 1)

| Sub-issue | Title | Area | Size |
|---|---|---|---|
| #125 | score.mjs scorer | Engine | XS |
| #126 | loop.mjs (Loop A) | Engine | S |
| #127 | program.md | Docs | XS |
| #128 | wire-up (devDep + npm scripts + .gitignore) | Engine | XS |
| #129 | autoresearch-driver subagent | Engine | S |
| #130 | autoresearch SKILL.md | Skills | S |

All 7 items: milestone v2.4.0, Sprint 1, Status=In Progress.

## Commits

- `a413d38` — Loop B: skill + subagent + scorer + program.md
- `29ba4da` — Loop A: loop.mjs + @anthropic-ai/sdk

## Locked evaluator files (must never be modified by either loop)

- `scripts/quality-gate.js`
- `scripts/autoresearch/score.mjs`
