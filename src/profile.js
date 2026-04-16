import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildHotkey } from './hotkey.js';
import { PLUGIN_HOTKEY, DEVICE_MODELS } from './constants.js';
import { addImage } from './images.js';

export class ProfileEditor {
  constructor(extractedDir) {
    this.extractedDir = extractedDir;
    this.packageJson = JSON.parse(readFileSync(join(extractedDir, 'package.json'), 'utf8'));
    this.profileUUID = this._findProfileUUID();
    this.profileDir = join(extractedDir, 'Profiles', `${this.profileUUID}.sdProfile`);
    this.profileManifest = JSON.parse(readFileSync(join(this.profileDir, 'manifest.json'), 'utf8'));
    this._pageManifests = new Map();
  }

  get deviceModel() {
    return this.packageJson.DeviceModel;
  }

  get deviceInfo() {
    return DEVICE_MODELS[this.deviceModel] || { name: 'Unknown', cols: 5, rows: 3 };
  }

  _findProfileUUID() {
    const profilesDir = join(this.extractedDir, 'Profiles');
    const entries = readdirSync(profilesDir);
    const sdProfile = entries.find(e => e.endsWith('.sdProfile'));
    if (!sdProfile) throw new Error('No .sdProfile directory found');
    return sdProfile.replace('.sdProfile', '');
  }

  getPageUUIDs() {
    const pagesDir = join(this.profileDir, 'Profiles');
    return readdirSync(pagesDir);
  }

  getPageDir(pageUUID) {
    return join(this.profileDir, 'Profiles', pageUUID);
  }

  getPageManifest(pageUUID) {
    if (!this._pageManifests.has(pageUUID)) {
      const manifestPath = join(this.getPageDir(pageUUID), 'manifest.json');
      this._pageManifests.set(pageUUID, JSON.parse(readFileSync(manifestPath, 'utf8')));
    }
    return this._pageManifests.get(pageUUID);
  }

  getActions(pageUUID) {
    const manifest = this.getPageManifest(pageUUID);
    return manifest.Controllers?.[0]?.Actions || {};
  }

  getAction(pageUUID, col, row) {
    const actions = this.getActions(pageUUID);
    return actions[`${col},${row}`] || null;
  }

  setAction(pageUUID, col, row, actionDef) {
    const manifest = this.getPageManifest(pageUUID);
    if (!manifest.Controllers[0].Actions) {
      manifest.Controllers[0].Actions = {};
    }
    manifest.Controllers[0].Actions[`${col},${row}`] = actionDef;
  }

  removeAction(pageUUID, col, row) {
    const manifest = this.getPageManifest(pageUUID);
    if (manifest.Controllers[0].Actions) {
      delete manifest.Controllers[0].Actions[`${col},${row}`];
    }
  }

  getEmptyPositions(pageUUID) {
    const { cols, rows } = this.deviceInfo;
    const actions = this.getActions(pageUUID);
    const empty = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (!actions[`${col},${row}`]) {
          empty.push({ col, row });
        }
      }
    }
    return empty;
  }

  /**
   * Add a hotkey button to a page.
   * @param {string} pageUUID
   * @param {number} col
   * @param {number} row
   * @param {object} opts
   * @param {string} opts.label - Button title (use \n for line breaks)
   * @param {string} opts.key - Key name from KEY_CODES
   * @param {boolean} [opts.ctrl]
   * @param {boolean} [opts.shift]
   * @param {boolean} [opts.alt]
   * @param {boolean} [opts.win]
   * @param {string} [opts.imagePath] - Absolute path to icon image file
   */
  addHotkeyButton(pageUUID, col, row, { label, key, ctrl, shift, alt, win, imagePath }) {
    let imageRef = '';
    if (imagePath) {
      imageRef = addImage(this.getPageDir(pageUUID), imagePath);
    }

    const hotkeys = buildHotkey({ key, ctrl, shift, alt, win });

    const actionDef = {
      ActionID: randomUUID(),
      LinkedTitle: true,
      Name: "Hotkey",
      Plugin: { ...PLUGIN_HOTKEY },
      Resources: null,
      Settings: {
        Coalesce: true,
        Hotkeys: hotkeys,
      },
      State: 0,
      States: [{ Image: imageRef, Title: label }],
      UUID: "com.elgato.streamdeck.system.hotkey",
    };

    this.setAction(pageUUID, col, row, actionDef);
    return actionDef;
  }

  updateTitle(pageUUID, col, row, newTitle) {
    const action = this.getAction(pageUUID, col, row);
    if (!action) throw new Error(`No action at position ${col},${row}`);
    action.States[0].Title = newTitle;
  }

  save() {
    // Save all modified page manifests
    for (const [pageUUID, manifest] of this._pageManifests) {
      const manifestPath = join(this.getPageDir(pageUUID), 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    // Save profile manifest (in case it was modified)
    writeFileSync(join(this.profileDir, 'manifest.json'), JSON.stringify(this.profileManifest));
    console.log('Profile saved.');
  }
}
