# Scripts

## Main Scripts

| Script | Purpose |
|--------|---------|
| `generate-from-shortcuts.js` | Generate a Stream Deck profile from a `data/shortcuts/*.json` file |
| `generate-icons.js` | Generate 144×144 button icon PNGs into `data/icons/` |
| `expand-reference-profile.js` | Regenerate the reference-all-actions profile with composite plugin icons across 4 pages |

## Autoresearch

Karpathy-style iterative optimization loop. Two complementary loops share `autoresearch/score.mjs` and `autoresearch/program.md`.

| Script | Purpose |
|--------|---------|
| `autoresearch/score.mjs` | Numeric scorer: coverage (40%) + P1-density (35%) + coherence (25%). Writes `autoresearch/score.json`. |
| `autoresearch/loop.mjs` | **Loop A** — algorithm-level: calls Claude API to modify `generate-from-shortcuts.js`; keeps improvements, reverts regressions. Requires `ANTHROPIC_API_KEY`. |

Loop B (profile-level) runs as the `/autoresearch` Claude Code skill — see `.claude/skills/autoresearch/SKILL.md`.

```bash
npm run autoresearch:score profiles/vs-code data/shortcuts/vs-code.json
npm run autoresearch:dry vs-code           # dry run (no API call)
npm run autoresearch:run vs-code -- --max-iter 10
```

## One-Off Utilities

| Script | Purpose |
|--------|---------|
| `fill-grid.js` | Fill empty grid slots with placeholder buttons |
| `fix-typo.js` | Fix a label typo in an existing profile |
