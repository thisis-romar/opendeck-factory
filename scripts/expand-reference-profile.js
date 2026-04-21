#!/usr/bin/env node
// Expands the reference profile with variant buttons and per-page color coding.
// Run: node scripts/expand-reference-profile.js
// IMPORTANT: Stop Stream Deck app before running this script.

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const APPDATA = process.env.APPDATA;
const PROFILE_ROOT = join(
  APPDATA,
  'Elgato/StreamDeck/ProfilesV3/692919F2-4A89-4E00-B263-8488434CB04A.sdProfile'
);

const PAGE_UUIDS = {
  1: 'C5D41851-F557-4761-BC5C-BDE906E3BB13',
  2: '564D9B5B-CFDC-4129-95CF-5B3961B283BA',
  3: 'C3F9ED85-4D3E-4E56-96AD-148975110E6D',
  4: '9BF4637A-6E09-4FFB-A1E4-E7AA22066883',
};

const PAGE_COLORS = {
  1: '#0d2240', // Navy blue  — System
  2: '#0a2410', // Forest green — Stream Deck
  3: '#2a1400', // Dark amber — Navigation
  4: '#1a0a2e', // Deep purple — Soundboard + Multi
};

// Write colored SVG backgrounds into each page's Images/ directory
for (const [page, color] of Object.entries(PAGE_COLORS)) {
  const imagesDir = join(PROFILE_ROOT, 'Profiles', PAGE_UUIDS[page], 'Images');
  mkdirSync(imagesDir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="${color}"/></svg>`;
  writeFileSync(join(imagesDir, 'bg.svg'), svg);
  console.log(`Wrote bg.svg for page ${page} (${color})`);
}

// Helper: build a single button action entry
function btn(actionUUID, pluginUUID, pluginName, settings, label) {
  return {
    ActionID: randomUUID(),
    LinkedTitle: true,
    Name: label,
    Plugin: { Name: pluginName, UUID: pluginUUID, Version: '1.0' },
    Resources: null,
    Settings: settings,
    State: 0,
    States: [{
      Image: 'Images/bg.svg',
      ShowTitle: true,
      Title: label + '\n',
      TitleAlignment: 'bottom',
      TitleColor: '#ffffff',
      FontSize: 9,
    }],
    UUID: actionUUID,
  };
}

// Shorthand helpers for common plugins
const B = {
  website: (s = {}) => btn('com.elgato.streamdeck.system.website', 'com.elgato.streamdeck.system.website', 'Website', { openInBrowser: true, path: 'https://elgato.com', ...s }, 'Website'),
  hotkeySwitch: () => btn('com.elgato.streamdeck.system.hotkeyswitch', 'com.elgato.streamdeck.system.hotkeyswitch', 'Hotkey Switch', {}, 'Hotkey\nSwitch'),
  hotkey: () => btn('com.elgato.streamdeck.system.hotkey', 'com.elgato.streamdeck.system.hotkey', 'Activate a Key Command', { Coalesce: true, Hotkeys: [{ KeyCmd: false, KeyCtrl: true, KeyModifiers: 2, KeyOption: false, KeyShift: false, NativeCode: 65, QTKeyCode: 65, VKeyCode: 65 }] }, 'Hotkey\nCtrl+A'),
  open: () => btn('com.elgato.streamdeck.system.open', 'com.elgato.streamdeck.system.open', 'Open', { path: 'C:\\Windows\\System32\\notepad.exe' }, 'Open'),
  openApp: () => btn('com.elgato.streamdeck.system.openapp', 'com.elgato.streamdeck.system.openapp', 'Open Application', { app_name: '', args: '', bring_to_front: true, bundle_id: '', bundle_path: '', exec: '', is_bundle: false, long_press: 'quit', source: '' }, 'Open App'),
  close: () => btn('com.elgato.streamdeck.system.close', 'com.elgato.streamdeck.system.close', 'Close', {}, 'Close'),
  text: () => btn('com.elgato.streamdeck.system.text', 'com.elgato.streamdeck.system.text', 'Text', { Hotkey: { KeyModifiers: 0, QTKeyCode: 33554431, VKeyCode: -1 }, isSendingEnter: false, isTypingMode: true, pastedText: 'Hello World' }, 'Text'),
  multimedia: (idx, label) => btn('com.elgato.streamdeck.system.multimedia', 'com.elgato.streamdeck.system.multimedia', 'Multimedia', { actionIdx: idx }, label),
  timer: () => btn('com.elgato.streamdeck.system.timer', 'com.elgato.streamdeck.timer', 'Timer', { actionIdx: 0, duration: 30, lastUserFile: '' }, 'Timer'),
  brightness: (idx, label) => btn('com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: idx }, label),
  sleep: () => btn('com.elgato.streamdeck.system.sleep', 'com.elgato.streamdeck.system.sleep', 'Sleep', {}, 'Sleep'),
  vsdToggle: () => btn('com.elgato.streamdeck.system.vsdtoggle', 'com.elgato.streamdeck.vsdtoggle', 'Toggle Virtual Stream Deck', { DeviceID: '', ProfileID: '00000000-0000-0000-0000-000000000000' }, 'Toggle\nVSD'),
  createFolder: () => btn('com.elgato.streamdeck.profile.openchild', 'com.elgato.streamdeck.profile.openchild', 'Create Folder', {}, 'Create\nFolder'),
  switchProfile: () => btn('com.elgato.streamdeck.profile.rotate', 'com.elgato.streamdeck.profile.rotate', 'Switch Profile', {}, 'Switch\nProfile'),
  prevPage: () => btn('com.elgato.streamdeck.page.previous', 'com.elgato.streamdeck.page', 'Pages', {}, 'Prev\nPage'),
  nextPage: () => btn('com.elgato.streamdeck.page.next', 'com.elgato.streamdeck.page', 'Pages', {}, 'Next\nPage'),
  gotoPage: () => btn('com.elgato.streamdeck.page.goto', 'com.elgato.streamdeck.page', 'Pages', { page: 0 }, 'Go to\nPage'),
  pageIndicator: () => btn('com.elgato.streamdeck.page.indicator', 'com.elgato.streamdeck.page', 'Pages', {}, 'Page\nIndicator'),
  playAudio: () => btn('com.elgato.streamdeck.soundboard.playaudio', 'com.elgato.streamdeck.soundboard', 'Soundboard', {}, 'Play\nAudio'),
  stopAudio: () => btn('com.elgato.streamdeck.soundboard.stopaudioplay', 'com.elgato.streamdeck.soundboard', 'Soundboard', {}, 'Stop\nAudio'),
  multiAction: () => btn('com.elgato.streamdeck.multiactions.routine', 'com.elgato.streamdeck.multiactions', 'Multi Action', { Actions: [] }, 'Multi\nAction'),
  multiActionSwitch: () => btn('com.elgato.streamdeck.multiactions.routine2', 'com.elgato.streamdeck.multiactions', 'Multi Action', {}, 'Multi\nAction\nSwitch'),
  randomAction: () => btn('com.elgato.streamdeck.multiactions.random', 'com.elgato.streamdeck.multiactions', 'Multi Action', {}, 'Random\nAction'),
  keyLogic: () => btn('com.elgato.streamdeck.keys.logic', 'com.elgato.streamdeck.keys', 'Keys', {}, 'Key\nLogic'),
};

// ── Page layouts ──────────────────────────────────────────────────────────────

// Page 1 — System (navy blue)
// Row 0: Website | Hotkey Switch | Hotkey | Open | Open App
// Row 1: Close | Text | Multimedia ×3 (Prev / Play / Next)
// Row 2: Multimedia ×4 (Stop / Mute / Vol+ / Vol-) | empty
const page1 = {
  '0,0': B.website(),
  '1,0': B.hotkeySwitch(),
  '2,0': B.hotkey(),
  '3,0': B.open(),
  '4,0': B.openApp(),
  '0,1': B.close(),
  '1,1': B.text(),
  '2,1': B.multimedia(0, 'Prev\nTrack'),
  '3,1': B.multimedia(1, 'Play /\nPause'),
  '4,1': B.multimedia(2, 'Next\nTrack'),
  '0,2': B.multimedia(3, 'Stop'),
  '1,2': B.multimedia(4, 'Mute'),
  '2,2': B.multimedia(5, 'Vol+'),
  '3,2': B.multimedia(6, 'Vol-'),
};

// Page 2 — Stream Deck (forest green)
// Row 0: Timer | Brightness ×4 (Brighter / Darker / Max / High)
// Row 1: Brightness ×3 (Med / Low / Min) | Sleep | Toggle VSD
const page2 = {
  '0,0': B.timer(),
  '1,0': B.brightness(0, 'Brighter'),
  '2,0': B.brightness(1, 'Darker'),
  '3,0': B.brightness(2, 'Max'),
  '4,0': B.brightness(3, 'High'),
  '0,1': B.brightness(4, 'Medium'),
  '1,1': B.brightness(5, 'Low'),
  '2,1': B.brightness(6, 'Minimum'),
  '3,1': B.sleep(),
  '4,1': B.vsdToggle(),
};

// Page 3 — Navigation (dark amber)
// Row 0: Create Folder | Switch Profile | Prev Page | Next Page | Go to Page
// Row 1: Page Indicator
const page3 = {
  '0,0': B.createFolder(),
  '1,0': B.switchProfile(),
  '2,0': B.prevPage(),
  '3,0': B.nextPage(),
  '4,0': B.gotoPage(),
  '0,1': B.pageIndicator(),
};

// Page 4 — Soundboard + Multi Action (deep purple)
// Row 0: Play Audio | Stop Audio | Multi Action | Multi Action Switch | Random Action
// Row 1: Key Logic
const page4 = {
  '0,0': B.playAudio(),
  '1,0': B.stopAudio(),
  '2,0': B.multiAction(),
  '3,0': B.multiActionSwitch(),
  '4,0': B.randomAction(),
  '0,1': B.keyLogic(),
};

// ── Write page manifests ──────────────────────────────────────────────────────

const pageData = [
  { n: 1, uuid: PAGE_UUIDS[1], name: 'System', actions: page1 },
  { n: 2, uuid: PAGE_UUIDS[2], name: 'Stream Deck', actions: page2 },
  { n: 3, uuid: PAGE_UUIDS[3], name: 'Navigation', actions: page3 },
  { n: 4, uuid: PAGE_UUIDS[4], name: 'Soundboard + Multi Act', actions: page4 },
];

for (const { n, uuid, name, actions } of pageData) {
  const manifest = {
    Controllers: [{
      Actions: actions,
      Type: 'Keypad',
    }],
    Icon: '',
    Name: name,
  };
  const manifestPath = join(PROFILE_ROOT, 'Profiles', uuid, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`Wrote page ${n} (${name}): ${Object.keys(actions).length} buttons → ${manifestPath}`);
}

console.log('\nDone. Start Stream Deck app and validate the profile.');
