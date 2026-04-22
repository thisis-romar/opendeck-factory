/**
 * Shared semantic color system for opendeck-factory.
 *
 * Every Stream Deck key is image-driven — no setButtonColor API exists.
 * Colors are applied as SVG/PNG background fills; glyphs are white or near-black
 * based on WCAG relative luminance of the background.
 */

// Semantic category → background color.
// Used by generate-icons.js (app shortcuts) and any profile generator that
// wants consistent category-based tinting instead of per-page colors.
export const CATEGORY_COLORS = {
  // App shortcut categories
  general:    '#3B82F6',  // blue
  navigation: '#22C55E',  // green
  view:       '#A855F7',  // purple
  editing:    '#F97316',  // orange
  debug:      '#EF4444',  // red
  terminal:   '#14B8A6',  // teal
  search:     '#EAB308',  // amber
  file:       '#6366F1',  // indigo
  editor:     '#0EA5E9',  // sky
  chord:      '#EC4899',  // pink

  // Stream Deck built-in action categories (reference profile)
  system:     '#1464F4',  // electric blue  — OS / system control
  hardware:   '#F07800',  // vivid orange   — Stream Deck hardware
  wayfinding: '#00B84A',  // vivid emerald  — navigation / pages
  soundboard: '#8B2BE2',  // vivid violet   — soundboard + multi-action

  // Semantic intent
  lighting:   '#FFD700',  // gold
  ai:         '#00E5FF',  // cyan
  destructive:'#FF3B30',  // red
  neutral:    '#374151',  // graphite — nav corners, utility buttons
};

/**
 * Returns '#ffffff' or '#1a1a1a' for a given background hex color,
 * chosen for WCAG AA legibility (4.5:1 contrast ratio).
 * @param {string} bgHex - e.g. '#1464F4'
 * @returns {string}
 */
export function contrastColor(bgHex) {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  // WCAG relative luminance (IEC 61966-2-1 sRGB linearisation)
  const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  return L > 0.179 ? '#1a1a1a' : '#ffffff';
}
