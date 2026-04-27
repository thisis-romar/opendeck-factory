#!/usr/bin/env node
// Generate animated GIF icons for Stream Deck profiles.
// Produces a subtle pulse/glow animation per shortcut using the category color.
//
// Usage: node scripts/generate-icons-animated.mjs <app-name>
// Output: data/icons/<app>/<index>-<label>.gif  (alongside existing SVG/PNG)
//
// Requires: npm install --save-dev gif-encoder-2

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import GifEncoder from 'gif-encoder-2';

const args = process.argv.slice(2);
const appName = args.find(a => !a.startsWith('-'));

if (!appName) {
  console.error('Usage: node scripts/generate-icons-animated.mjs <app-name>');
  process.exit(1);
}

const shortcutsBase = process.env.SHORTCUTS_DIR ? resolve(process.env.SHORTCUTS_DIR) : resolve('data/shortcuts');
const shortcutsPath = join(shortcutsBase, `${appName}.json`);
if (!existsSync(shortcutsPath)) {
  console.error(`Shortcut file not found: ${shortcutsPath}`);
  process.exit(1);
}

const shortcutData = JSON.parse(readFileSync(shortcutsPath, 'utf8'));
const shortcuts = shortcutData.shortcuts || [];

// Category → color mapping (from metadata or defaults)
const categoryStyles = shortcutData.metadata?.categoryStyles || {};
const DEFAULT_COLORS = {
  general:    '#4A90D9',
  navigation: '#7B68EE',
  view:       '#5B9BD5',
  editing:    '#E8A838',
  debug:      '#E05C5C',
  terminal:   '#50C878',
  search:     '#9B59B6',
  file:       '#3498DB',
  editor:     '#2ECC71',
  chord:      '#E67E22',
};

function getCategoryColor(category) {
  return categoryStyles[category]?.titleColor
    || DEFAULT_COLORS[category]
    || '#888888';
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sanitizeLabel(label) {
  return label.replace(/\n/g, ' ').replace(/[^a-zA-Z0-9\s-]/g, '').trim().slice(0, 20).replace(/\s+/g, '-').toLowerCase();
}

const ICON_SIZE = 72;  // Stream Deck button = 72px logical (144px retina, but GIF at 72)
const FRAMES = 6;      // 6 frames @ ~4fps → ~1.5s loop
const iconsDir = resolve(`data/icons/${appName}`);
mkdirSync(iconsDir, { recursive: true });

let generated = 0;
let skipped   = 0;

for (let i = 0; i < shortcuts.length; i++) {
  const shortcut = shortcuts[i];
  const label = sanitizeLabel(shortcut.label || `button-${i}`);
  const outPath = join(iconsDir, `${String(i).padStart(3, '0')}-${label}.gif`);

  if (existsSync(outPath)) { skipped++; continue; }

  const color = getCategoryColor(shortcut.category);
  const [r, g, b] = hexToRgb(color);

  // Build GIF with pulse animation: 6 frames, brightness oscillates 60%→100%→60%
  const encoder = new GifEncoder(ICON_SIZE, ICON_SIZE, 'neuquant', true);
  encoder.setDelay(250);   // 250ms per frame → ~4fps
  encoder.setRepeat(0);    // loop forever
  encoder.setQuality(10);

  const chunks = [];
  encoder.on('data', chunk => chunks.push(chunk));

  encoder.start();

  for (let f = 0; f < FRAMES; f++) {
    // Brightness: sine wave 0.6 to 1.0
    const brightness = 0.60 + 0.40 * Math.abs(Math.sin((f / FRAMES) * Math.PI));

    const canvas = createCanvas(ICON_SIZE, ICON_SIZE);
    const ctx = canvas.getContext('2d');

    // Background fill with animated brightness
    ctx.fillStyle = `rgb(${Math.round(r * brightness)},${Math.round(g * brightness)},${Math.round(b * brightness)})`;
    ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

    // Rounded rect overlay for depth
    ctx.fillStyle = `rgba(0,0,0,0.25)`;
    ctx.beginPath();
    ctx.roundRect(4, 4, ICON_SIZE - 8, ICON_SIZE - 8, 8);
    ctx.fill();

    // Label text (1-2 lines, white)
    const lines = shortcut.label.replace(/\n+$/, '').split('\n').filter(Boolean).slice(0, 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = lines.length > 1 ? 11 : 13;
    ctx.font = `bold ${fontSize}px sans-serif`;

    if (lines.length === 1) {
      ctx.fillText(lines[0], ICON_SIZE / 2, ICON_SIZE / 2);
    } else {
      ctx.fillText(lines[0], ICON_SIZE / 2, ICON_SIZE / 2 - 8);
      ctx.fillText(lines[1], ICON_SIZE / 2, ICON_SIZE / 2 + 8);
    }

    encoder.addFrame(ctx);
  }

  encoder.finish();

  const gifBuffer = Buffer.concat(chunks);
  writeFileSync(outPath, gifBuffer);
  generated++;

  if (generated % 10 === 0) {
    process.stdout.write(`  ${generated}/${shortcuts.length - skipped} animated icons written...\r`);
  }
}

console.log(`\nDone: ${generated} GIF icons generated, ${skipped} already existed.`);
console.log(`Output: ${iconsDir}/`);
