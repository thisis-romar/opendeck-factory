#!/usr/bin/env node
// Expands the reference profile: icon-only composites on per-page colored backgrounds,
// adjacent-page-colored nav corners, and a live Page Indicator at (4,0) on every page.
// Run: node scripts/expand-reference-profile.js
// IMPORTANT: Stop Stream Deck app before running this script.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { deflateSync } from 'zlib';
import { contrastColor } from '../src/colors.js';

const APPDATA = process.env.APPDATA;
const PLUGINS = 'C:/Program Files/Elgato/StreamDeck/plugins';
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
  1: '#1464F4', // Electric blue    — System / OS control
  2: '#F07800', // Vivid orange     — Stream Deck hardware
  3: '#00B84A', // Vivid emerald    — Navigation / wayfinding
  4: '#8B2BE2', // Vivid violet     — Soundboard + Multi Action
};

// Nav corners use the adjacent page's color so you can see where you're going
const ADJACENT = {
  1: { prev: PAGE_COLORS[4], next: PAGE_COLORS[2], prevN: 4, nextN: 2 },
  2: { prev: PAGE_COLORS[1], next: PAGE_COLORS[3], prevN: 1, nextN: 3 },
  3: { prev: PAGE_COLORS[2], next: PAGE_COLORS[4], prevN: 2, nextN: 4 },
  4: { prev: PAGE_COLORS[3], next: PAGE_COLORS[1], prevN: 3, nextN: 1 },
};

// Icon map: key → { plugin directory base, icon filename }
const ICON = {
  website:          { p: 'com.elgato.streamdeck.system.website',       f: 'btn_website.svg' },
  hotkeySwitch:     { p: 'com.elgato.streamdeck.system.hotkeyswitch',  f: 'btn_toggleHotkeyOn.svg' },
  hotkey:           { p: 'com.elgato.streamdeck.system.hotkey',        f: 'btn_hotkey.svg' },
  open:             { p: 'com.elgato.streamdeck.system.open',          f: 'btn_open.svg' },
  openApp:          { p: 'com.elgato.streamdeck.system.openapp',       f: 'btn_open.svg' },
  close:            { p: 'com.elgato.streamdeck.system.close',         f: 'btn_close.svg' },
  text:             { p: 'com.elgato.streamdeck.system.text',          f: 'btn_text.svg' },
  mmPrev:           { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_prev_track.svg' },
  mmPlay:           { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_play_pause.svg' },
  mmNext:           { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_next_track.svg' },
  mmStop:           { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_stop.svg' },
  mmMute:           { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_mute.svg' },
  mmVolUp:          { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_volume_up.svg' },
  mmVolDown:        { p: 'com.elgato.streamdeck.system.multimedia',    f: 'btn_media_volume_down.svg' },
  timer:            { p: 'com.elgato.streamdeck.timer',                f: 'btn_timer.svg' },
  brighter:         { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_increase.svg' },
  darker:           { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_decrease.svg' },
  brightnessMax:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_max.svg' },
  brightnessHigh:   { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_high.svg' },
  brightnessMed:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_medium.svg' },
  brightnessLow:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_low.svg' },
  brightnessMin:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_min.svg' },
  sleep:            { p: 'com.elgato.streamdeck.system.sleep',         f: 'btn_sleep.svg' },
  vsdToggle:        { p: 'com.elgato.streamdeck.vsdtoggle',            f: 'btn_vsdtoggle.svg' },
  // createFolder: GUI-placement-only — requires sub-profile structure (silently dropped via JSON)
  switchProfile:    { p: 'com.elgato.streamdeck.profile.rotate',       f: 'btn_switchProfile.svg' },
  navPrev:          { p: 'com.elgato.streamdeck.page',                 f: 'btn_previousPage.svg' },
  navNext:          { p: 'com.elgato.streamdeck.page',                 f: 'btn_nextPage.svg' },
  gotoPage:         { p: 'com.elgato.streamdeck.page',                 f: 'btn_goToPage.svg' },
  // pageIndicator: fully dynamic — States:[{}], page background shows through
  playAudio:        { p: 'com.elgato.streamdeck.soundboard',           f: 'btn_playAudio.svg' },
  stopAudio:        { p: 'com.elgato.streamdeck.soundboard',           f: 'btn_stopAudio.svg' },
  multiAction:      { p: 'com.elgato.streamdeck.multiactions',         f: 'btn_multiAction.svg' },
  multiSwitch:      { p: 'com.elgato.streamdeck.multiactions',         f: 'btn_toggleMultiActionOn.svg' },
  randomAction:     { p: 'com.elgato.streamdeck.multiactions',         f: 'btn_randomAction.svg' },
  keyLogic:         { p: 'com.elgato.streamdeck.keys',                 f: 'btn_keyLogic.svg' },
  keyAdaptor:       { p: 'com.elgato.streamdeck.keys',                 f: 'btn_keyAdaptor.svg' },
  keyStack:         { p: 'com.elgato.streamdeck.keys',                 f: 'btn_keyStack.svg' },
  parentFolder:     { p: 'com.elgato.streamdeck.profile.backtoparent', f: 'btn_backtoParent.svg' },
  delay:            { p: 'com.elgato.streamdeck.multiactions',         f: 'btn_duration.svg' },
  digitalTime:      { p: 'com.elgato.streamdeck.system.digitaltime',   f: 'btn_digitalTime.svg' },
  pagination:       { p: 'com.elgato.streamdeck.system.pagination',    f: 'btn_pagination.svg' },
  // mmEject/mmRewind/mmFwd: icon files exist but variants 7+ not exposed in app UI
};

// ── PNG background generator ──────────────────────────────────────────────────
// Solid-color 480×272 RGBA PNG for Controllers[0].Background.
// Pure Node.js — zlib built-in, no extra deps.
function solidColorPng(width, height, hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function makeChunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crcBuf]);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr.fill(0, 10); // 8-bit RGB
  const row = Buffer.allocUnsafe(1 + width * 3);
  row[0] = 0; // filter: None
  for (let x = 0; x < width; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

// Shared icon extraction: handles viewBox scaling, negative origins, fill inheritance.
// Nested <svg viewBox> is ignored by the Stream Deck renderer — <g transform> is used.
function buildIconLayer(key) {
  const { p, f } = ICON[key];
  const src = readFileSync(join(PLUGINS, `${p}.sdPlugin/Images/${f}`), 'utf8');
  const vbMatch = src.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 144 144';
  const innerMatch = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const inner = innerMatch ? innerMatch[1].trim() : '';

  const outerFillMatch = src.match(/<svg[^>]*?\sfill="([^"]+)"/);
  const inheritedFill = outerFillMatch && outerFillMatch[1] !== 'none' ? outerFillMatch[1] : null;

  const [vbMinX, vbMinY, vbW] = viewBox.split(' ').map(Number);
  const scale = 144 / vbW;
  const needsScale = scale !== 1;
  const needsTranslate = vbMinX !== 0 || vbMinY !== 0;

  if (!needsScale && !needsTranslate && !inheritedFill) return inner;
  const attrs = [];
  if (needsScale && needsTranslate) {
    attrs.push(`transform="scale(${scale}) translate(${-vbMinX}, ${-vbMinY})"`);
  } else if (needsScale) {
    attrs.push(`transform="scale(${scale})"`);
  } else if (needsTranslate) {
    attrs.push(`transform="translate(${-vbMinX}, ${-vbMinY})"`);
  }
  if (inheritedFill) attrs.push(`fill="${inheritedFill}"`);
  return `<g ${attrs.join(' ')}>${inner}</g>`;
}

// Icon-only SVG: no background rect — page background provides the color.
// Used for all content buttons.
function writeIconOnly(imagesDir, key) {
  const layer = buildIconLayer(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">\n${layer}\n</svg>`;
  writeFileSync(join(imagesDir, `${key}.svg`), svg);
  return `Images/${key}.svg`;
}

// Nav composite: solid adjacent-page-color rect + icon.
// Filename encodes color so prev (e.g. violet) and next (e.g. orange) don't collide.
function writeNavComposite(imagesDir, key, color) {
  const layer = buildIconLayer(key);
  const slug = color.replace('#', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">\n<rect width="144" height="144" fill="${color}"/>\n${layer}\n</svg>`;
  writeFileSync(join(imagesDir, `nav-${key}-${slug}.svg`), svg);
  return `Images/nav-${key}-${slug}.svg`;
}

// ── Button factories ──────────────────────────────────────────────────────────

function btn(actionUUID, pluginUUID, pluginName, settings, label, image, bgColor = '#000000') {
  return {
    ActionID: randomUUID(),
    LinkedTitle: true,
    Name: label,
    Plugin: { Name: pluginName, UUID: pluginUUID, Version: '1.0' },
    Resources: null,
    Settings: settings,
    State: 0,
    States: [{
      Image: image || '',
      ShowTitle: true,
      Title: label + '\n',
      TitleAlignment: 'bottom',
      TitleColor: contrastColor(bgColor),
      FontSize: 9,
    }],
    UUID: actionUUID,
  };
}

// Page Indicator: fully dynamic — app draws live page number on page background color.
// No composite image; States:[{}] lets the page background show through.
function makePageIndicator() {
  return {
    ActionID: randomUUID(),
    LinkedTitle: true,
    Name: 'Page\nIndicator',
    Plugin: { Name: 'Pages', UUID: 'com.elgato.streamdeck.page', Version: '1.0' },
    Resources: null,
    Settings: {},
    State: 0,
    States: [{}],
    UUID: 'com.elgato.streamdeck.page.indicator',
  };
}

// ── Page factory ──────────────────────────────────────────────────────────────
// Each def: [col, row, iconKey, actionUUID, pluginUUID, pluginName, settings, label]
// Automatically adds Page Indicator at (4,0) and writes page-bg.png.
function buildPage(pageNum, defs) {
  const uuid = PAGE_UUIDS[pageNum];
  const color = PAGE_COLORS[pageNum];
  const imagesDir = join(PROFILE_ROOT, 'Profiles', uuid, 'Images');
  mkdirSync(imagesDir, { recursive: true });

  const actions = {};
  for (const [col, row, iconKey, aUUID, pUUID, pName, settings, label] of defs) {
    const image = writeIconOnly(imagesDir, iconKey);
    actions[`${col},${row}`] = btn(aUUID, pUUID, pName, settings, label, image, color);
  }

  actions['4,0'] = makePageIndicator();
  writeFileSync(join(imagesDir, 'page-bg.png'), solidColorPng(480, 272, color));

  return { actions, imagesDir };
}

// Nav corners colored with the adjacent page's color (circular).
function addNavCorners(actions, imagesDir, pageNum) {
  const { prev, next, prevN, nextN } = ADJACENT[pageNum];
  const prevImage = writeNavComposite(imagesDir, 'navPrev', prev);
  const nextImage = writeNavComposite(imagesDir, 'navNext', next);
  actions['0,2'] = btn('com.elgato.streamdeck.page.previous', 'com.elgato.streamdeck.page', 'Pages', {}, `← ${prevN}`, prevImage, prev);
  actions['4,2'] = btn('com.elgato.streamdeck.page.next',     'com.elgato.streamdeck.page', 'Pages', {}, `${nextN} →`, nextImage, next);
}

// ── Page 1 — System (electric blue) ──────────────────────────────────────────
// Row 0: Website | Hotkey Switch | Hotkey Ctrl+A | Open | [Page Indicator]
// Row 1: Close | Text | Open App | Prev Track | Play/Pause
// Row 2: [← 4:violet] | Next Track | Stop | Mute | [2→:orange]
// Vol+/Vol- moved to page 2 (hardware controls)
const { actions: page1, imagesDir: imgDir1 } = buildPage(1, [
  [0, 0, 'website',      'com.elgato.streamdeck.system.website',      'com.elgato.streamdeck.system.website',      'Website',               { openInBrowser: true, path: 'https://elgato.com' }, 'Website'],
  [1, 0, 'hotkeySwitch', 'com.elgato.streamdeck.system.hotkeyswitch', 'com.elgato.streamdeck.system.hotkeyswitch', 'Hotkey Switch',          {}, 'Hotkey\nSwitch'],
  [2, 0, 'hotkey',       'com.elgato.streamdeck.system.hotkey',       'com.elgato.streamdeck.system.hotkey',       'Activate a Key Command', { Coalesce: true, Hotkeys: [{ KeyCmd: false, KeyCtrl: true, KeyModifiers: 2, KeyOption: false, KeyShift: false, NativeCode: 65, QTKeyCode: 65, VKeyCode: 65 }] }, 'Hotkey\nCtrl+A'],
  [3, 0, 'open',         'com.elgato.streamdeck.system.open',         'com.elgato.streamdeck.system.open',         'Open',                   { path: 'C:\\Windows\\System32\\notepad.exe' }, 'Open'],
  [0, 1, 'close',        'com.elgato.streamdeck.system.close',        'com.elgato.streamdeck.system.close',        'Close',                  {}, 'Close'],
  [1, 1, 'text',         'com.elgato.streamdeck.system.text',         'com.elgato.streamdeck.system.text',         'Text',                   { Hotkey: { KeyModifiers: 0, QTKeyCode: 33554431, VKeyCode: -1 }, isSendingEnter: false, isTypingMode: true, pastedText: 'Hello World' }, 'Text'],
  [2, 1, 'openApp',      'com.elgato.streamdeck.system.openapp',      'com.elgato.streamdeck.system.openapp',      'Open Application',       { app_name: '', args: '', bring_to_front: true, bundle_id: '', bundle_path: '', exec: '', is_bundle: false, long_press: 'quit', source: '' }, 'Open App'],
  [3, 1, 'mmPrev',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 0 }, 'Prev\nTrack'],
  [4, 1, 'mmPlay',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 1 }, 'Play /\nPause'],
  [1, 2, 'mmNext',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 2 }, 'Next\nTrack'],
  [2, 2, 'mmStop',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 3 }, 'Stop'],
  [3, 2, 'mmMute',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 4 }, 'Mute'],
]);
addNavCorners(page1, imgDir1, 1);

// ── Page 2 — Stream Deck (vivid orange) ──────────────────────────────────────
// Row 0: Timer | Brighter | Darker | Max | [Page Indicator]
// Row 1: Medium | Low | Minimum | Sleep | Toggle VSD
// Row 2: [← 1:blue] | High | Vol- | Vol+ | [3→:green]
const { actions: page2, imagesDir: imgDir2 } = buildPage(2, [
  [0, 0, 'timer',         'com.elgato.streamdeck.system.timer',         'com.elgato.streamdeck.timer',               'Timer',      { actionIdx: 0, duration: 30, lastUserFile: '' }, 'Timer'],
  [1, 0, 'brighter',      'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 0 }, 'Brighter'],
  [2, 0, 'darker',        'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 1 }, 'Darker'],
  [3, 0, 'brightnessMax', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 2 }, 'Max'],
  [0, 1, 'brightnessMed', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 4 }, 'Medium'],
  [1, 1, 'brightnessLow', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 5 }, 'Low'],
  [2, 1, 'brightnessMin', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 6 }, 'Minimum'],
  [3, 1, 'sleep',         'com.elgato.streamdeck.system.sleep',         'com.elgato.streamdeck.system.sleep',         'Sleep',      {}, 'Sleep'],
  [4, 1, 'vsdToggle',     'com.elgato.streamdeck.system.vsdtoggle',     'com.elgato.streamdeck.vsdtoggle',            'Toggle Virtual Stream Deck', { DeviceID: '', ProfileID: '00000000-0000-0000-0000-000000000000' }, 'Toggle\nVSD'],
  [1, 2, 'brightnessHigh','com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 3 }, 'High'],
  [2, 2, 'mmVolDown',     'com.elgato.streamdeck.system.multimedia',    'com.elgato.streamdeck.system.multimedia',    'Multimedia', { actionIdx: 6 }, 'Vol-'],
  [3, 2, 'mmVolUp',       'com.elgato.streamdeck.system.multimedia',    'com.elgato.streamdeck.system.multimedia',    'Multimedia', { actionIdx: 5 }, 'Vol+'],
]);
addNavCorners(page2, imgDir2, 2);

// ── Page 3 — Navigation (vivid emerald) ──────────────────────────────────────
// Row 0: Switch Profile | Go to Page | · | · | [Page Indicator]
// Row 1: Parent Folder
// Row 2: [← 2:orange] | · | · | · | [4→:violet]
// Create Folder: GUI-only (sub-profile structure required)
const { actions: page3, imagesDir: imgDir3 } = buildPage(3, [
  [0, 0, 'switchProfile', 'com.elgato.streamdeck.profile.rotate',       'com.elgato.streamdeck.profile.rotate',       'Switch Profile', {}, 'Switch\nProfile'],
  [1, 0, 'gotoPage',      'com.elgato.streamdeck.page.goto',            'com.elgato.streamdeck.page',                 'Pages',          { page: 0 }, 'Go to\nPage'],
  [0, 1, 'parentFolder',  'com.elgato.streamdeck.profile.backtoparent', 'com.elgato.streamdeck.profile.backtoparent', 'Parent Folder',  {}, 'Parent\nFolder'],
]);
addNavCorners(page3, imgDir3, 3);

// ── Page 4 — Soundboard + Multi Action + Keys (vivid violet) ─────────────────
// Row 0: Play Audio | Stop Audio | Multi Action | Multi Switch | [Page Indicator]
// Row 1: Key Logic | Delay | Digital Time | Key Adaptor | Key Stack
// Row 2: [← 3:green] | Random Action | Pagination | · | [1→:blue]
const { actions: page4, imagesDir: imgDir4 } = buildPage(4, [
  [0, 0, 'playAudio',    'com.elgato.streamdeck.soundboard.playaudio',     'com.elgato.streamdeck.soundboard',         'Soundboard',   {}, 'Play\nAudio'],
  [1, 0, 'stopAudio',    'com.elgato.streamdeck.soundboard.stopaudioplay', 'com.elgato.streamdeck.soundboard',         'Soundboard',   {}, 'Stop\nAudio'],
  [2, 0, 'multiAction',  'com.elgato.streamdeck.multiactions.routine',     'com.elgato.streamdeck.multiactions',       'Multi Action', { Actions: [] }, 'Multi\nAction'],
  [3, 0, 'multiSwitch',  'com.elgato.streamdeck.multiactions.routine2',    'com.elgato.streamdeck.multiactions',       'Multi Action', {}, 'Multi\nSwitch'],
  [0, 1, 'keyLogic',     'com.elgato.streamdeck.keys.logic',               'com.elgato.streamdeck.keys',               'Keys',         {}, 'Key\nLogic'],
  [1, 1, 'delay',        'com.elgato.streamdeck.multiactions.delay',       'com.elgato.streamdeck.multiactions',       'Multi Action', { duration: 1000 }, 'Delay'],
  [2, 1, 'digitalTime',  'com.elgato.streamdeck.system.digitaltime',       'com.elgato.streamdeck.system.digitaltime', 'Digital Time', {}, 'Digital\nTime'],
  [3, 1, 'keyAdaptor',   'com.elgato.streamdeck.keys.adaptor',             'com.elgato.streamdeck.keys',               'Keys',         {}, 'Key\nAdaptor'],
  [4, 1, 'keyStack',     'com.elgato.streamdeck.keys.stack',               'com.elgato.streamdeck.keys',               'Keys',         {}, 'Key\nStack'],
  [1, 2, 'randomAction', 'com.elgato.streamdeck.multiactions.random',      'com.elgato.streamdeck.multiactions',       'Multi Action', {}, 'Random\nAction'],
  [2, 2, 'pagination',   'com.elgato.streamdeck.system.pagination',        'com.elgato.streamdeck.system.pagination',  'Pagination',   {}, 'Pagination'],
]);
addNavCorners(page4, imgDir4, 4);

// ── Write page manifests ──────────────────────────────────────────────────────
const pageData = [
  { n: 1, uuid: PAGE_UUIDS[1], name: 'System',                        actions: page1 },
  { n: 2, uuid: PAGE_UUIDS[2], name: 'Stream Deck',                   actions: page2 },
  { n: 3, uuid: PAGE_UUIDS[3], name: 'Navigation',                    actions: page3 },
  { n: 4, uuid: PAGE_UUIDS[4], name: 'Soundboard + Multi Act + Keys', actions: page4 },
];

for (const { n, uuid, name, actions } of pageData) {
  const manifest = {
    Controllers: [{ Actions: actions, Background: 'Images/page-bg.png', Type: 'Keypad' }],
    Icon: '',
    Name: name,
  };
  const manifestPath = join(PROFILE_ROOT, 'Profiles', uuid, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`Page ${n} (${name}): ${Object.keys(actions).length} buttons → ${manifestPath}`);
}

// Clear stray content from old page 5 (D9C12A0B) if the directory still exists
const PAGE5_UUID = 'D9C12A0B-08CC-43F0-8922-CFFC663B18B1';
const page5Dir = join(PROFILE_ROOT, 'Profiles', PAGE5_UUID);
if (existsSync(page5Dir)) {
  writeFileSync(join(page5Dir, 'manifest.json'), JSON.stringify({ Controllers: [{ Actions: null, Type: 'Keypad' }], Icon: '', Name: '' }));
  console.log('Page 5 (blank): cleared stray buttons');
}

console.log('\nDone. Start Stream Deck app and validate the profile.');
