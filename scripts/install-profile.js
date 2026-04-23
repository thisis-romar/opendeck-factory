#!/usr/bin/env node
/**
 * Install a Stream Deck profile into the app's live ProfilesV3 directory.
 *
 * Usage:
 *   node scripts/install-profile.js <source>
 *
 * <source> may be:
 *   - A packed .streamDeckProfile file  (ZIP)
 *   - An extracted profile directory    (contains manifest.json at root)
 *
 * Resolution strategy:
 *   1. Read the profile Name from manifest.json
 *   2. Scan ProfilesV3 for an existing profile with that Name
 *   3. If found: backup the existing dir and overwrite it
 *   4. If not found: create a new UUID directory
 *
 * Output: writes install-report.json to cwd; exits 0 on success, 1 on error.
 */

import { resolve, join, basename } from 'node:path';
import { existsSync, readdirSync, mkdirSync, cpSync, renameSync,
         readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';

const PROFILES_V3 = resolve(process.env.APPDATA, 'Elgato/StreamDeck/ProfilesV3');
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/install-profile.js <source>');
  process.exit(1);
}

const source = resolve(args[0]);
if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

if (!existsSync(PROFILES_V3)) {
  console.error(`ProfilesV3 directory not found: ${PROFILES_V3}`);
  console.error('Is the Elgato Stream Deck app installed?');
  process.exit(1);
}

// ── Step 1: resolve to an extracted directory ─────────────────────────────────

let extractedDir = source;
let tempDir = null;

if (source.endsWith('.streamDeckProfile')) {
  tempDir = join(tmpdir(), `opendeck-install-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const zip = new AdmZip(source);
  zip.extractAllTo(tempDir, true);
  extractedDir = tempDir;
}

const manifestPath = join(extractedDir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`manifest.json not found in: ${extractedDir}`);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const profileName = manifest.Name;
if (!profileName) {
  console.error('manifest.json has no Name field');
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}

// ── Step 2: find existing profile by Name in ProfilesV3 ──────────────────────

let targetUUID = null;
let backupPath = null;

for (const entry of readdirSync(PROFILES_V3)) {
  if (!entry.endsWith('.sdProfile')) continue;
  const candidateManifest = join(PROFILES_V3, entry, 'manifest.json');
  if (!existsSync(candidateManifest)) continue;
  try {
    const m = JSON.parse(readFileSync(candidateManifest, 'utf8'));
    if (m.Name === profileName) {
      targetUUID = entry.replace(/\.sdProfile$/, '');
      break;
    }
  } catch {
    // skip unreadable manifests
  }
}

const destDir = join(PROFILES_V3, `${targetUUID ?? randomUUID().toUpperCase()}.sdProfile`);

// ── Step 3: backup existing, then install ────────────────────────────────────

if (existsSync(destDir)) {
  backupPath = `${destDir}_backup-${Date.now()}`;
  renameSync(destDir, backupPath);
  console.log(`Backed up existing profile to: ${basename(backupPath)}`);
}

cpSync(extractedDir, destDir, { recursive: true });
console.log(`Installed "${profileName}" → ${destDir}`);

if (tempDir) rmSync(tempDir, { recursive: true, force: true });

// ── Report ────────────────────────────────────────────────────────────────────

const installedUUID = basename(destDir).replace(/\.sdProfile$/, '');
const report = {
  status: 'installed',
  profile_name: profileName,
  profile_uuid: installedUUID,
  install_path: destDir,
  backup_path: backupPath ?? null,
  timestamp: new Date().toISOString(),
};

writeFileSync('install-report.json', JSON.stringify(report, null, 2));
console.log(`\nInstall report: install-report.json`);
console.log(`UUID: ${installedUUID}`);
