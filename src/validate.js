import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICE_MODELS } from './constants.js';

const HOTKEY_UUID = 'com.elgato.streamdeck.system.hotkey';
const REQUIRED_VERSION = '3.0';

/**
 * Validate an extracted .streamDeckProfile directory structure.
 * Checks manifest fields, grid bounds, image references, profile version,
 * and per-action invariants (State bounds, Hotkeys length, KeyModifiers).
 * @param {string} extractedDir
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(extractedDir) {
  const errors = [];

  const pkgPath = join(extractedDir, 'package.json');
  const rootManifestPath = join(extractedDir, 'manifest.json');
  const liveFormat = !existsSync(pkgPath) && existsSync(rootManifestPath);

  let deviceModel, pagesDir, pageUUIDs;

  if (liveFormat) {
    const manifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'));
    if (!manifest.Name)    errors.push('manifest.json: missing Name');
    if (!manifest.Version) errors.push('manifest.json: missing Version');
    if (!manifest.Device)  errors.push('manifest.json: missing Device');
    if (!manifest.Pages)   errors.push('manifest.json: missing Pages');
    if (manifest.Version && manifest.Version !== REQUIRED_VERSION) {
      errors.push(`manifest.json: Version is "${manifest.Version}", expected "${REQUIRED_VERSION}" (required for Stream Deck app 7.1+)`);
    }
    deviceModel = manifest.Device?.Model || '20GBA9901';
    pagesDir = join(extractedDir, 'Profiles');
    pageUUIDs = manifest.Pages?.Pages || readdirSync(pagesDir);
  } else {
    if (!existsSync(pkgPath)) {
      errors.push('Missing package.json at root');
    } else {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.AppVersion)  errors.push('package.json: missing AppVersion');
      if (!pkg.DeviceModel) errors.push('package.json: missing DeviceModel');
      deviceModel = pkg.DeviceModel;
    }

    const profilesDir = join(extractedDir, 'Profiles');
    if (!existsSync(profilesDir)) {
      errors.push('Missing Profiles/ directory');
      return { valid: false, errors };
    }

    const sdProfiles = readdirSync(profilesDir).filter(e => e.endsWith('.sdProfile'));
    if (sdProfiles.length === 0) {
      errors.push('No .sdProfile directory found under Profiles/');
      return { valid: false, errors };
    }
    if (sdProfiles.length > 1) {
      errors.push(`Multiple .sdProfile directories found: ${sdProfiles.join(', ')}`);
    }

    const sdProfileDir = join(profilesDir, sdProfiles[0]);
    const manifestPath = join(sdProfileDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      errors.push('Missing profile manifest.json');
      return { valid: false, errors };
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!manifest.Name)    errors.push('Profile manifest: missing Name');
    if (!manifest.Version) errors.push('Profile manifest: missing Version');
    if (!manifest.Device)  errors.push('Profile manifest: missing Device');
    if (!manifest.Pages)   errors.push('Profile manifest: missing Pages');
    if (manifest.Version && manifest.Version !== REQUIRED_VERSION) {
      errors.push(`Profile manifest: Version is "${manifest.Version}", expected "${REQUIRED_VERSION}" (required for Stream Deck app 7.1+)`);
    }

    pagesDir = join(sdProfileDir, 'Profiles');
    if (!existsSync(pagesDir)) {
      errors.push('Missing page Profiles/ directory inside .sdProfile');
      return { valid: false, errors };
    }
    pageUUIDs = readdirSync(pagesDir);
    if (!deviceModel) deviceModel = '20GBA9901';
  }

  // Skip hidden files (.DS_Store, etc.) that can appear on macOS
  pageUUIDs = pageUUIDs.filter(e => !e.startsWith('.'));

  const device = DEVICE_MODELS[deviceModel] || { cols: 5, rows: 3 };

  for (const pageUUID of pageUUIDs) {
    const pageDir = join(pagesDir, pageUUID);
    const pageManifestPath = join(pageDir, 'manifest.json');

    if (!existsSync(pageManifestPath)) {
      errors.push(`Page ${pageUUID}: missing manifest.json`);
      continue;
    }

    const pageManifest = JSON.parse(readFileSync(pageManifestPath, 'utf8'));
    const controllers = pageManifest.Controllers;
    if (!controllers || !Array.isArray(controllers) || controllers.length === 0) {
      errors.push(`Page ${pageUUID}: missing or empty Controllers array`);
      continue;
    }

    const actions = controllers[0].Actions;
    if (!actions) continue; // Empty page is valid

    for (const [pos, action] of Object.entries(actions)) {
      const match = pos.match(/^(\d+),(\d+)$/);
      if (!match) {
        errors.push(`Page ${pageUUID}: invalid position format "${pos}"`);
        continue;
      }

      const col = parseInt(match[1]);
      const row = parseInt(match[2]);

      if (col >= device.cols || row >= device.rows) {
        errors.push(`Page ${pageUUID}: position ${pos} is outside grid bounds (${device.cols}x${device.rows})`);
      }

      // State index must be within States array bounds
      if (action.States && typeof action.State === 'number') {
        if (action.State < 0 || action.State >= action.States.length) {
          errors.push(`Page ${pageUUID}: position ${pos}: State index ${action.State} out of bounds (${action.States.length} state(s))`);
        }
      }

      // Image references must exist on disk
      if (action.States) {
        for (const state of action.States) {
          if (state.Image && state.Image.length > 0) {
            const imagePath = join(pageDir, state.Image);
            if (!existsSync(imagePath)) {
              errors.push(`Page ${pageUUID}: image not found: ${state.Image}`);
            }
          }
        }
      }

      // Hotkey-specific invariants
      if (action.UUID === HOTKEY_UUID) {
        // Plugin.UUID must match top-level UUID
        if (action.Plugin?.UUID && action.Plugin.UUID !== action.UUID) {
          errors.push(`Page ${pageUUID}: position ${pos}: Plugin.UUID "${action.Plugin.UUID}" does not match UUID "${action.UUID}"`);
        }

        // Hotkeys must be an array of exactly 4 entries (1 active + 3 empty padding slots)
        const hotkeys = action.Settings?.Hotkeys;
        if (hotkeys !== undefined) {
          if (!Array.isArray(hotkeys) || hotkeys.length !== 4) {
            errors.push(
              `Page ${pageUUID}: position ${pos}: Hotkeys must be an array of 4 entries, got ${Array.isArray(hotkeys) ? hotkeys.length : typeof hotkeys}`
            );
          } else {
            // KeyModifiers bitmask must be consistent with individual flag fields
            for (let i = 0; i < hotkeys.length; i++) {
              const hk = hotkeys[i];
              const expected =
                (hk.KeyShift  ? 1 : 0) |
                (hk.KeyCtrl   ? 2 : 0) |
                (hk.KeyOption ? 4 : 0) |
                (hk.KeyCmd    ? 8 : 0);
              if (typeof hk.KeyModifiers === 'number' && hk.KeyModifiers !== expected) {
                errors.push(
                  `Page ${pageUUID}: position ${pos}: Hotkeys[${i}].KeyModifiers is ${hk.KeyModifiers}, expected ${expected} (Shift=${!!hk.KeyShift} Ctrl=${!!hk.KeyCtrl} Option=${!!hk.KeyOption} Cmd=${!!hk.KeyCmd})`
                );
              }
            }
          }
        }
      }
    }

    // Page icon must exist if referenced
    if (pageManifest.Icon && pageManifest.Icon.length > 0) {
      const iconPath = join(pageDir, pageManifest.Icon);
      if (!existsSync(iconPath)) {
        errors.push(`Page ${pageUUID}: icon not found: ${pageManifest.Icon}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
