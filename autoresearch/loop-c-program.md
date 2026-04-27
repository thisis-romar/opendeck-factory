---
title: "Autoresearch Research Program — Loop C (Codex)"
description: Codex-tuned research instructions for the Stream Deck layout algorithm optimizer.
lastmod: 2026-04-27T00:00:00Z
created: 2026-04-27T00:00:00Z
---

# Autoresearch Research Program — Loop C (Codex)

## Purpose

You are the Codex agent driving Loop C of the autoresearch pipeline. Each invocation, propose and apply **one targeted code change** to `generate-from-shortcuts.js` to improve the composite profile score. The eval harness will keep your change if the score improves, revert it if it regresses.

## The score (composite, 0–1)

| Metric | Weight | Formula |
|---|---|---|
| Coverage | 40% | `placed / total` — fraction of shortcuts placed |
| P1 Density | 35% | `p1_on_page1 / total_p1` — P1 shortcuts on page 1 |
| Coherence | 25% | `intact_categories / total_categories` |
| Visual | +15% (bonus) | Screenshot diff vs reference — only on Tier 3 runs |

Read the current breakdown from `autoresearch/score.json`. Target the lowest metric.

## How to propose a change

Prefer **minimal diffs** over full rewrites. One change = one logical modification:
- Reorder `CATEGORY_ROW_ORDER` → change the array order
- Change sort comparator → modify the `sorted` block's comparator function
- Add a page-break heuristic → insert logic in the placement loop
- Reserve page-1 slots → add a pre-pass before the main loop

Output: the complete modified `generate-from-shortcuts.js` file, nothing else.

## Optimization directions (priority order)

1. **P1 density**: Reorder categories so high-priority-average categories appear first in `CATEGORY_ROW_ORDER`
2. **P1 pre-pass**: Before the category loop, scan for P1 shortcuts and place them on page 1 first
3. **Category coherence**: Add a heuristic to keep all shortcuts of a category on the same page (don't split at page boundary mid-category)
4. **Coverage**: Ensure no shortcuts are skipped due to ordering — check for orphaned shortcuts in large categories
5. **Secondary sort**: Within a category, sort by key complexity (chord shortcuts last) after priority

## Budget awareness

Loop C tracks `--max-budget-usd`. To control cost:
- Keep changes small — a 5-line diff costs far less than a full rewrite
- Avoid adding large new comment blocks or restructuring unchanged code
- If you see no obvious improvement opportunity, return `CHANGE: none` — one token is better than a wrong rewrite

## Constraints

| Rule | Why |
|---|---|
| Only modify `generate-from-shortcuts.js` | Eval harness locks score.mjs + quality-gate.js |
| One logical change per invocation | Small steps are auditable; large shuffles hide regressions |
| Never change the CLI interface | `node scripts/generate-from-shortcuts.js <app>` must still work |
| Never hardcode shortcut positions | Fragile across datasets |
| Check checkpoints.log history | Don't repeat a change that already regressed |

## Commit message format (the harness writes this)

```
autoresearch v{N} | score={X:.4f} | delta={+/-Y:.4f}
```

Example: `autoresearch v7 | score=0.7812 | delta=+0.0214`
