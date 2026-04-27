#!/usr/bin/env node
// Formal eval harness — wraps any autoresearch loop with the full operating protocol:
// branch isolation, locked evaluators, eval-tampering watchdog, checkpoints.log
//
// Usage: node scripts/autoresearch/eval-harness.mjs --loop <a|b|c> <app> [loop args...]
// Example: node scripts/autoresearch/eval-harness.mjs --loop c vs-code --max-iter 20 --max-budget-usd 5.00

import { readFileSync, writeFileSync, chmodSync, watchFile, unwatchFile, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCORE_FILE    = resolve('scripts/autoresearch/score.mjs');
const QUALITY_GATE  = resolve('scripts/quality-gate.js');
const CHECKPOINT_LOG = 'autoresearch/checkpoints.log';

const args = process.argv.slice(2);
const loopIdx = args.indexOf('--loop');
const loopType = loopIdx !== -1 ? args[loopIdx + 1] : 'a';
const remainingArgs = args.filter((_, i) => i !== loopIdx && i !== loopIdx + 1);

const appName = remainingArgs.find(a => !a.startsWith('-'));
if (!appName) {
  console.error('Usage: node scripts/autoresearch/eval-harness.mjs --loop <a|b|c> <app> [loop args...]');
  process.exit(1);
}

const LOOP_SCRIPTS = {
  a: 'scripts/autoresearch/loop.mjs',
  b: null, // Loop B runs as /autoresearch skill — not CLI-invokable from harness
  c: 'scripts/autoresearch/loop-c.mjs',
};

const loopScript = LOOP_SCRIPTS[loopType];
if (!loopScript) {
  console.error(`Loop B must be invoked via the /autoresearch Claude Code skill, not the harness.`);
  process.exit(1);
}
if (!existsSync(loopScript)) {
  console.error(`Loop script not found: ${loopScript}`);
  process.exit(1);
}

// ── Step 1: Pre-flight ─────────────────────────────────────────────────────────

console.log(`\nEval Harness — Loop ${loopType.toUpperCase()} on "${appName}"`);
console.log('─'.repeat(60));

const shortcutsFile = resolve(`data/shortcuts/${appName}.json`);
const profileDir    = resolve(`profiles/${appName}`);

if (!existsSync(shortcutsFile)) {
  console.error(`Pre-flight FAIL: shortcuts file not found: ${shortcutsFile}`);
  process.exit(1);
}
if (!existsSync(profileDir)) {
  console.error(`Pre-flight FAIL: profile directory not found: ${profileDir}`);
  process.exit(1);
}

// Run baseline score — abort if unknown
console.log('Pre-flight: scoring baseline...');
const baselineRun = spawnSync('node', ['scripts/autoresearch/score.mjs', profileDir, shortcutsFile], { encoding: 'utf8' });
if (baselineRun.status !== 0) {
  console.error(`Pre-flight FAIL: scorer returned non-zero:\n${baselineRun.stderr}`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync('autoresearch/score.json', 'utf8'));
console.log(`Pre-flight PASS: baseline score = ${baseline.score.toFixed(4)}`);

// ── Step 2: Branch isolation ───────────────────────────────────────────────────

const branchName = `autoresearch/loop-${loopType}-${Date.now()}`;
console.log(`\nCreating isolated branch: ${branchName}`);
const checkout = spawnSync('git', ['checkout', '-b', branchName], { encoding: 'utf8' });
if (checkout.status !== 0) {
  console.error(`Branch creation failed:\n${checkout.stderr}`);
  process.exit(1);
}
console.log(`On branch: ${branchName}`);

// ── Step 3: Lock eval files ────────────────────────────────────────────────────

console.log('\nLocking eval files (read-only)...');
try {
  chmodSync(SCORE_FILE,   0o444);
  chmodSync(QUALITY_GATE, 0o444);
  console.log(`  Locked: ${SCORE_FILE}`);
  console.log(`  Locked: ${QUALITY_GATE}`);
} catch (err) {
  console.warn(`  Warning: could not lock eval files (${err.message}) — continuing`);
}

// ── Eval tampering watchdog ────────────────────────────────────────────────────

let evalTampered = false;
const onEvalChange = (filename) => {
  console.error(`\n[HALT] Eval file modified during loop: ${filename}`);
  console.error('Loop aborted — this is a safety violation.');
  evalTampered = true;
  cleanup(1);
};

watchFile(SCORE_FILE,   { interval: 1000 }, () => onEvalChange(SCORE_FILE));
watchFile(QUALITY_GATE, { interval: 1000 }, () => onEvalChange(QUALITY_GATE));

// ── Cleanup helper ─────────────────────────────────────────────────────────────

function cleanup(exitCode = 0) {
  unwatchFile(SCORE_FILE);
  unwatchFile(QUALITY_GATE);
  try { chmodSync(SCORE_FILE,   0o644); } catch {}
  try { chmodSync(QUALITY_GATE, 0o644); } catch {}

  if (exitCode !== 0) {
    console.log('\nRestoring main branch...');
    spawnSync('git', ['checkout', 'master'], { encoding: 'utf8' });
  } else {
    console.log(`\nHarness complete on branch: ${branchName}`);
    console.log(`Review checkpoints.log, cherry-pick positive-delta commits, then merge to master.`);
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => { console.log('\nInterrupted.'); cleanup(0); });

// ── Step 4: Run loop ───────────────────────────────────────────────────────────

console.log(`\nStarting Loop ${loopType.toUpperCase()} (${loopScript})...`);
console.log('─'.repeat(60));

mkdirSync('autoresearch', { recursive: true });

const loopResult = spawnSync(
  'node',
  [loopScript, ...remainingArgs],
  { encoding: 'utf8', stdio: 'inherit', timeout: 3_600_000 }
);

if (evalTampered) cleanup(1);

// ── Step 5: Post-loop summary ──────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
if (existsSync(CHECKPOINT_LOG)) {
  const lines = readFileSync(CHECKPOINT_LOG, 'utf8').trim().split('\n').filter(Boolean);
  const kept    = lines.filter(l => { try { return JSON.parse(l).kept; } catch { return false; } }).length;
  const reverted = lines.length - kept;
  const finalScore = (() => {
    try {
      const last = lines.filter(l => { try { return JSON.parse(l).kept; } catch { return false; } }).pop();
      return last ? JSON.parse(last).score : baseline.score;
    } catch { return baseline.score; }
  })();
  console.log(`Checkpoint summary: ${lines.length} iterations — ${kept} kept, ${reverted} reverted`);
  console.log(`Baseline: ${baseline.score.toFixed(4)}  →  Final: ${finalScore.toFixed(4)}  (${finalScore >= baseline.score ? '+' : ''}${(finalScore - baseline.score).toFixed(4)})`);
}
console.log(`Branch: ${branchName}`);
console.log('Next: review checkpoints.log, cherry-pick positive-delta commits, merge to master after human review.');

cleanup(loopResult.status ?? 0);
