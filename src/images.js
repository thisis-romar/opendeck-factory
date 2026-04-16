import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

// Base32 charset (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32-encoded filename matching Stream Deck's naming convention.
 * Format: 26 uppercase chars + "Z" + extension
 * @param {string} extension - File extension including dot (e.g. ".png")
 * @returns {string} Generated filename
 */
export function generateFilename(extension) {
  let name = '';
  for (let i = 0; i < 26; i++) {
    name += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)];
  }
  return name + 'Z' + extension;
}

/**
 * Copy an image file into a page's Images/ directory with a generated filename.
 * @param {string} pageDir - Absolute path to the page directory
 * @param {string} sourcePath - Absolute path to the source image
 * @returns {string} Relative path for use in manifest (e.g. "Images/XXXXX.png")
 */
export function addImage(pageDir, sourcePath) {
  const imagesDir = join(pageDir, 'Images');
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
  }

  const ext = extname(sourcePath);
  const filename = generateFilename(ext);
  const destPath = join(imagesDir, filename);
  copyFileSync(sourcePath, destPath);

  return `Images/${filename}`;
}
