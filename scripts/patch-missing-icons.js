#!/usr/bin/env node

/**
 * Patch missing icons into an existing extracted profile, in place.
 *
 * Why: re-running generate-from-shortcuts.js against a full profile is a no-op
 * (getEmptyPositions returns nothing), so it can't repair Image fields after
 * the icon set is regenerated. This script walks every button, matches it to
 * a shortcut by title, and injects the matching icon via addImage().
 *
 * Usage: node scripts/patch-missing-icons.js <app-name> [--profile <name>]
 */

import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { addImage } from '../src/images.js';

const args = process.argv.slice(2);
const profileFlagIdx = args.indexOf('--profile');
let appName, profileName;
if (profileFlagIdx !== -1) {
  profileName = args[profileFlagIdx + 1];
  args.splice(profileFlagIdx, 2);
}
appName = args[0];
profileName = profileName || appName;

if (!appName) {
  console.error('Usage: node scripts/patch-missing-icons.js <app-name> [--profile <name>]');
  process.exit(1);
}

const shortcutData = JSON.parse(readFileSync(resolve(`data/shortcuts/${appName}.json`), 'utf8'));
const shortcuts = shortcutData.shortcuts;

const iconsDir = resolve(`data/icons/${appName}`);
if (!existsSync(iconsDir)) {
  console.error(`Icons dir not found: ${iconsDir}`);
  process.exit(1);
}
const iconFiles = readdirSync(iconsDir).filter(f => f.endsWith('.svg') || f.endsWith('.png')).sort();

function iconPathForIndex(idx) {
  const prefix = String(idx).padStart(3, '0') + '-';
  const match = iconFiles.find(f => f.startsWith(prefix));
  return match ? join(iconsDir, match) : null;
}

// Build title → index (labels are unique in vs-code.json; verify)
const titleToIndex = new Map();
const duplicates = [];
shortcuts.forEach((s, i) => {
  if (titleToIndex.has(s.label)) {
    duplicates.push({ label: s.label, indices: [titleToIndex.get(s.label), i] });
  } else {
    titleToIndex.set(s.label, i);
  }
});
if (duplicates.length) {
  console.warn('WARNING: duplicate labels in shortcuts.json — matching may be ambiguous:');
  for (const d of duplicates) console.warn(`   "${d.label.replace(/\n/g, '\\n')}" at ${d.indices}`);
}

const profileRoot = resolve(`profiles/${profileName}`);
const sdProfileParent = join(profileRoot, 'Profiles');
const sdProfileFolder = readdirSync(sdProfileParent).find(d => d.endsWith('.sdProfile'));
const pagesDir = join(sdProfileParent, sdProfileFolder, 'Profiles');
const pageFolders = readdirSync(pagesDir);

let patched = 0, skippedAlreadyOk = 0, unmatched = 0, missingIcon = 0;

for (const pageId of pageFolders) {
  const manifestPath = join(pagesDir, pageId, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const actions = manifest.Controllers?.[0]?.Actions || {};
  let pageDirty = false;

  for (const pos of Object.keys(actions)) {
    const action = actions[pos];
    const state = action.States?.[0];
    if (!state) continue;
    const title = state.Title;
    if (!title) continue;

    // Already has a valid image? skip.
    if (state.Image && state.Image.startsWith('Images/')) {
      const existingFile = state.Image.slice('Images/'.length);
      const fullPath = join(pagesDir, pageId, 'Images', existingFile);
      if (existsSync(fullPath)) {
        skippedAlreadyOk++;
        continue;
      }
    }

    const idx = titleToIndex.get(title);
    if (idx === undefined) {
      console.warn(`  UNMATCHED: [${manifest.Name}] ${pos} "${title.replace(/\n/g, '\\n')}"`);
      unmatched++;
      continue;
    }
    const iconPath = iconPathForIndex(idx);
    if (!iconPath) {
      console.warn(`  NO_ICON_FILE: [${manifest.Name}] ${pos} "${title.replace(/\n/g, '\\n')}" (expected prefix ${String(idx).padStart(3, '0')}-)`);
      missingIcon++;
      continue;
    }
    const imageRef = addImage(join(pagesDir, pageId), iconPath);
    state.Image = imageRef;
    pageDirty = true;
    patched++;
    console.log(`  PATCHED: [${manifest.Name}] ${pos} "${title.replace(/\n/g, '\\n')}" → ${imageRef}`);
  }

  if (pageDirty) {
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }
}

console.log(`\nDone: ${patched} patched, ${skippedAlreadyOk} already ok, ${unmatched} unmatched, ${missingIcon} missing icon file.`);
