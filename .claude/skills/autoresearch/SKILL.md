---
name: autoresearch
description: Iteratively improve a Stream Deck profile by invoking the autoresearch-driver subagent, scoring each iteration, and keeping improvements. Usage - /autoresearch profile <app-name> [--max-iter N]. Default 10 iterations. Requires the opendeck MCP server and data/shortcuts/<app>.json.
version: 0.1.0
lastmod: 2026-04-27T00:00:00Z
---

# /autoresearch

Iterative profile optimizer implementing the Karpathy autoresearch pattern:

```
subagent edits profile
    ↓
locked scorer measures it
    ↓
improvement kept / regression reverted
    ↓
repeat N times
```

## Usage

```
/autoresearch profile <app-name> [--max-iter N]
```

- `<app-name>` — matches `data/shortcuts/<app>.json` and `profiles/<app>/`
- `--max-iter N` — iteration budget (default: 10)

## What You Must Do When Invoked

### 1 — Parse arguments

Extract `app` and `maxIter` (default 10) from the invocation. If `profile` keyword is absent or `app` is missing, print usage and stop.

### 2 — Pre-flight checks

Run all four checks before starting the loop. Stop on any failure.

```bash
# a. Shortcuts file exists?
test -f data/shortcuts/<app>.json || echo "MISSING: data/shortcuts/<app>.json"

# b. Profile dir exists?
test -d profiles/<app> || echo "MISSING: profiles/<app>/"

# c. MCP server responds?
# Call mcp__opendeck__list_profile with profiles/<app> — if it errors, print guidance
# to start Claude Desktop or check claude_desktop_config.json

# d. Baseline score
node scripts/autoresearch/score.mjs profiles/<app> data/shortcuts/<app>.json
```

Print the baseline breakdown before the loop.

### 3 — Loop (i = 1 to maxIter)

**Step A — Snapshot** (Bash):
```bash
rm -rf autoresearch/snapshot
cp -r profiles/<app> autoresearch/snapshot
```

**Step B — Invoke subagent** via Agent tool (subagent_type: `autoresearch-driver`):

Pass this prompt (substitute live values):
```
App: <app>
Profile dir: profiles/<app>
Shortcuts file: data/shortcuts/<app>.json
Score file: autoresearch/score.json
Current score breakdown: <contents of autoresearch/score.json>
Iteration: <i> of <maxIter>
History: <last 3 lines from autoresearch/profile-history.jsonl, or "none">
Make one targeted improvement to profiles/<app>/ that lifts the lowest-scoring metric.
```

**Step C — Score** (Bash):
```bash
node scripts/autoresearch/score.mjs profiles/<app> data/shortcuts/<app>.json
```
Read `new_score` from `autoresearch/score.json`.

**Step D — Keep or revert**:

If `new_score > best_score`:
```bash
rm -rf autoresearch/best/<app>
mkdir -p autoresearch/best
cp -r profiles/<app> autoresearch/best/<app>
```
Append kept record to `autoresearch/profile-history.jsonl`:
```
{"iteration":<i>,"score":<new_score>,"delta":<new_score - best_score>,"kept":true,"change":"<CHANGE line>"}
```
Update `best_score = new_score`.

Else:
```bash
rm -rf profiles/<app>
cp -r autoresearch/snapshot profiles/<app>
```
Append reverted record to `autoresearch/profile-history.jsonl`:
```
{"iteration":<i>,"score":<new_score>,"delta":<new_score - best_score>,"kept":false,"change":"<CHANGE line>"}
```

**Step E — Early stop check**:

If the last 3 iterations all returned `CHANGE: none`, stop early and print: "Early stop: profile appears locally optimal."

**Step F — Tier 3 live test** (every 5th iteration + final iteration only):

Call `mcp__opendeck__live_test_profile` with `builds/<app>.streamDeckProfile`. Log mismatches as warnings but do NOT count them against the score.

### 4 — Final report

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Autoresearch complete: <app>
Baseline → Best: <baseline> → <best> (<+delta>)
  coverage:   <old> → <new>
  p1Density:  <old> → <new>
  coherence:  <old> → <new>
Iterations: <total> (<kept> kept, <reverted> reverted)
Best profile: autoresearch/best/<app>/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then ask: "Pack and install the best profile? (y/n)"  
If yes: `mcp__opendeck__pack_profile` + `mcp__opendeck__live_test_profile`.

## Filesystem layout (all gitignored)

```
autoresearch/
  score.json              ← current scorer output (overwritten each iteration)
  profile-history.jsonl   ← one JSON line per iteration
  snapshot/               ← pre-iteration backup for revert
  best/<app>/             ← best profile found so far
```

## Notes

- Token cost: ~5K tokens per iteration (subagent context + MCP outputs + scorer). A 10-iter run uses ~50K tokens.
- `live_test_profile` requires Stream Deck app installed and a device connected. Skip gracefully if absent.
- Subagent does NOT generate icons — rearranges existing buttons only. Run `npm run generate:icons` separately for new icon needs.
- See `autoresearch/program.md` for the research strategy the subagent follows.
