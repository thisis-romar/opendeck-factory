import AdmZip from 'adm-zip';
import { existsSync, mkdirSync } from 'node:fs';

/**
 * Extract a .streamDeckProfile ZIP archive to a directory.
 * @param {string} profilePath - Path to the .streamDeckProfile file
 * @param {string} outputDir - Directory to extract into
 */
export function extract(profilePath, outputDir) {
  if (!existsSync(profilePath)) {
    throw new Error(`Profile not found: ${profilePath}`);
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const zip = new AdmZip(profilePath);
  zip.extractAllTo(outputDir, true);

  console.log(`Extracted to: ${outputDir}`);
  const entries = zip.getEntries();
  console.log(`  ${entries.length} entries extracted`);
}
