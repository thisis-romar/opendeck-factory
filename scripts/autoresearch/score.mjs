#!/usr/bin/env node
// Usage: node scripts/autoresearch/score.mjs <profile-dir> <shortcuts-file>
// Outputs: autoresearch/score.json

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/autoresearch/score.mjs <profile-dir> <shortcuts-file>');
  process.exit(1);
}

const profileDir = resolve(args[0]);
const shortcutsFile = resolve(args[1]);

if (!existsSync(profileDir)) {
  console.error(`Profile dir not found: ${profileDir}`);
  process.exit(1);
}
if (!existsSync(shortcutsFile)) {
  console.error(`Shortcuts file not found: ${shortcutsFile}`);
  process.exit(1);
}

const shortcutData = JSON.parse(readFileSync(shortcutsFile, 'utf8'));
const shortcuts = shortcutData.shortcuts || [];
if (shortcuts.length === 0) {
  console.error('No shortcuts in data file');
  process.exit(1);
}

function normLabel(s) {
  return (s || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const labelMap = new Map(shortcuts.map(s => [normLabel(s.label), s]));

// Locate page directories — same logic as quality-gate.js
function locatePages(dir) {
  const pkgPath = join(dir, 'package.json');
  const liveManifest = join(dir, 'manifest.json');
  if (!existsSync(pkgPath) && existsSync(liveManifest)) {
    const m = JSON.parse(readFileSync(liveManifest, 'utf8'));
    const ids = m.Pages?.Pages || readdirSync(join(dir, 'Profiles'));
    return ids.map(uuid => join(dir, 'Profiles', uuid));
  }
  const profilesDir = join(dir, 'Profiles');
  const sdProfile = readdirSync(profilesDir).find(e => e.endsWith('.sdProfile'));
  if (!sdProfile) return [];
  const pagesDir = join(profilesDir, sdProfile, 'Profiles');
  return readdirSync(pagesDir).map(uuid => join(pagesDir, uuid));
}

const pageDirs = locatePages(profileDir);

// Map normalized label → 0-based page index of first occurrence
const placement = new Map();
for (let pageIdx = 0; pageIdx < pageDirs.length; pageIdx++) {
  const manifestPath = join(pageDirs[pageIdx], 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const actions = manifest.Controllers?.[0]?.Actions;
  if (!actions) continue;
  for (const action of Object.values(actions)) {
    const title = action.States?.[0]?.Title || '';
    const norm = normLabel(title);
    if (norm && !placement.has(norm)) {
      placement.set(norm, pageIdx);
    }
  }
}

const total = shortcuts.length;

// Coverage
let placed = 0;
for (const s of shortcuts) {
  if (placement.has(normLabel(s.label))) placed++;
}
const coverage = placed / total;

// P1 density — priority-1 shortcuts on page 0
const p1Shortcuts = shortcuts.filter(s => s.priority === 1);
const p1Total = p1Shortcuts.length;
let p1OnPage1 = 0;
for (const s of p1Shortcuts) {
  if (placement.get(normLabel(s.label)) === 0) p1OnPage1++;
}
const p1Density = p1Total > 0 ? p1OnPage1 / p1Total : 1.0;

// Coherence — categories whose shortcuts all land on one page
const categories = [...new Set(shortcuts.map(s => s.category))];
let intactCategories = 0;
for (const cat of categories) {
  const pages = new Set(
    shortcuts
      .filter(s => s.category === cat)
      .map(s => placement.get(normLabel(s.label)))
      .filter(p => p !== undefined)
  );
  if (pages.size <= 1) intactCategories++;
}
const coherence = categories.length > 0 ? intactCategories / categories.length : 1.0;

// visualScore: optional, injected by visual-score.mjs after a Tier 3 run.
// When present it shifts weights: coverage 35% + p1Density 30% + coherence 20% + visual 15%.
const existingVisual = (() => {
  if (!existsSync('autoresearch/score.json')) return null;
  try { return JSON.parse(readFileSync('autoresearch/score.json', 'utf8')).visualScore ?? null; } catch { return null; }
})();

const score = existingVisual !== null
  ? 0.35 * coverage + 0.30 * p1Density + 0.20 * coherence + 0.15 * existingVisual
  : 0.40 * coverage + 0.35 * p1Density + 0.25 * coherence;

const result = {
  score: parseFloat(score.toFixed(4)),
  coverage: parseFloat(coverage.toFixed(4)),
  p1Density: parseFloat(p1Density.toFixed(4)),
  coherence: parseFloat(coherence.toFixed(4)),
  visualScore: existingVisual,
  placed,
  total,
  p1Total,
  p1OnPage1,
  categories: categories.length,
  intactCategories,
  profileDir,
  shortcutsFile,
  timestamp: new Date().toISOString(),
};

mkdirSync('autoresearch', { recursive: true });
writeFileSync('autoresearch/score.json', JSON.stringify(result, null, 2));

console.log(`Score: ${score.toFixed(4)}  coverage=${coverage.toFixed(3)}  p1Density=${p1Density.toFixed(3)}  coherence=${coherence.toFixed(3)}`);
console.log(`  Placed: ${placed}/${total} shortcuts | P1 on page 1: ${p1OnPage1}/${p1Total} | Intact categories: ${intactCategories}/${categories.length}`);
