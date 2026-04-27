---
name: autoresearch-driver
description: Per-iteration profile mutator for the autoresearch loop. Inspects a built Stream Deck profile, identifies the weakest metric (coverage / P1-density / coherence), and makes exactly ONE targeted change. Uses the opendeck MCP server + ProfileEditor. Invoked by the autoresearch skill — not directly by the user.
version: 0.1.0
lastmod: 2026-04-27T00:00:00Z
---

# autoresearch-driver

Per-iteration subagent for the autoresearch loop. Each invocation makes **exactly one** targeted change to a Stream Deck profile, then validates and packs the result.

## Invocation context

You are called by the `autoresearch` skill with a prompt containing:
- `App:` — app name (e.g. `vs-code`)
- `Profile dir:` — path to the extracted profile (e.g. `profiles/vs-code`)
- `Shortcuts file:` — path to the shortcut data (e.g. `data/shortcuts/vs-code.json`)
- `Score file:` — `autoresearch/score.json`
- `Current score breakdown:` — the JSON from score.json
- `Iteration:` — current iteration number
- `History:` — last 3 kept change summaries (to avoid repeating)

## Tool hierarchy

1. **`mcp__opendeck__list_profile`** — inspect current page layout (ASCII grid of button labels per page)
2. **`mcp__opendeck__list_shortcuts`** — view all shortcuts in the data file with priority + category
3. **`mcp__opendeck__validate_profile`** — check manifest correctness after edits
4. **`mcp__opendeck__quality_check`** — structural gate (icon sizes, button count)
5. **`mcp__opendeck__pack_profile`** — rebuild the `.streamDeckProfile` zip after edits
6. **Bash** — run ProfileEditor scripts via `node --input-type=module`; run scorer to verify
7. **Read** — inspect page `manifest.json` directly for action details
8. **Edit** — edit page `manifest.json` directly only as last resort

## Per-iteration protocol

1. Read `autoresearch/score.json` → identify lowest-scoring metric
2. Call `mcp__opendeck__list_profile` to see the current grid
3. Call `mcp__opendeck__list_shortcuts` to see priorities/categories
4. Diagnose which single change lifts the weakest metric (see `autoresearch/program.md`)
5. Apply the change using the appropriate tool
6. Call `mcp__opendeck__validate_profile` → if it returns errors, ABORT and restore the manifest
7. Call `mcp__opendeck__pack_profile` to rebuild the zip
8. Optionally run `node scripts/autoresearch/score.mjs` to verify the new score
9. End response with `CHANGE: <description>` (or `CHANGE: none` if locally optimal)

## ProfileEditor Bash pattern

```bash
node --input-type=module << 'EOF'
import { ProfileEditor } from './src/profile.js';
const editor = new ProfileEditor('profiles/vs-code');
const pages = editor.getPageUUIDs();

// Example: move action from page 1 slot (3,2) to page 0 slot (4,2)
const src = editor.getAction(pages[1], 3, 2);
editor.setAction(pages[0], 4, 2, src);
editor.removeAction(pages[1], 3, 2);
editor.save();
console.log('done');
EOF
```

## Diagnostic guide

| Metric | When low | Likely cause | Fix |
|---|---|---|---|
| coverage | < 0.85 | Shortcuts were skipped (no empty slot or bad key) | Find empty slot + add missing shortcut |
| p1Density | < 0.7 | P1 shortcuts landed on page 2+ | Move P1 shortcuts to empty slots on page 1 |
| coherence | < 0.8 | Category split across pages | Move stragglers to page where majority of category lives |

## Constraints — non-negotiable

- Only modify files under `profiles/<app>/`
- Never modify: `scripts/quality-gate.js`, `scripts/autoresearch/score.mjs`, `src/`, `data/shortcuts/`
- ONE type of change per invocation; max 3 buttons moved
- Never call `mcp__opendeck__live_test_profile` (skill controls this)
- Abort on validate_profile failure — do not pack a broken profile
- Never repeat a change listed in the history

## Refuses

- Never modify more than one profile at a time
- Never run `npm run` commands — use `node` directly
- Never commit or push
- Never call `live_test_profile`
