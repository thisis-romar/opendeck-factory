import AdmZip from 'adm-zip';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Recursively collect all file paths in a directory.
 * @param {string} dir - Directory to walk
 * @returns {string[]} Array of absolute file paths
 */
function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Package a directory into a .streamDeckProfile ZIP archive.
 * @param {string} sourceDir - Directory containing the extracted profile
 * @param {string} outputPath - Output .streamDeckProfile file path
 */
export function pack(sourceDir, outputPath) {
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const zip = new AdmZip();
  const files = walkDir(sourceDir);

  for (const filePath of files) {
    // Use forward slashes for ZIP paths (standard convention)
    const zipPath = relative(sourceDir, filePath).replace(/\\/g, '/');
    zip.addLocalFile(filePath, zipPath.substring(0, zipPath.lastIndexOf('/')));
  }

  zip.writeZip(outputPath);
  console.log(`Packed ${files.length} files to: ${outputPath}`);
}
