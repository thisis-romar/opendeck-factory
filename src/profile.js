import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, cpSync } from 'node:fs';
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

  static initFromTemplate(templateDir, targetDir, profileName) {
    cpSync(templateDir, targetDir, { recursive: true });

    // Generate UUIDs for profile and page folders
    const profilesDir = join(targetDir, 'Profiles');
    const oldProfileName = readdirSync(profilesDir).find(e => e.endsWith('.sdProfile')).replace('.sdProfile', '');
    const oldProfileDir = join(profilesDir, `${oldProfileName}.sdProfile`);
    const pagesDir = join(oldProfileDir, 'Profiles');
    const oldPageNames = readdirSync(pagesDir);

    // Rename page folders and build mapping
    const uuidMap = {};
    for (const oldPage of oldPageNames) {
      const newUUID = randomUUID().toUpperCase();
      uuidMap[oldPage] = newUUID;
      renameSync(join(pagesDir, oldPage), join(pagesDir, newUUID));
    }

    // Rename profile folder
    const newProfileUUID = randomUUID().toUpperCase();
    const newProfileDir = join(profilesDir, `${newProfileUUID}.sdProfile`);
    renameSync(oldProfileDir, newProfileDir);

    // Update profile manifest
    const manifestPath = join(newProfileDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.Name = profileName;
    manifest.Pages.Default = uuidMap[manifest.Pages.Default] || manifest.Pages.Default;
    manifest.Pages.Pages = manifest.Pages.Pages.map(p => uuidMap[p] || p);
    writeFileSync(manifestPath, JSON.stringify(manifest));

    return new ProfileEditor(targetDir);
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
   * @param {string} [opts.titleColor] - Title text color as "#RRGGBB"
   * @param {string} [opts.titleAlignment] - "top", "middle", or "bottom"
   * @param {number} [opts.fontSize] - Font size (e.g., 11, 12, 16)
   * @param {string} [opts.fontStyle] - "Bold", "Italic", or "Bold Italic"
   */
  addHotkeyButton(pageUUID, col, row, { label, key, ctrl, shift, alt, win, imagePath, titleColor, titleAlignment, fontSize, fontStyle }) {
    let imageRef = '';
    if (imagePath) {
      imageRef = addImage(this.getPageDir(pageUUID), imagePath);
    }

    const hotkeys = buildHotkey({ key, ctrl, shift, alt, win });

    const state = { Image: imageRef, Title: label };
    if (titleColor) state.TitleColor = titleColor;
    if (titleAlignment) state.TitleAlignment = titleAlignment;
    if (fontSize) state.FontSize = fontSize;
    if (fontStyle) state.FontStyle = fontStyle;

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
      States: [state],
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
