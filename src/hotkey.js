import { KEY_CODES, QT_KEY_CODES, MODIFIER_FLAGS, EMPTY_HOTKEY_SLOT } from './constants.js';

/**
 * Build a 4-slot Hotkeys array for the Stream Deck hotkey action.
 * @param {object} opts
 * @param {string} opts.key - Key name (e.g. "B", "P", "UP", "BACKTICK")
 * @param {boolean} [opts.ctrl] - Ctrl modifier
 * @param {boolean} [opts.shift] - Shift modifier
 * @param {boolean} [opts.alt] - Alt/Option modifier
 * @param {boolean} [opts.win] - Win/Cmd modifier
 * @returns {object[]} 4-element Hotkeys array
 */
export function buildHotkey({ key, ctrl = false, shift = false, alt = false, win = false }) {
  const nativeCode = KEY_CODES[key];
  if (nativeCode === undefined) {
    throw new Error(`Unknown key: "${key}". Available: ${Object.keys(KEY_CODES).join(', ')}`);
  }

  let keyModifiers = 0;
  if (shift) keyModifiers |= MODIFIER_FLAGS.SHIFT;
  if (ctrl) keyModifiers |= MODIFIER_FLAGS.CTRL;
  if (alt) keyModifiers |= MODIFIER_FLAGS.ALT;
  if (win) keyModifiers |= MODIFIER_FLAGS.WIN;

  // For letter/number keys, QTKeyCode = ASCII code. For special keys, use lookup.
  const qtKeyCode = QT_KEY_CODES[key] ?? nativeCode;

  // VKeyCode matches NativeCode for letter keys; -1 for special keys (arrows, etc.)
  const isLetterOrNumber = (nativeCode >= 48 && nativeCode <= 57) || (nativeCode >= 65 && nativeCode <= 90);
  const vKeyCode = isLetterOrNumber ? nativeCode : -1;

  const activeSlot = {
    KeyCmd: win,
    KeyCtrl: ctrl,
    KeyModifiers: keyModifiers,
    KeyOption: alt,
    KeyShift: shift,
    NativeCode: nativeCode,
    QTKeyCode: qtKeyCode,
    VKeyCode: vKeyCode,
  };

  return [activeSlot, { ...EMPTY_HOTKEY_SLOT }, { ...EMPTY_HOTKEY_SLOT }, { ...EMPTY_HOTKEY_SLOT }];
}
