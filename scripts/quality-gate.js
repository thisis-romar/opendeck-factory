#!/usr/bin/env node

/**
 * Quality gate for a built Stream Deck profile.
 *
 * Usage: node scripts/quality-gate.js <profile-dir> [packed-file]
 * Output: qc-report.json written to <profile-dir>; exits 1 if rejected.
 *
 * Checks:
 *   1. validate()       — structural correctness
 *   2. Button count     — at least 1 button across all pages
 *   3. Icon dimensions  — Images/*.svg must declare width="144" height="144"
 *   4. PNG dimensions   — Images/*.png must be 144×144 (IHDR chunk)
 *   5. Packed size      — packed file must be < MAX_PACKED_BYTES (10 MB)
 */

import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { validate } from '../src/validate.js';

const MAX_PACKED_BYTES = 10 * 1024 * 1024; // 10 MB

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/quality-gate.js <profile-dir> [packed-file]');
  process.exit(1);
}

const profileDir = resolve(args[0]);
const packedFile = args[1] ? resolve(args[1]) : null;

if (!existsSync(profileDir)) {
  console.error(`Profile directory not found: ${profileDir}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readPngDimensions(filePath) {
  // PNG IHDR: bytes 16–23 = width (4 BE) + height (4 BE)
  const buf = readFileSync(filePath);
  if (buf.length < 24) return null;
  const sig = buf.slice(0, 8);
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  if (!isPng) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function checkSvgDimensions(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const hasWidth = /width=["']144["']/.test(content);
  const hasHeight = /height=["']144["']/.test(content);
  return { width: hasWidth ? 144 : null, height: hasHeight ? 144 : null };
}

// ── Detect format and locate pages ───────────────────────────────────────────

function locatePages(dir) {
  const pkgPath = join(dir, 'package.json');
  const rootManifestPath = join(dir, 'manifest.json');
  const liveFormat = !existsSync(pkgPath) && existsSync(rootManifestPath);

  if (liveFormat) {
    const manifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'));
    const pagesDir = join(dir, 'Profiles');
    const pageUUIDs = manifest.Pages?.Pages || readdirSync(pagesDir);
    return pageUUIDs.map(uuid => join(pagesDir, uuid));
  }

  // Normalized format
  const profilesDir = join(dir, 'Profiles');
  const sdProfiles = readdirSync(profilesDir).filter(e => e.endsWith('.sdProfile'));
  if (sdProfiles.length === 0) return [];
  const sdProfileDir = join(profilesDir, sdProfiles[0]);
  const innerPagesDir = join(sdProfileDir, 'Profiles');
  return readdirSync(innerPagesDir).map(uuid => join(innerPagesDir, uuid));
}

// ── Run checks ────────────────────────────────────────────────────────────────

const checks = [];
let approved = true;

function fail(name, message, detail = null) {
  checks.push({ name, passed: false, message, ...(detail ? { detail } : {}) });
  approved = false;
}

function pass(name, message, detail = null) {
  checks.push({ name, passed: true, message, ...(detail ? { detail } : {}) });
}

// 1. Structural validation
const validationResult = validate(profileDir);
if (validationResult.valid) {
  pass('validate', 'Structural validation passed');
} else {
  fail('validate', `Structural validation failed (${validationResult.errors.length} error(s))`, validationResult.errors);
}

// 2. Button count + 3/4. Icon dimensions
let totalButtons = 0;
const badIcons = [];

const pageDirs = locatePages(profileDir);

for (const pageDir of pageDirs) {
  const manifestPath = join(pageDir, 'manifest.json');
  if (!existsSync(manifestPath)) continue;

  const pageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const actions = pageManifest.Controllers?.[0]?.Actions;
  if (!actions) continue;

  for (const [, action] of Object.entries(actions)) {
    totalButtons++;
    if (!action.States) continue;
    for (const state of action.States) {
      if (!state.Image || state.Image.length === 0) continue;
      const imgPath = join(pageDir, state.Image);
      if (!existsSync(imgPath)) continue; // validate already catches missing files

      if (imgPath.endsWith('.svg')) {
        const dims = checkSvgDimensions(imgPath);
        if (dims.width !== 144 || dims.height !== 144) {
          badIcons.push({ file: state.Image, width: dims.width, height: dims.height });
        }
      } else if (imgPath.endsWith('.png')) {
        const dims = readPngDimensions(imgPath);
        if (!dims || dims.width !== 144 || dims.height !== 144) {
          badIcons.push({ file: state.Image, width: dims?.width ?? '?', height: dims?.height ?? '?' });
        }
      }
    }
  }
}

if (totalButtons === 0) {
  fail('button_count', 'Profile has 0 buttons');
} else {
  pass('button_count', `${totalButtons} button(s) found`);
}

if (badIcons.length === 0) {
  pass('icon_dimensions', 'All icons are 144×144');
} else {
  fail('icon_dimensions', `${badIcons.length} icon(s) are not 144×144`, badIcons);
}

// 5. Packed file size
if (packedFile) {
  if (!existsSync(packedFile)) {
    fail('packed_size', `Packed file not found: ${packedFile}`);
  } else {
    const bytes = statSync(packedFile).size;
    const kb = (bytes / 1024).toFixed(1);
    if (bytes > MAX_PACKED_BYTES) {
      fail('packed_size', `Packed file is ${kb} KB — exceeds ${MAX_PACKED_BYTES / 1024 / 1024} MB limit`, { bytes });
    } else {
      pass('packed_size', `Packed file is ${kb} KB`, { bytes });
    }
  }
} else {
  checks.push({ name: 'packed_size', passed: null, message: 'No packed file provided — skipped' });
}

// ── Report ────────────────────────────────────────────────────────────────────

const report = {
  profile: profileDir,
  packedFile: packedFile ?? null,
  verdict: approved ? 'APPROVED' : 'REJECTED',
  timestamp: new Date().toISOString(),
  checks,
};

const reportPath = join(profileDir, 'qc-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Print summary
console.log(`\nQuality Gate — ${report.verdict}`);
console.log(`Profile: ${profileDir}`);
for (const c of checks) {
  const icon = c.passed === true ? '✓' : c.passed === false ? '✗' : '–';
  console.log(`  ${icon} ${c.name}: ${c.message}`);
}
console.log(`\nReport: ${reportPath}`);

process.exit(approved ? 0 : 1);
