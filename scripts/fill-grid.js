import { resolve } from 'node:path';
import { ProfileEditor } from '../src/profile.js';

const extractedDir = resolve('profiles/vs-code');
const editor = new ProfileEditor(extractedDir);

// Find the active page (the one with actions — "Page 1-Main")
const pages = editor.getPageUUIDs();
let targetPage = null;

for (const pageUUID of pages) {
  const actions = editor.getActions(pageUUID);
  if (actions && Object.keys(actions).length > 0) {
    targetPage = pageUUID;
    break;
  }
}

if (!targetPage) {
  console.error('No active page found with existing actions.');
  process.exit(1);
}

console.log(`Target page: "${editor.getPageManifest(targetPage).Name}" [${targetPage}]`);
console.log(`Empty positions: ${editor.getEmptyPositions(targetPage).map(p => `${p.col},${p.row}`).join(', ')}`);

// New buttons to fill the grid
const newButtons = [
  { col: 1, row: 0, label: "Command\nPalette\n", key: "P", ctrl: true, shift: true },
  { col: 2, row: 0, label: "Quick\nOpen\n", key: "P", ctrl: true },
  { col: 3, row: 0, label: "Terminal\n", key: "BACKTICK", ctrl: true },
  { col: 3, row: 1, label: "Find in\nFiles\n", key: "F", ctrl: true, shift: true },
  { col: 0, row: 2, label: "Undo\n", key: "Z", ctrl: true },
  { col: 1, row: 2, label: "Redo\n", key: "Y", ctrl: true },
  { col: 2, row: 2, label: "Format\nDoc\n", key: "F", shift: true, alt: true },
  { col: 3, row: 2, label: "Word\nWrap\n", key: "Z", alt: true },
  { col: 4, row: 1, label: "Explorer\n", key: "E", ctrl: true, shift: true },
];

for (const btn of newButtons) {
  const existing = editor.getAction(targetPage, btn.col, btn.row);
  if (existing) {
    console.log(`  Skipping ${btn.col},${btn.row} — already has action`);
    continue;
  }

  editor.addHotkeyButton(targetPage, btn.col, btn.row, {
    label: btn.label,
    key: btn.key,
    ctrl: btn.ctrl,
    shift: btn.shift,
    alt: btn.alt,
    win: btn.win,
  });
  console.log(`  Added ${btn.col},${btn.row}: ${btn.label.replace(/\n/g, ' ').trim()}`);
}

editor.save();
console.log('\nGrid filled. Run `node src/index.js list profiles/vs-code` to verify.');
