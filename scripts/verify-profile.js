#!/usr/bin/env node
/**
 * Verify a Stream Deck profile is correctly installed by restarting the app
 * and checking the installed file structure.
 *
 * Usage:
 *   node scripts/verify-profile.js <profile-uuid>
 *
 * Steps:
 *   1. Kill StreamDeck.exe (graceful → force after 3s)
 *   2. Wait for process to exit (max 10s)
 *   3. Relaunch StreamDeck.exe from its known install path
 *   4. Wait for app to come up (max 30s, poll every 2s)
 *   5. Verify installed profile files: count buttons, check image refs
 *   6. Emit test-report.json; exit 0 on PASS, 1 on FAIL
 *
 * Note: screenshot comparison is handled by the calling agent via
 * mcp__windows-mcp__Screenshot after this script exits.
 */

import { resolve, join } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync, spawnSync } from 'node:child_process';

const PROFILES_V3 = resolve(process.env.APPDATA, 'Elgato/StreamDeck/ProfilesV3');
const STREAMDECK_EXE_CANDIDATES = [
  'C:/Program Files/Elgato/StreamDeck/StreamDeck.exe',
  'C:/Program Files (x86)/Elgato/StreamDeck/StreamDeck.exe',
];

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/verify-profile.js <profile-uuid>');
  process.exit(1);
}

const profileUUID = args[0].replace(/\.sdProfile$/, '');
const profileDir = join(PROFILES_V3, `${profileUUID}.sdProfile`);

if (!existsSync(profileDir)) {
  console.error(`Installed profile not found: ${profileDir}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ps(command) {
  return spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8',
  });
}

function isProcessRunning(name) {
  const result = ps(`Get-Process -Name ${name} -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count`);
  return parseInt(result.stdout?.trim() ?? '0', 10) > 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitFor(condition, intervalMs, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return true;
    await sleep(intervalMs);
  }
  console.warn(`Timed out waiting for: ${label}`);
  return false;
}

// ── Step 1–2: Kill StreamDeck.exe ────────────────────────────────────────────

if (isProcessRunning('StreamDeck')) {
  console.log('Stopping StreamDeck.exe...');
  ps('Stop-Process -Name StreamDeck -Force -ErrorAction SilentlyContinue');
  const stopped = await waitFor(
    () => !isProcessRunning('StreamDeck'),
    500, 10000, 'StreamDeck.exe to exit'
  );
  if (!stopped) console.warn('StreamDeck.exe did not exit within 10s — continuing anyway');
} else {
  console.log('StreamDeck.exe not running — skipping kill step');
}

// ── Step 3: Relaunch ─────────────────────────────────────────────────────────

let streamDeckExe = null;
for (const candidate of STREAMDECK_EXE_CANDIDATES) {
  if (existsSync(candidate)) { streamDeckExe = candidate; break; }
}

if (streamDeckExe) {
  console.log(`Launching: ${streamDeckExe}`);
  ps(`Start-Process -FilePath '${streamDeckExe.replace(/'/g, "''")}'`);
  const started = await waitFor(
    () => isProcessRunning('StreamDeck'),
    2000, 30000, 'StreamDeck.exe to start'
  );
  if (!started) console.warn('StreamDeck.exe did not start within 30s — continuing with file check');
} else {
  console.warn('StreamDeck.exe not found in known locations — skipping relaunch');
}

// ── Step 4: Wait a moment for the app to settle ───────────────────────────────

await sleep(3000);

// ── Step 5: Verify installed profile files ───────────────────────────────────

const rootManifestPath = join(profileDir, 'manifest.json');
const rootManifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'));
const pageUUIDs = rootManifest.Pages?.Pages ?? [];
const pagesDir = join(profileDir, 'Profiles');

const checks = [];
let totalButtons = 0;
const mismatches = [];

// Check each page
for (const pageUUID of pageUUIDs) {
  const pageManifestPath = join(pagesDir, pageUUID, 'manifest.json');
  if (!existsSync(pageManifestPath)) {
    checks.push({ page: pageUUID, passed: false, issue: 'manifest.json missing' });
    mismatches.push(`Page ${pageUUID}: manifest.json missing`);
    continue;
  }

  let pageManifest;
  try {
    pageManifest = JSON.parse(readFileSync(pageManifestPath, 'utf8'));
  } catch {
    checks.push({ page: pageUUID, passed: false, issue: 'manifest.json unreadable' });
    mismatches.push(`Page ${pageUUID}: manifest.json unreadable`);
    continue;
  }

  const actions = pageManifest.Controllers?.[0]?.Actions ?? {};
  const buttonCount = Object.keys(actions).length;
  totalButtons += buttonCount;

  // Check image refs
  const badImages = [];
  for (const [pos, action] of Object.entries(actions)) {
    for (const state of action.States ?? []) {
      if (state.Image && state.Image.length > 0) {
        const imgPath = join(pagesDir, pageUUID, state.Image);
        if (!existsSync(imgPath)) {
          badImages.push(`${pos}: ${state.Image} missing`);
        }
      }
    }
  }

  if (badImages.length > 0) {
    checks.push({ page: pageUUID, passed: false, buttons: buttonCount, bad_images: badImages });
    mismatches.push(...badImages.map(b => `Page ${pageUUID}: ${b}`));
  } else {
    checks.push({ page: pageUUID, passed: true, buttons: buttonCount });
  }
}

const allPassed = checks.every(c => c.passed);
const verdict = allPassed ? 'PASS' : 'FAIL';

// ── Report ────────────────────────────────────────────────────────────────────

const report = {
  verdict,
  profile_uuid: profileUUID,
  profile_name: rootManifest.Name,
  install_path: profileDir,
  pages_checked: pageUUIDs.length,
  buttons_total: totalButtons,
  mismatches,
  page_checks: checks,
  streamdeck_running: isProcessRunning('StreamDeck'),
  timestamp: new Date().toISOString(),
};

writeFileSync('test-report.json', JSON.stringify(report, null, 2));

console.log(`\nVerify — ${verdict}`);
console.log(`Profile: ${rootManifest.Name} (${profileUUID})`);
console.log(`Pages: ${pageUUIDs.length}  Buttons: ${totalButtons}`);
if (mismatches.length > 0) {
  console.log('Mismatches:');
  for (const m of mismatches) console.log(`  ✗ ${m}`);
}
console.log(`\nReport: test-report.json`);

process.exit(allPassed ? 0 : 1);
