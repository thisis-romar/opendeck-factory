import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICE_MODELS } from './constants.js';

/**
 * Validate an extracted .streamDeckProfile directory structure.
 * @param {string} extractedDir - Path to the extracted profile directory
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(extractedDir) {
  const errors = [];

  const pkgPath = join(extractedDir, 'package.json');
  const rootManifestPath = join(extractedDir, 'manifest.json');
  const liveFormat = !existsSync(pkgPath) && existsSync(rootManifestPath);

  let deviceModel, pagesDir, pageUUIDs;

  if (liveFormat) {
    // Live format: root manifest.json + Profiles/<page-uuid>/ directly
    const manifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'));
    if (!manifest.Name) errors.push('manifest.json: missing Name');
    if (!manifest.Version) errors.push('manifest.json: missing Version');
    if (!manifest.Device) errors.push('manifest.json: missing Device');
    if (!manifest.Pages) errors.push('manifest.json: missing Pages');
    deviceModel = manifest.Device?.Model || '20GBA9901';
    pagesDir = join(extractedDir, 'Profiles');
    pageUUIDs = manifest.Pages?.Pages || readdirSync(pagesDir);
  } else {
    // Normalized format: package.json + Profiles/<uuid>.sdProfile/Profiles/<page-uuid>/
    if (!existsSync(pkgPath)) {
      errors.push('Missing package.json at root');
    } else {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.AppVersion) errors.push('package.json: missing AppVersion');
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
    if (!manifest.Name) errors.push('Profile manifest: missing Name');
    if (!manifest.Version) errors.push('Profile manifest: missing Version');
    if (!manifest.Device) errors.push('Profile manifest: missing Device');
    if (!manifest.Pages) errors.push('Profile manifest: missing Pages');

    pagesDir = join(sdProfileDir, 'Profiles');
    if (!existsSync(pagesDir)) {
      errors.push('Missing page Profiles/ directory inside .sdProfile');
      return { valid: false, errors };
    }
    pageUUIDs = readdirSync(pagesDir);
    if (!deviceModel) deviceModel = '20GBA9901';
  }

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

      // Validate image references exist
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
    }

    // Check page icon exists
    if (pageManifest.Icon && pageManifest.Icon.length > 0) {
      const iconPath = join(pageDir, pageManifest.Icon);
      if (!existsSync(iconPath)) {
        errors.push(`Page ${pageUUID}: icon not found: ${pageManifest.Icon}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
