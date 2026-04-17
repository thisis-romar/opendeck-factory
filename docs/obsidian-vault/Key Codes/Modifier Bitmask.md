---
title: Modifier Bitmask
created: 2026-04-16
tags: [key-codes, modifiers, bitmask]
---

# Modifier Bitmask System

The `KeyModifiers` field in hotkey definitions uses a bitmask:

| Modifier | Value | Binary |
|----------|-------|--------|
| Shift | 1 | `0001` |
| Ctrl | 2 | `0010` |
| Alt | 4 | `0100` |
| Win | 8 | `1000` |

## Examples

| Shortcut | KeyModifiers |
|----------|-------------|
| Ctrl+P | 2 |
| Ctrl+Shift+P | 3 (2+1) |
| Ctrl+Alt+Delete | 6 (2+4) |
| Ctrl+Shift+Alt+Win | 15 (1+2+4+8) |

## Implementation

`src/hotkey.js` → `buildHotkey()` calculates the bitmask from boolean flags:

```js
const modifiers =
  (shift ? 1 : 0) |
  (ctrl ? 2 : 0) |
  (alt ? 4 : 0) |
  (win ? 8 : 0);
```

**No chord shortcuts** — only a single keypress per button (with modifiers).

See also: [[Windows Virtual Key Codes]], [[Hotkey Buttons]]
