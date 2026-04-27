#!/usr/bin/env node
// Tier 3 visual scorer — installs profile into Stream Deck app and captures a
// screenshot, comparing it against a reference image to produce a visual score.
//
// Usage: node scripts/autoresearch/visual-score.mjs <packed-file> [--reference <png>]
// Output: autoresearch/score.json gains a `visualScore` field (0-1)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const packedFile     = args.find(a => !a.startsWith('-'));
const refIdx         = args.indexOf('--reference');
const customRef      = refIdx !== -1 ? args[refIdx + 1] : null;

if (!packedFile) {
  console.error('Usage: node scripts/autoresearch/visual-score.mjs <packed-file> [--reference <png>]');
  process.exit(1);
}

const appName = basename(packedFile, '.streamDeckProfile').replace(/\s+/g, '-').toLowerCase();
const referenceDir = 'autoresearch/visual-reference';
const referencePath = customRef || join(referenceDir, `${appName}.png`);
const screenshotPath = join('autoresearch', `screenshot-${appName}-${Date.now()}.png`);
const SCORE_FILE = 'autoresearch/score.json';

// ── Step 1: Install profile via MCP live_test_profile ─────────────────────────

console.log(`Visual scorer: installing ${packedFile}...`);

// Invoke via MCP client (node call to mcp-server directly as subprocess)
const installResult = spawnSync('node', [
  '-e',
  `
  import('./src/mcp-server.js').then(async m => {
    // live_test_profile is invoked by running install-profile.js + verify-profile.js
    // We call install-profile.js directly here
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('node', ['scripts/install-profile.js', '${packedFile.replace(/\\/g, '\\\\')}'], { encoding: 'utf8', stdio: 'inherit' });
    process.exit(r.status ?? 0);
  }).catch(e => { console.error(e.message); process.exit(1); });
  `,
], { encoding: 'utf8', timeout: 30_000, stdio: 'inherit' });

if (installResult.status !== 0) {
  console.warn('Visual scorer: profile install failed — skipping visual score');
  appendVisualScore(null);
  process.exit(0);
}

// ── Step 2: Capture screenshot ────────────────────────────────────────────────

// Wait for Stream Deck app to settle (2s)
await new Promise(r => setTimeout(r, 2000));

mkdirSync('autoresearch', { recursive: true });

// Try Windows screenshot via PowerShell if Windows-MCP not available
const screenshotResult = spawnSync('powershell', [
  '-NoProfile', '-NonInteractive', '-Command',
  `Add-Type -AssemblyName System.Windows.Forms; $bmp = [System.Drawing.Bitmap]::new([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size); $bmp.Save('${screenshotPath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $bmp.Dispose(); Write-Host 'captured'`,
], { encoding: 'utf8', timeout: 10_000 });

if (screenshotResult.status !== 0 || !existsSync(screenshotPath)) {
  console.warn('Visual scorer: screenshot failed — skipping visual score');
  appendVisualScore(null);
  process.exit(0);
}
console.log(`Screenshot saved: ${screenshotPath}`);

// ── Step 3: Compare against reference ─────────────────────────────────────────

if (!existsSync(referencePath)) {
  // No reference yet — save current screenshot as the reference
  mkdirSync(referenceDir, { recursive: true });
  spawnSync('powershell', ['-Command', `Copy-Item '${screenshotPath}' '${referencePath}'`], { encoding: 'utf8' });
  console.log(`Reference image saved (first run): ${referencePath}`);
  appendVisualScore(1.0, 0, screenshotPath);
  process.exit(0);
}

// Use PowerShell to compute pixel diff between reference and screenshot
const diffScript = `
Add-Type -AssemblyName System.Drawing
$ref = [System.Drawing.Bitmap]::new('${referencePath.replace(/\\/g, '\\\\')}')
$cur = [System.Drawing.Bitmap]::new('${screenshotPath.replace(/\\/g, '\\\\')}')
$w = [Math]::Min($ref.Width, $cur.Width)
$h = [Math]::Min($ref.Height, $cur.Height)
$diff = 0
for ($x = 0; $x -lt $w; $x++) {
  for ($y = 0; $y -lt $h; $y++) {
    $rp = $ref.GetPixel($x, $y)
    $cp = $cur.GetPixel($x, $y)
    $d = [Math]::Abs($rp.R - $cp.R) + [Math]::Abs($rp.G - $cp.G) + [Math]::Abs($rp.B - $cp.B)
    if ($d -gt 30) { $diff++ }
  }
}
$ref.Dispose(); $cur.Dispose()
$total = $w * $h
$score = [Math]::Round(1 - ($diff / $total), 4)
Write-Output "$diff $total $score"
`;

const diffResult = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', diffScript], { encoding: 'utf8', timeout: 30_000 });
const parts = (diffResult.stdout || '').trim().split(' ');
const diffPixels = parseInt(parts[0], 10) || 0;
const totalPixels = parseInt(parts[1], 10) || 1;
const rawVisualScore = parseFloat(parts[2]) || 0;

// Clamp to 0-1
const visualScore = Math.max(0, Math.min(1, rawVisualScore));

console.log(`Visual score: ${visualScore.toFixed(4)} (${diffPixels} diff pixels / ${totalPixels} total)`);
appendVisualScore(visualScore, diffPixels, screenshotPath);

// ── Helper ────────────────────────────────────────────────────────────────────

function appendVisualScore(visualScore, diffPixels = 0, screenshotPath = null) {
  let existing = {};
  if (existsSync(SCORE_FILE)) {
    try { existing = JSON.parse(readFileSync(SCORE_FILE, 'utf8')); } catch {}
  }

  // Recompute composite score with visual tier if available
  let compositeScore = existing.score ?? null;
  if (visualScore !== null && existing.coverage !== undefined) {
    compositeScore = parseFloat(
      (0.35 * existing.coverage + 0.30 * existing.p1Density + 0.20 * existing.coherence + 0.15 * visualScore).toFixed(4)
    );
  }

  const updated = {
    ...existing,
    score: compositeScore ?? existing.score,
    visualScore,
    diffPixels,
    screenshotPath,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(SCORE_FILE, JSON.stringify(updated, null, 2));
}

// Top-level await compatibility — this file uses await at top level
// Node handles this via ESM top-level await when type=module
