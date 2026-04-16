// Key codes (Windows Virtual Key Codes)
export const KEY_CODES = {
  A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74,
  K: 75, L: 76, M: 77, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84,
  U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
  '0': 48, '1': 49, '2': 50, '3': 51, '4': 52,
  '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
  F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117,
  F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
  UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
  ENTER: 13, ESCAPE: 27, SPACE: 32, TAB: 9, BACKSPACE: 8, DELETE: 46,
  HOME: 36, END: 35, PAGEUP: 33, PAGEDOWN: 34,
  BACKTICK: 192, MINUS: 189, EQUALS: 187,
  LBRACKET: 219, RBRACKET: 221, BACKSLASH: 220,
  SEMICOLON: 186, QUOTE: 222, COMMA: 188, PERIOD: 190, SLASH: 191,
};

// Qt key codes for special keys (letters use ASCII code)
export const QT_KEY_CODES = {
  UP: 16777235,
  DOWN: 16777237,
  LEFT: 16777234,
  RIGHT: 16777236,
  ENTER: 16777220,
  ESCAPE: 16777216,
  SPACE: 32,
  TAB: 16777217,
  BACKSPACE: 16777219,
  DELETE: 16777223,
};

// Modifier bitmask flags
export const MODIFIER_FLAGS = {
  SHIFT: 1,
  CTRL: 2,
  ALT: 4,
  WIN: 8,
};

// Empty hotkey slot (placeholder for unused slots 1-3)
export const EMPTY_HOTKEY_SLOT = {
  KeyCmd: false,
  KeyCtrl: false,
  KeyModifiers: 0,
  KeyOption: false,
  KeyShift: false,
  NativeCode: 146,
  QTKeyCode: 33554431,
  VKeyCode: -1,
};

// Hotkey plugin template
export const PLUGIN_HOTKEY = {
  Name: "Activate a Key Command",
  UUID: "com.elgato.streamdeck.system.hotkey",
  Version: "1.0",
};

// Device grid dimensions
export const DEVICE_MODELS = {
  "20GBA9901": { name: "Stream Deck MK.2", cols: 5, rows: 3 },
  "20GBA9902": { name: "Stream Deck MK.2", cols: 5, rows: 3 },
  "10GBD9901": { name: "Stream Deck +", cols: 4, rows: 2 },
  "20GBA9911": { name: "Stream Deck XL", cols: 8, rows: 4 },
  "20GBA9903": { name: "Stream Deck Mini", cols: 3, rows: 2 },
};
