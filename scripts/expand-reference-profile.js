#!/usr/bin/env node
// Expands the reference profile: per-variant buttons, composite plugin icons tinted
// with vibrant per-page colors, and Prev/Next nav at every page's bottom corners.
// Run: node scripts/expand-reference-profile.js
// IMPORTANT: Stop Stream Deck app before running this script.

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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

// Vibrant colors chosen to represent each group's function
const PAGE_COLORS = {
  1: '#1464F4', // Electric blue    — System / OS control
  2: '#F07800', // Vivid orange     — Stream Deck hardware
  3: '#00B84A', // Vivid emerald    — Navigation / wayfinding
  4: '#8B2BE2', // Vivid violet     — Soundboard + Multi Action
};

const NAV_COLOR = '#374151'; // neutral graphite — consistent across all pages

// Icon map: key → { plugin directory base, icon filename }
const ICON = {
  website:          { p: 'com.elgato.streamdeck.system.website',      f: 'btn_website.svg' },
  hotkeySwitch:     { p: 'com.elgato.streamdeck.system.hotkeyswitch', f: 'btn_toggleHotkeyOn.svg' },
  hotkey:           { p: 'com.elgato.streamdeck.system.hotkey',       f: 'btn_hotkey.svg' },
  open:             { p: 'com.elgato.streamdeck.system.open',         f: 'btn_open.svg' },
  openApp:          { p: 'com.elgato.streamdeck.system.openapp',      f: 'btn_open.svg' },
  close:            { p: 'com.elgato.streamdeck.system.close',        f: 'btn_close.svg' },
  text:             { p: 'com.elgato.streamdeck.system.text',         f: 'btn_text.svg' },
  mmPrev:           { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_prev_track.svg' },
  mmPlay:           { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_play_pause.svg' },
  mmNext:           { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_next_track.svg' },
  mmStop:           { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_stop.svg' },
  mmMute:           { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_mute.svg' },
  mmVolUp:          { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_volume_up.svg' },
  mmVolDown:        { p: 'com.elgato.streamdeck.system.multimedia',   f: 'btn_media_volume_down.svg' },
  timer:            { p: 'com.elgato.streamdeck.timer',               f: 'btn_timer.svg' },
  brighter:         { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_increase.svg' },
  darker:           { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_decrease.svg' },
  brightnessMax:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_max.svg' },
  brightnessHigh:   { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_high.svg' },
  brightnessMed:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_medium.svg' },
  brightnessLow:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_low.svg' },
  brightnessMin:    { p: 'com.elgato.streamdeck.system.keybrightness', f: 'btn_keybrightness_min.svg' },
  sleep:            { p: 'com.elgato.streamdeck.system.sleep',         f: 'btn_sleep.svg' },
  vsdToggle:        { p: 'com.elgato.streamdeck.vsdtoggle',            f: 'btn_vsdtoggle.svg' },
  createFolder:     { p: 'com.elgato.streamdeck.profile.openchild',    f: 'btn_folder.svg' },
  switchProfile:    { p: 'com.elgato.streamdeck.profile.rotate',       f: 'btn_switchProfile.svg' },
  prevPage:         { p: 'com.elgato.streamdeck.page',                 f: 'btn_previousPage.svg' },
  nextPage:         { p: 'com.elgato.streamdeck.page',                 f: 'btn_nextPage.svg' },
  navPrev:          { p: 'com.elgato.streamdeck.page',                 f: 'btn_previousPage.svg' },
  navNext:          { p: 'com.elgato.streamdeck.page',                 f: 'btn_nextPage.svg' },
  gotoPage:         { p: 'com.elgato.streamdeck.page',                 f: 'btn_goToPage.svg' },
  pageIndicator:    { p: 'com.elgato.streamdeck.page',                 f: 'btn_pageIndicator.svg' },
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
  // mmEject / mmRewind / mmFwd: icon files exist in the multimedia plugin Images/ dir
  // but these variants do NOT appear in the app's Action dropdown (only 7 options: 0–6).
  // They were removed from or never exposed in the Stream Deck app UI. Not addable via JSON.
};

// Extract inner SVG elements from an icon file (strips <svg> wrapper and XML decl)
function iconPaths(key) {
  const { p, f } = ICON[key];
  const src = readFileSync(join(PLUGINS, `${p}.sdPlugin/Images/${f}`), 'utf8');
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return m ? m[1].trim() : '';
}

// Write composite SVG (colored rect + icon) into a page's Images/ dir.
// Detects the source icon's viewBox and wraps it in a nested <svg> if needed,
// so icons of any size (20px, 24px, 72px, 144px) all scale to fill the button.
// Returns the relative image path for the button States entry.
function writeComposite(imagesDir, key, color) {
  const { p, f } = ICON[key];
  const src = readFileSync(join(PLUGINS, `${p}.sdPlugin/Images/${f}`), 'utf8');
  const vbMatch = src.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 144 144';
  const innerMatch = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const inner = innerMatch ? innerMatch[1].trim() : '';

  // If the icon's viewBox matches our canvas, inline directly.
  // Otherwise nest it so SVG's own scaling maps the viewBox to 144×144.
  const iconLayer = (viewBox === '0 0 144 144')
    ? inner
    : `<svg x="0" y="0" width="144" height="144" viewBox="${viewBox}">${inner}</svg>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">\n<rect width="144" height="144" fill="${color}"/>\n${iconLayer}\n</svg>`;
  writeFileSync(join(imagesDir, `${key}.svg`), svg);
  return `Images/${key}.svg`;
}

// Build a button object
function btn(actionUUID, pluginUUID, pluginName, settings, label, image) {
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
      TitleColor: '#ffffff',
      FontSize: 9,
    }],
    UUID: actionUUID,
  };
}

// ── Page factory ──────────────────────────────────────────────────────────────
// Returns { actions, imagesDir } for a page.
// Each entry in defs: [col, row, iconKey, actionUUID, pluginUUID, pluginName, settings, label]
function buildPage(pageNum, defs) {
  const uuid = PAGE_UUIDS[pageNum];
  const color = PAGE_COLORS[pageNum];
  const imagesDir = join(PROFILE_ROOT, 'Profiles', uuid, 'Images');
  mkdirSync(imagesDir, { recursive: true });

  const actions = {};
  for (const [col, row, iconKey, aUUID, pUUID, pName, settings, label] of defs) {
    const image = writeComposite(imagesDir, iconKey, color);
    actions[`${col},${row}`] = btn(aUUID, pUUID, pName, settings, label, image);
  }
  return { actions, imagesDir };
}

function addNavCorners(actions, imagesDir) {
  const prevImage = writeComposite(imagesDir, 'navPrev', NAV_COLOR);
  const nextImage = writeComposite(imagesDir, 'navNext', NAV_COLOR);
  actions['0,2'] = btn(...NAV.prev, prevImage);
  actions['4,2'] = btn(...NAV.next, nextImage);
}

// Shared nav button definitions (same action UUID / plugin for all pages)
const NAV = {
  prev: ['com.elgato.streamdeck.page.previous', 'com.elgato.streamdeck.page', 'Pages', {}, 'Prev\nPage'],
  next: ['com.elgato.streamdeck.page.next',     'com.elgato.streamdeck.page', 'Pages', {}, 'Next\nPage'],
};

// ── Page 1 — System (electric blue) ──────────────────────────────────────────
// Row 0: Website | Hotkey Switch | Hotkey | Open | Open App
// Row 1: Close | Text | Prev Track | Play/Pause | Next Track
// Row 2: << nav | Stop | Mute | Vol+ | nav >>  (nav corners added via addNavCorners)
const { actions: page1, imagesDir: imgDir1 } = buildPage(1, [
  [0, 0, 'website',      'com.elgato.streamdeck.system.website',      'com.elgato.streamdeck.system.website',      'Website',               { openInBrowser: true, path: 'https://elgato.com' }, 'Website'],
  [1, 0, 'hotkeySwitch', 'com.elgato.streamdeck.system.hotkeyswitch', 'com.elgato.streamdeck.system.hotkeyswitch', 'Hotkey Switch',          {}, 'Hotkey\nSwitch'],
  [2, 0, 'hotkey',       'com.elgato.streamdeck.system.hotkey',       'com.elgato.streamdeck.system.hotkey',       'Activate a Key Command', { Coalesce: true, Hotkeys: [{ KeyCmd: false, KeyCtrl: true, KeyModifiers: 2, KeyOption: false, KeyShift: false, NativeCode: 65, QTKeyCode: 65, VKeyCode: 65 }] }, 'Hotkey\nCtrl+A'],
  [3, 0, 'open',         'com.elgato.streamdeck.system.open',         'com.elgato.streamdeck.system.open',         'Open',                   { path: 'C:\\Windows\\System32\\notepad.exe' }, 'Open'],
  [4, 0, 'openApp',      'com.elgato.streamdeck.system.openapp',      'com.elgato.streamdeck.system.openapp',      'Open Application',       { app_name: '', args: '', bring_to_front: true, bundle_id: '', bundle_path: '', exec: '', is_bundle: false, long_press: 'quit', source: '' }, 'Open App'],
  [0, 1, 'close',        'com.elgato.streamdeck.system.close',        'com.elgato.streamdeck.system.close',        'Close',                  {}, 'Close'],
  [1, 1, 'text',         'com.elgato.streamdeck.system.text',         'com.elgato.streamdeck.system.text',         'Text',                   { Hotkey: { KeyModifiers: 0, QTKeyCode: 33554431, VKeyCode: -1 }, isSendingEnter: false, isTypingMode: true, pastedText: 'Hello World' }, 'Text'],
  [2, 1, 'mmPrev',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 0 }, 'Prev\nTrack'],
  [3, 1, 'mmPlay',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 1 }, 'Play /\nPause'],
  [4, 1, 'mmNext',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 2 }, 'Next\nTrack'],
  [1, 2, 'mmStop',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 3 }, 'Stop'],
  [2, 2, 'mmMute',       'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 4 }, 'Mute'],
  [3, 2, 'mmVolUp',      'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',             { actionIdx: 5 }, 'Vol+'],
]);
addNavCorners(page1, imgDir1);

// ── Page 2 — Stream Deck (vivid orange) ──────────────────────────────────────
// Row 0: Timer | Brighter | Darker | Max | High
// Row 1: Medium | Low | Minimum | Sleep | Toggle VSD
// Row 2: << nav | Vol- | · | · | nav >>
const { actions: page2, imagesDir: imgDir2 } = buildPage(2, [
  [0, 0, 'timer',         'com.elgato.streamdeck.system.timer',         'com.elgato.streamdeck.timer',               'Timer',      { actionIdx: 0, duration: 30, lastUserFile: '' }, 'Timer'],
  [1, 0, 'brighter',      'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 0 }, 'Brighter'],
  [2, 0, 'darker',        'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 1 }, 'Darker'],
  [3, 0, 'brightnessMax', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 2 }, 'Max'],
  [4, 0, 'brightnessHigh','com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 3 }, 'High'],
  [0, 1, 'brightnessMed', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 4 }, 'Medium'],
  [1, 1, 'brightnessLow', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 5 }, 'Low'],
  [2, 1, 'brightnessMin', 'com.elgato.streamdeck.system.keybrightness', 'com.elgato.streamdeck.system.keybrightness', 'Brightness', { actionIdx: 6 }, 'Minimum'],
  [3, 1, 'sleep',         'com.elgato.streamdeck.system.sleep',         'com.elgato.streamdeck.system.sleep',         'Sleep',      {}, 'Sleep'],
  [4, 1, 'vsdToggle',     'com.elgato.streamdeck.system.vsdtoggle',     'com.elgato.streamdeck.vsdtoggle',            'Toggle Virtual Stream Deck', { DeviceID: '', ProfileID: '00000000-0000-0000-0000-000000000000' }, 'Toggle\nVSD'],
  [1, 2, 'mmVolDown',     'com.elgato.streamdeck.system.multimedia',   'com.elgato.streamdeck.system.multimedia',   'Multimedia',  { actionIdx: 6 }, 'Vol-'],
]);
addNavCorners(page2, imgDir2);

// ── Page 3 — Navigation (vivid emerald) ──────────────────────────────────────
// Row 0: Create Folder | Switch Profile | Prev Page | Next Page | Go to Page
// Row 1: Page Indicator | Parent Folder
// Row 2: (empty — no nav corners; this page IS about navigation, no redundant corners)
const { actions: page3, imagesDir: imgDir3 } = buildPage(3, [
  [0, 0, 'createFolder',  'com.elgato.streamdeck.profile.openchild',    'com.elgato.streamdeck.profile.openchild',    'Create Folder',   {}, 'Create\nFolder'],
  [1, 0, 'switchProfile', 'com.elgato.streamdeck.profile.rotate',       'com.elgato.streamdeck.profile.rotate',       'Switch Profile',  {}, 'Switch\nProfile'],
  [2, 0, 'prevPage',      'com.elgato.streamdeck.page.previous',        'com.elgato.streamdeck.page',                 'Pages',           {}, 'Prev\nPage'],
  [3, 0, 'nextPage',      'com.elgato.streamdeck.page.next',            'com.elgato.streamdeck.page',                 'Pages',           {}, 'Next\nPage'],
  [4, 0, 'gotoPage',      'com.elgato.streamdeck.page.goto',            'com.elgato.streamdeck.page',                 'Pages',           { page: 0 }, 'Go to\nPage'],
  [0, 1, 'pageIndicator', 'com.elgato.streamdeck.page.indicator',       'com.elgato.streamdeck.page',                 'Pages',           {}, 'Page\nIndicator'],
  [1, 1, 'parentFolder',  'com.elgato.streamdeck.profile.backtoparent', 'com.elgato.streamdeck.profile.backtoparent', 'Parent Folder',   {}, 'Parent\nFolder'],
]);
addNavCorners(page3, imgDir3);

// ── Page 4 — Soundboard + Multi Action + Keys (vivid violet) ─────────────────
// Row 0: Play Audio | Stop Audio | Multi Action | Multi Action Switch | Random Action
// Row 1: Key Logic | Delay | Digital Time | Key Adaptor | Key Stack
// Row 2: << nav | Pagination | · | · | nav >>
const { actions: page4, imagesDir: imgDir4 } = buildPage(4, [
  [0, 0, 'playAudio',    'com.elgato.streamdeck.soundboard.playaudio',       'com.elgato.streamdeck.soundboard',             'Soundboard',    {}, 'Play\nAudio'],
  [1, 0, 'stopAudio',    'com.elgato.streamdeck.soundboard.stopaudioplay',   'com.elgato.streamdeck.soundboard',             'Soundboard',    {}, 'Stop\nAudio'],
  [2, 0, 'multiAction',  'com.elgato.streamdeck.multiactions.routine',       'com.elgato.streamdeck.multiactions',           'Multi Action',  { Actions: [] }, 'Multi\nAction'],
  [3, 0, 'multiSwitch',  'com.elgato.streamdeck.multiactions.routine2',      'com.elgato.streamdeck.multiactions',           'Multi Action',  {}, 'Multi\nSwitch'],
  [4, 0, 'randomAction', 'com.elgato.streamdeck.multiactions.random',        'com.elgato.streamdeck.multiactions',           'Multi Action',  {}, 'Random\nAction'],
  [0, 1, 'keyLogic',     'com.elgato.streamdeck.keys.logic',                 'com.elgato.streamdeck.keys',                   'Keys',          {}, 'Key\nLogic'],
  [1, 1, 'delay',        'com.elgato.streamdeck.multiactions.delay',         'com.elgato.streamdeck.multiactions',           'Multi Action',  { duration: 1000 }, 'Delay'],
  [2, 1, 'digitalTime',  'com.elgato.streamdeck.system.digitaltime',         'com.elgato.streamdeck.system.digitaltime',     'Digital Time',  {}, 'Digital\nTime'],
  [3, 1, 'keyAdaptor',   'com.elgato.streamdeck.keys.adaptor',               'com.elgato.streamdeck.keys',                   'Keys',          {}, 'Key\nAdaptor'],
  [4, 1, 'keyStack',     'com.elgato.streamdeck.keys.stack',                 'com.elgato.streamdeck.keys',                   'Keys',          {}, 'Key\nStack'],
  [1, 2, 'pagination',   'com.elgato.streamdeck.system.pagination',          'com.elgato.streamdeck.system.pagination',      'Pagination',    {}, 'Pagination'],
]);
addNavCorners(page4, imgDir4);

// ── Write page manifests ──────────────────────────────────────────────────────
const pageData = [
  { n: 1, uuid: PAGE_UUIDS[1], name: 'System',                       actions: page1 },
  { n: 2, uuid: PAGE_UUIDS[2], name: 'Stream Deck',                  actions: page2 },
  { n: 3, uuid: PAGE_UUIDS[3], name: 'Navigation',                   actions: page3 },
  { n: 4, uuid: PAGE_UUIDS[4], name: 'Soundboard + Multi Act + Keys', actions: page4 },
];

for (const { n, uuid, name, actions } of pageData) {
  const manifest = {
    Controllers: [{ Actions: actions, Type: 'Keypad' }],
    Icon: '',
    Name: name,
  };
  const manifestPath = join(PROFILE_ROOT, 'Profiles', uuid, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`Page ${n} (${name}): ${Object.keys(actions).length} buttons → ${manifestPath}`);
}

// Clear stray content from old page 5 (D9C12A0B)
const PAGE5_UUID = 'D9C12A0B-08CC-43F0-8922-CFFC663B18B1';
const page5Path = join(PROFILE_ROOT, 'Profiles', PAGE5_UUID, 'manifest.json');
writeFileSync(page5Path, JSON.stringify({ Controllers: [{ Actions: null, Type: 'Keypad' }], Icon: '', Name: '' }));
console.log('Page 5 (blank): cleared stray buttons');

console.log('\nDone. Start Stream Deck app and validate the profile.');
