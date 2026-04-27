---
title: "Autoresearch Research Program — Stream Deck Profile Optimizer"
description: Instructions for the autoresearch-driver subagent. Constraints, score breakdown, and optimization directions.
lastmod: 2026-04-27T00:00:00Z
created: 2026-04-27T00:00:00Z
---

# Autoresearch Research Program — Stream Deck Profile Optimizer

## Purpose

You are the `autoresearch-driver` subagent. Each invocation, make **one targeted, score-improving change** to a Stream Deck profile. The outer skill keeps your change if the composite score improves, reverts it if it regresses.

## The score (composite, 0–1)

| Metric | Weight | Formula |
|---|---|---|
| Coverage | 40% | `placed / total` — fraction of shortcuts that appear in the profile |
| P1 Density | 35% | `p1_on_page1 / total_p1` — fraction of priority-1 shortcuts on page 1 |
| Coherence | 25% | `intact_categories / total_categories` — fraction of categories on one page |

Read `autoresearch/score.json` to find the current breakdown. A good change lifts the weakest metric.

## Optimization directions (try in priority order)

1. **P1 density boost** (35% weight — highest impact): Find any priority-1 shortcut on page 2+. Move it to an empty slot on page 1. 

2. **Category consolidation** (25% weight): Find a category split across pages. Move the minority of that category (the stragglers) to the page where most of that category lives.

3. **Coverage recovery** (40% weight — highest if low): Find shortcuts missing from the profile by comparing `list_shortcuts` output to placed labels. If there's an empty slot anywhere, add the missing shortcut with `add_shortcut`.

4. **Priority promotion**: If page 1 has empty slots and there are P2 shortcuts from important categories on later pages, move them forward.

5. **Page reorder (high-risk)**: Only after 3 iterations of no improvement. Move all shortcuts from a high-priority category from page 2 to page 1 by pushing lower-priority page-1 shortcuts to page 2. Higher variance.

## Constraints

| Rule | Why |
|---|---|
| ONE type of change per iteration | Small steps converge; big shuffles are hard to diagnose |
| Max 3 buttons moved per iteration | Same |
| Never modify `src/`, `scripts/quality-gate.js`, `scripts/autoresearch/score.mjs` | These are the locked evaluator |
| Never delete a category | Reduces coverage |
| Never call `live_test_profile` | The skill controls when live tests fire |
| Check history before acting | Don't repeat a change that already regressed |

## What to avoid

- Renaming button labels (breaks the label→shortcut match in scorer)
- Duplicating shortcuts (scorer counts unique placements)
- Moving buttons without a clear metric target
- Rewriting `CATEGORY_ROW_ORDER` in the generator (that's Loop A, not your job)

## Return format

End your response with:
```
CHANGE: <one-line description including which metric you targeted and expected delta>
```
Example: `CHANGE: Moved Ctrl+P, Ctrl+B (P1) from page 2 to page 1 empty slots → p1Density +0.15`

If no beneficial change is possible: `CHANGE: none — profile appears locally optimal for this metric`
