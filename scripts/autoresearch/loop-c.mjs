#!/usr/bin/env node
// Loop C: algorithm-level autoresearch using Codex CLI as the agent brain.
// Analogous to loop.mjs (Loop A) but uses `codex run` instead of the Anthropic API.
//
// Usage: node scripts/autoresearch/loop-c.mjs <app-name> [--max-iter N] [--max-budget-usd X] [--dry-run]
// Requires: codex CLI installed + authenticated (codex login)

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const GENERATOR_FILE  = 'scripts/generate-from-shortcuts.js';
const PROGRAM_FILE    = 'autoresearch/loop-c-program.md';
const CHECKPOINT_LOG  = 'autoresearch/checkpoints.log';
const SCORE_FILE      = 'autoresearch/score.json';
const BEST_GENERATOR  = 'autoresearch/best/generator/generate-from-shortcuts.js';

// ── Parse args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const appName     = args.find(a => !a.startsWith('-'));
const maxIterIdx  = args.indexOf('--max-iter');
const maxIter     = maxIterIdx !== -1 ? parseInt(args[maxIterIdx + 1], 10) : 20;
const budgetIdx   = args.indexOf('--max-budget-usd');
const maxBudget   = budgetIdx !== -1 ? parseFloat(args[budgetIdx + 1]) : Infinity;
const dryRun      = args.includes('--dry-run');

if (!appName) {
  console.error('Usage: node scripts/autoresearch/loop-c.mjs <app-name> [--max-iter N] [--max-budget-usd X] [--dry-run]');
  process.exit(1);
}

const shortcutsFile = resolve(`data/shortcuts/${appName}.json`);
const profileDir    = resolve(`profiles/${appName}`);

if (!existsSync(shortcutsFile)) { console.error(`Shortcuts not found: ${shortcutsFile}`); process.exit(1); }
if (!existsSync(GENERATOR_FILE)) { console.error(`Generator not found: ${GENERATOR_FILE}`); process.exit(1); }

// Verify codex is available
const codexCheck = spawnSync('codex', ['--version'], { encoding: 'utf8' });
if (codexCheck.status !== 0 && !dryRun) {
  console.error('Codex CLI not found or not in PATH. Install: npm install -g @openai/codex && codex login');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, { encoding: 'utf8', timeout: 120_000, ...opts });
}

function runGenerator() {
  return run('node', [GENERATOR_FILE, appName]);
}

function runScorer() {
  return run('node', ['scripts/autoresearch/score.mjs', profileDir, shortcutsFile]);
}

function readScore() {
  try { return JSON.parse(readFileSync(SCORE_FILE, 'utf8')); } catch { return null; }
}

function gitSHA() {
  const r = run('git', ['rev-parse', '--short', 'HEAD']);
  return r.stdout.trim() || 'unknown';
}

function saveBest(code) {
  mkdirSync('autoresearch/best/generator', { recursive: true });
  writeFileSync(BEST_GENERATOR, code, 'utf8');
}

function appendCheckpoint(entry) {
  mkdirSync('autoresearch', { recursive: true });
  writeFileSync(CHECKPOINT_LOG, JSON.stringify(entry) + '\n', { flag: 'a' });
}

function commitIteration(score, delta) {
  const sign = delta >= 0 ? '+' : '';
  const msg = `autoresearch v${iterNum} | score=${score.toFixed(4)} | delta=${sign}${delta.toFixed(4)}`;
  run('git', ['add', GENERATOR_FILE]);
  run('git', ['commit', '-m', msg, '--no-verify']);
}

// ── Baseline ──────────────────────────────────────────────────────────────────

console.log(`\nAutoresearch Loop C (Codex) — ${appName}  (max ${maxIter} iter${dryRun ? ', DRY RUN' : ''}${maxBudget < Infinity ? `, budget $${maxBudget}` : ''})`);
console.log('─'.repeat(64));

{
  const g = runGenerator();
  if (g.status !== 0) { console.error(`Baseline generator failed:\n${g.stderr}`); process.exit(1); }
  const s = runScorer();
  if (s.status !== 0) { console.error(`Baseline scorer failed:\n${s.stderr}`); process.exit(1); }
}

const baseline = readScore();
if (!baseline) { console.error('Scorer produced no output'); process.exit(1); }

let bestScore = baseline.score;
let bestCode  = readFileSync(GENERATOR_FILE, 'utf8');
let totalBudgetUsd = 0;
let iterNum = 0;
saveBest(bestCode);

console.log(`Baseline: ${baseline.score.toFixed(4)}  coverage=${baseline.coverage.toFixed(3)}  p1Density=${baseline.p1Density.toFixed(3)}  coherence=${baseline.coherence.toFixed(3)}`);
console.log('─'.repeat(64));

if (dryRun) {
  console.log('Dry run — Codex would be invoked for each iteration. Exiting.');
  process.exit(0);
}

// ── SIGINT: restore best ───────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\nInterrupted — restoring best generator...');
  writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
  console.log(`Best score: ${bestScore.toFixed(4)}`);
  process.exit(0);
});

// ── Main loop ─────────────────────────────────────────────────────────────────

const program = existsSync(PROGRAM_FILE) ? readFileSync(PROGRAM_FILE, 'utf8') : '';
let noChangeStreak = 0;

for (iterNum = 1; iterNum <= maxIter; iterNum++) {
  if (totalBudgetUsd >= maxBudget) {
    console.log(`\nBudget cap reached ($${totalBudgetUsd.toFixed(4)} / $${maxBudget}). Stopping.`);
    break;
  }

  const currentCode  = readFileSync(GENERATOR_FILE, 'utf8');
  const currentScore = readScore();
  process.stdout.write(`[${iterNum}/${maxIter}] score=${bestScore.toFixed(4)}  `);

  // Build prompt file for Codex
  const promptContent = [
    `# Autoresearch Loop C — iteration ${iterNum}`,
    '',
    '## Research program',
    program,
    '',
    '## Current score',
    JSON.stringify(currentScore, null, 2),
    '',
    '## Generator file to improve',
    '```js',
    currentCode,
    '```',
    '',
    'Return the complete modified generate-from-shortcuts.js. No explanation — just the file.',
  ].join('\n');

  const promptPath = join(tmpdir(), `loop-c-prompt-${randomUUID()}.md`);
  const outputPath = join(tmpdir(), `loop-c-output-${randomUUID()}.js`);
  writeFileSync(promptPath, promptContent, 'utf8');

  // Invoke Codex
  const codexResult = run('codex', ['run', '--quiet', '--prompt-file', promptPath, '--output-file', outputPath], { timeout: 120_000 });

  // Clean up temp prompt
  try { rmSync(promptPath); } catch {}

  if (codexResult.status !== 0 || !existsSync(outputPath)) {
    console.log(`Codex error — ${(codexResult.stderr || '').slice(0, 80)}`);
    noChangeStreak++;
    appendCheckpoint({ iteration: iterNum, kept: false, error: 'codex_failed', sha: gitSHA() });
    if (noChangeStreak >= 3) break;
    continue;
  }

  const proposed = readFileSync(outputPath, 'utf8').trim();
  try { rmSync(outputPath); } catch {}

  if (!proposed || proposed === currentCode) {
    console.log('no change proposed');
    noChangeStreak++;
    appendCheckpoint({ iteration: iterNum, kept: false, reason: 'no_change', sha: gitSHA() });
    if (noChangeStreak >= 3) { console.log('\nEarly stop: 3 consecutive no-change iterations.'); break; }
    continue;
  }

  // Apply proposed code
  writeFileSync(GENERATOR_FILE, proposed, 'utf8');

  const genResult = runGenerator();
  if (genResult.status !== 0) {
    console.log('✗ generator failed — reverting');
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    appendCheckpoint({ iteration: iterNum, kept: false, error: 'generator_failed', sha: gitSHA() });
    if (noChangeStreak >= 3) break;
    continue;
  }

  runScorer();
  const newScore = readScore();
  if (!newScore) {
    console.log('✗ scorer error — reverting');
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    continue;
  }

  const delta = newScore.score - bestScore;

  if (newScore.score > bestScore) {
    commitIteration(newScore.score, delta);
    console.log(`✓ +${delta.toFixed(4)} → ${newScore.score.toFixed(4)}`);
    bestScore = newScore.score;
    bestCode  = readFileSync(GENERATOR_FILE, 'utf8');
    saveBest(bestCode);
    noChangeStreak = 0;
    appendCheckpoint({ iteration: iterNum, score: newScore.score, delta, kept: true, sha: gitSHA(), budgetUsd: totalBudgetUsd });
  } else {
    console.log(`✗ ${delta >= 0 ? '+' : ''}${delta.toFixed(4)} → reverted`);
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    appendCheckpoint({ iteration: iterNum, score: newScore.score, delta, kept: false, sha: gitSHA(), budgetUsd: totalBudgetUsd });
  }

  if (noChangeStreak >= 3) { console.log(`\nEarly stop: ${noChangeStreak} consecutive misses.`); break; }
}

// Restore best
writeFileSync(GENERATOR_FILE, bestCode, 'utf8');

const improvement = bestScore - baseline.score;
console.log('\n' + '─'.repeat(64));
console.log(`Loop C complete: ${appName}`);
console.log(`Baseline → Best: ${baseline.score.toFixed(4)} → ${bestScore.toFixed(4)} (${improvement >= 0 ? '+' : ''}${improvement.toFixed(4)})`);
console.log(`Budget used: ~$${totalBudgetUsd.toFixed(4)}`);
console.log(`Best generator: ${BEST_GENERATOR}`);
console.log('─'.repeat(64));
