#!/usr/bin/env node

/**
 * Generate colored SVG button icons for Stream Deck profiles.
 *
 * Usage: node scripts/generate-icons.js <app-name>
 * Example: node scripts/generate-icons.js vs-code
 *
 * Reads data/shortcuts/<app-name>.json and generates one SVG icon per shortcut,
 * color-coded by category. Output to data/icons/<app-name>/<index>.svg
 */

import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CATEGORY_COLORS = {
  general:    { bg: '#3B82F6', text: '#FFFFFF' },  // blue
  navigation: { bg: '#22C55E', text: '#FFFFFF' },  // green
  view:       { bg: '#A855F7', text: '#FFFFFF' },  // purple
  editing:    { bg: '#F97316', text: '#FFFFFF' },  // orange
  debug:      { bg: '#EF4444', text: '#FFFFFF' },  // red
  terminal:   { bg: '#14B8A6', text: '#FFFFFF' },  // teal
  search:     { bg: '#EAB308', text: '#1F2937' },  // amber (dark text for contrast)
  file:       { bg: '#6366F1', text: '#FFFFFF' },  // indigo
  editor:     { bg: '#0EA5E9', text: '#FFFFFF' },  // sky
  chord:      { bg: '#EC4899', text: '#FFFFFF' },  // pink
};

const KEY_DISPLAY_OVERRIDES = {
  BACKTICK: '`',  MINUS: '-',  EQUALS: '=',
  LBRACKET: '[', RBRACKET: ']', BACKSLASH: '\\',
  SEMICOLON: ';', QUOTE: "'", COMMA: ',', PERIOD: '.', SLASH: '/',
  SPACE: 'Space', ENTER: 'Enter', ESCAPE: 'Esc', TAB: 'Tab',
  BACKSPACE: 'Bksp', DELETE: 'Del',
};

function formatKeyStep({ key, ctrl, shift, alt, win }) {
  const parts = [];
  if (ctrl) parts.push('Ctrl');
  if (shift) parts.push('Shift');
  if (alt) parts.push('Alt');
  if (win) parts.push('Win');
  parts.push(KEY_DISPLAY_OVERRIDES[key] ?? key);
  return parts.join('+');
}

function buildShortcutText(shortcut) {
  if (shortcut.type === 'chord' && Array.isArray(shortcut.chordKeys)) {
    return shortcut.chordKeys.map(formatKeyStep).join(' → ');
  }
  return formatKeyStep({
    key: shortcut.key,
    ctrl: shortcut.modifiers?.ctrl,
    shift: shortcut.modifiers?.shift,
    alt: shortcut.modifiers?.alt,
    win: shortcut.modifiers?.win,
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateSvgIcon(shortcut, colors) {
  const shortcutText = escapeXml(buildShortcutText(shortcut));

  // Determine font size for the shortcut text based on length
  let shortcutFontSize = 20;
  if (shortcutText.length > 16) shortcutFontSize = 13;
  else if (shortcutText.length > 12) shortcutFontSize = 15;
  else if (shortcutText.length > 8) shortcutFontSize = 17;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="12" fill="${colors.bg}"/>
  <text x="72" y="78" text-anchor="middle" dominant-baseline="central"
        font-family="Segoe UI, Arial, sans-serif" font-size="${shortcutFontSize}" font-weight="600"
        fill="${colors.text}" opacity="0.35">${shortcutText}</text>
</svg>`;
}

// Main
const appName = process.argv[2];
if (!appName) {
  console.error('Usage: node scripts/generate-icons.js <app-name>');
  process.exit(1);
}

const shortcutsPath = resolve(`data/shortcuts/${appName}.json`);
if (!existsSync(shortcutsPath)) {
  console.error(`Shortcut file not found: ${shortcutsPath}`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(shortcutsPath, 'utf8'));
const outDir = resolve(`data/icons/${appName}`);
mkdirSync(outDir, { recursive: true });

let count = 0;
for (let i = 0; i < data.shortcuts.length; i++) {
  const shortcut = data.shortcuts[i];
  const colors = CATEGORY_COLORS[shortcut.category] || CATEGORY_COLORS.general;
  const svg = generateSvgIcon(shortcut, colors);
  const filename = `${String(i).padStart(3, '0')}-${shortcut.command.replace(/[^a-zA-Z0-9.]/g, '-')}.svg`;
  writeFileSync(join(outDir, filename), svg);
  count++;
}

console.log(`Generated ${count} icons in ${outDir}`);
