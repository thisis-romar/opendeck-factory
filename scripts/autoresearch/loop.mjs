#!/usr/bin/env node
// Loop A: algorithm-level autoresearch
// Iteratively improves generate-from-shortcuts.js via Claude API calls.
// Usage: node scripts/autoresearch/loop.mjs <app-name> [--max-iter N] [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';

const GENERATOR_FILE = 'scripts/generate-from-shortcuts.js';
const PROGRAM_FILE   = 'autoresearch/program.md';
const HISTORY_FILE   = 'autoresearch/history.jsonl';
const SCORE_FILE     = 'autoresearch/score.json';
const BEST_GENERATOR = 'autoresearch/best/generator/generate-from-shortcuts.js';

// ── Parse args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const appName = args.find(a => !a.startsWith('-'));
const maxIterIdx = args.indexOf('--max-iter');
const maxIter = maxIterIdx !== -1 ? parseInt(args[maxIterIdx + 1], 10) : 20;
const dryRun  = args.includes('--dry-run');

if (!appName) {
  console.error('Usage: node scripts/autoresearch/loop.mjs <app-name> [--max-iter N] [--dry-run]');
  process.exit(1);
}

const shortcutsFile = resolve(`data/shortcuts/${appName}.json`);
const profileDir    = resolve(`profiles/${appName}`);

if (!existsSync(shortcutsFile)) {
  console.error(`Shortcuts file not found: ${shortcutsFile}`);
  process.exit(1);
}
if (!existsSync(GENERATOR_FILE)) {
  console.error(`Generator not found: ${GENERATOR_FILE}`);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
  console.error('ANTHROPIC_API_KEY not set. Export it or run with --dry-run.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', timeout: 60_000, ...opts });
  return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status ?? 1 };
}

function readScoreFile() {
  try { return JSON.parse(readFileSync(SCORE_FILE, 'utf8')); } catch { return null; }
}

function runGenerator() {
  return run('node', [GENERATOR_FILE, appName]);
}

function runScorer() {
  return run('node', ['scripts/autoresearch/score.mjs', profileDir, shortcutsFile]);
}

function saveBestGenerator(code) {
  mkdirSync('autoresearch/best/generator', { recursive: true });
  writeFileSync(BEST_GENERATOR, code, 'utf8');
}

function appendHistory(entry) {
  mkdirSync('autoresearch', { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', { flag: 'a' });
}

// ── Baseline ──────────────────────────────────────────────────────────────────

console.log(`\nAutoresearch Loop A — ${appName}  (max ${maxIter} iter${dryRun ? ', DRY RUN' : ''})`);
console.log('─'.repeat(62));

{
  const g = runGenerator();
  if (g.code !== 0) { console.error(`Baseline generator failed:\n${g.stderr}`); process.exit(1); }
  const s = runScorer();
  if (s.code !== 0) { console.error(`Baseline scorer failed:\n${s.stderr}`); process.exit(1); }
}

const baseline = readScoreFile();
if (!baseline) { console.error('Scorer produced no output'); process.exit(1); }

let bestScore = baseline.score;
let bestCode  = readFileSync(GENERATOR_FILE, 'utf8');
saveBestGenerator(bestCode);

console.log(`Baseline: ${baseline.score.toFixed(4)}  ` +
  `coverage=${baseline.coverage.toFixed(3)}  ` +
  `p1Density=${baseline.p1Density.toFixed(3)}  ` +
  `coherence=${baseline.coherence.toFixed(3)}`);
console.log('─'.repeat(62));

if (dryRun) {
  console.log('Dry run — would now call Claude API for each iteration.');
  console.log(`Best generator would be saved to: ${BEST_GENERATOR}`);
  process.exit(0);
}

// ── SIGINT: restore best on Ctrl-C ───────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n\nInterrupted — restoring best generator...');
  writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
  console.log(`Best score was: ${bestScore.toFixed(4)}`);
  process.exit(0);
});

// ── Main loop ─────────────────────────────────────────────────────────────────

const client = new Anthropic();
const program = existsSync(PROGRAM_FILE) ? readFileSync(PROGRAM_FILE, 'utf8') : '';

const SYSTEM = [
  'You are a Stream Deck profile layout algorithm optimizer.',
  '',
  'Research program:',
  program,
  '',
  'Task: propose ONE targeted modification to the generator script that improves',
  'the composite score (coverage 40% + p1Density 35% + coherence 25%).',
  '',
  'Respond with ONLY valid JSON — no markdown fences, no preamble:',
  '{"reason":"one sentence","code":"complete modified file"}',
].join('\n');

let noChangeStreak = 0;

for (let i = 1; i <= maxIter; i++) {
  const currentCode = readFileSync(GENERATOR_FILE, 'utf8');
  const currentScore = readScoreFile();

  process.stdout.write(`[${i}/${maxIter}] score=${bestScore.toFixed(4)}  `);

  // Call Claude API
  let parsed;
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          `Current score: ${bestScore.toFixed(4)}`,
          `  coverage=${currentScore?.coverage?.toFixed(3) ?? '?'}`,
          `  p1Density=${currentScore?.p1Density?.toFixed(3) ?? '?'}`,
          `  coherence=${currentScore?.coherence?.toFixed(3) ?? '?'}`,
          '',
          'Generator:',
          '```js',
          currentCode,
          '```',
          '',
          'Return JSON only.',
        ].join('\n'),
      }],
    });

    const raw = msg.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(raw);
  } catch (err) {
    console.log(`API/parse error — ${err.message.slice(0, 60)}`);
    noChangeStreak++;
    appendHistory({ iteration: i, kept: false, error: err.message.slice(0, 120) });
    if (noChangeStreak >= 3) break;
    continue;
  }

  if (!parsed?.code || !parsed?.reason) {
    console.log('malformed response — skipping');
    noChangeStreak++;
    continue;
  }

  // Apply proposed code
  writeFileSync(GENERATOR_FILE, parsed.code, 'utf8');

  // Run generator
  const genResult = runGenerator();
  if (genResult.code !== 0) {
    console.log(`✗ generator failed — reverting`);
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    appendHistory({ iteration: i, kept: false, reason: parsed.reason, error: 'generator_failed' });
    if (noChangeStreak >= 3) break;
    continue;
  }

  // Score
  runScorer();
  const newScore = readScoreFile();
  if (!newScore) {
    console.log('✗ scorer error — reverting');
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    continue;
  }

  const delta = newScore.score - bestScore;

  if (newScore.score > bestScore) {
    console.log(`✓ +${delta.toFixed(4)} → ${newScore.score.toFixed(4)}  "${parsed.reason}"`);
    bestScore = newScore.score;
    bestCode  = readFileSync(GENERATOR_FILE, 'utf8');
    saveBestGenerator(bestCode);
    noChangeStreak = 0;
    appendHistory({ iteration: i, score: newScore.score, delta, kept: true, reason: parsed.reason });
  } else {
    console.log(`✗ ${delta >= 0 ? '+' : ''}${delta.toFixed(4)} → reverted  "${parsed.reason}"`);
    writeFileSync(GENERATOR_FILE, bestCode, 'utf8');
    noChangeStreak++;
    appendHistory({ iteration: i, score: newScore.score, delta, kept: false, reason: parsed.reason });
  }

  if (noChangeStreak >= 3) {
    console.log(`\nEarly stop: ${noChangeStreak} consecutive misses — algorithm may be locally optimal.`);
    break;
  }
}

// Restore best generator
writeFileSync(GENERATOR_FILE, bestCode, 'utf8');

const improvement = bestScore - baseline.score;
console.log('\n' + '─'.repeat(62));
console.log(`Autoresearch complete: ${appName}`);
console.log(`Baseline → Best: ${baseline.score.toFixed(4)} → ${bestScore.toFixed(4)} (${improvement >= 0 ? '+' : ''}${improvement.toFixed(4)})`);
console.log(`Best generator:  ${BEST_GENERATOR}`);
console.log('─'.repeat(62));
