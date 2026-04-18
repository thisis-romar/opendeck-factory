#!/usr/bin/env node

/**
 * Generate a Stream Deck profile from a shortcut data file.
 *
 * Usage: node scripts/generate-from-shortcuts.js <app-name> [--profile <name>]
 * Example: node scripts/generate-from-shortcuts.js vs-code
 * Example: node scripts/generate-from-shortcuts.js vs-code --profile vs-code-colored
 *
 * Reads data/shortcuts/<app-name>.json and populates a profile in profiles/<app-name>/
 * (or profiles/<profile-name>/ if --profile is specified).
 */

import { resolve, join } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { ProfileEditor } from '../src/profile.js';

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
  console.error('Usage: node scripts/generate-from-shortcuts.js <app-name> [--profile <name>]');
  process.exit(1);
}

// Load shortcut data
const shortcutsPath = resolve(`data/shortcuts/${appName}.json`);
if (!existsSync(shortcutsPath)) {
  console.error(`Shortcut file not found: ${shortcutsPath}`);
  console.error(`Create data/shortcuts/${appName}.json first.`);
  process.exit(1);
}

const shortcutData = JSON.parse(readFileSync(shortcutsPath, 'utf8'));
const shortcuts = shortcutData.shortcuts;

if (!shortcuts || !Array.isArray(shortcuts)) {
  console.error('Invalid shortcut file: expected { shortcuts: [...] }');
  process.exit(1);
}

// Clone template or use existing profile
const profileDir = resolve(`profiles/${profileName}`);
const templateDir = resolve('profiles/_template');

let editor;
if (!existsSync(profileDir)) {
  if (!existsSync(templateDir)) {
    console.error('Template profile not found at profiles/_template/');
    process.exit(1);
  }
  const displayName = shortcutData.metadata?.displayName || appName;
  editor = ProfileEditor.initFromTemplate(templateDir, profileDir, displayName);
  console.log(`Created profile from template: profiles/${profileName}/`);
} else {
  editor = new ProfileEditor(profileDir);
}
const { cols, rows } = editor.deviceInfo;
const keysPerPage = cols * rows;
const pages = editor.getPageUUIDs();

console.log(`Device: ${editor.deviceInfo.name} (${cols}x${rows} = ${keysPerPage} keys/page)`);
console.log(`Pages available: ${pages.length}`);
console.log(`Shortcuts to place: ${shortcuts.length}`);

// Category → row mapping for MK.2 (5x3)
const CATEGORY_ROW_ORDER = ['general', 'navigation', 'view', 'editing', 'debug', 'terminal', 'search', 'file', 'editor', 'chord'];

// Load icons if available
const iconsDir = resolve(`data/icons/${appName}`);
const hasIcons = existsSync(iconsDir);
let iconFiles = [];
if (hasIcons) {
  iconFiles = readdirSync(iconsDir).filter(f => f.endsWith('.svg') || f.endsWith('.png')).sort();
  console.log(`Icons available: ${iconFiles.length} in ${iconsDir}`);
}

// Build index→icon map (icons are generated in same order as shortcuts array)
function getIconPath(originalIndex) {
  if (!hasIcons) return undefined;
  const prefix = String(originalIndex).padStart(3, '0') + '-';
  const match = iconFiles.find(f => f.startsWith(prefix));
  return match ? resolve(join(iconsDir, match)) : undefined;
}

// Track original indices before sorting
const indexedShortcuts = shortcuts.map((s, i) => ({ ...s, _originalIndex: i }));

// Sort shortcuts: by priority within each category
const sorted = [...indexedShortcuts].sort((a, b) => {
  const catA = CATEGORY_ROW_ORDER.indexOf(a.category);
  const catB = CATEGORY_ROW_ORDER.indexOf(b.category);
  if (catA !== catB) return catA - catB;
  return (a.priority || 99) - (b.priority || 99);
});

// Place shortcuts into grid
let pageIdx = 0;
let placed = 0;
let skipped = 0;

for (const shortcut of sorted) {
  if (pageIdx >= pages.length) {
    console.log(`  No more pages available, stopping at ${placed} shortcuts.`);
    break;
  }

  const targetPage = pages[pageIdx];
  const empty = editor.getEmptyPositions(targetPage);

  if (empty.length === 0) {
    pageIdx++;
    if (pageIdx >= pages.length) {
      console.log(`  No more pages available, stopping at ${placed} shortcuts.`);
      break;
    }
    const nextEmpty = editor.getEmptyPositions(pages[pageIdx]);
    if (nextEmpty.length === 0) break;
  }

  const currentPage = pages[pageIdx];
  const pos = editor.getEmptyPositions(currentPage)[0];

  try {
    const iconPath = getIconPath(shortcut._originalIndex);
    const style = shortcut.style || shortcutData.metadata?.categoryStyles?.[shortcut.category] || {};

    if (shortcut.type === 'chord' && shortcut.chordKeys) {
      // Multi-action for chord shortcuts
      editor.addMultiActionButton(currentPage, pos.col, pos.row, {
        label: shortcut.label,
        steps: shortcut.chordKeys,
        imagePath: iconPath,
        titleColor: style.titleColor,
        titleAlignment: style.titleAlignment,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
      });
    } else {
      // Standard hotkey
      editor.addHotkeyButton(currentPage, pos.col, pos.row, {
        label: shortcut.label,
        key: shortcut.key,
        ctrl: shortcut.modifiers?.ctrl || false,
        shift: shortcut.modifiers?.shift || false,
        alt: shortcut.modifiers?.alt || false,
        win: shortcut.modifiers?.win || false,
        imagePath: iconPath,
        titleColor: style.titleColor,
        titleAlignment: style.titleAlignment,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
      });
    }
    placed++;
    const pageName = editor.getPageManifest(currentPage).Name;
    const keyDesc = shortcut.type === 'chord' ? shortcut.chordKeys.map(k => k.key).join('→') : shortcut.key;
    console.log(`  [${pageName}] ${pos.col},${pos.row}: ${shortcut.label.replace(/\n/g, ' ').trim()} (${keyDesc})`);
  } catch (err) {
    console.log(`  SKIP: ${shortcut.label.replace(/\n/g, ' ').trim()} — ${err.message}`);
    skipped++;
  }
}

editor.save();
console.log(`\nDone: ${placed} placed, ${skipped} skipped.`);
console.log(`Run: node src/index.js validate profiles/${profileName}`);
console.log(`Then: node src/index.js pack profiles/${profileName} "builds/${shortcutData.metadata?.displayName || profileName}.streamDeckProfile"`);
