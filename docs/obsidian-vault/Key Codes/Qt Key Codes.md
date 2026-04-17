---
title: Qt Key Codes
created: 2026-04-16
tags: [key-codes, qt]
---

# Qt Key Codes

Used as `QTKeyCode` in hotkey definitions. For letters and numbers, QTKeyCode equals the ASCII value. For special keys, Qt uses offset values.

## Letters & Numbers
`QTKeyCode` = ASCII value (same as NativeCode for A-Z, 0-9)

## Special Keys (from `src/constants.js` → `QT_KEY_CODES`)

| Key | QTKeyCode |
|-----|-----------|
| UP | 16777235 |
| DOWN | 16777237 |
| LEFT | 16777234 |
| RIGHT | 16777236 |
| ENTER | 16777220 |
| ESCAPE | 16777216 |
| SPACE | 32 |
| TAB | 16777217 |
| BACKSPACE | 16777219 |
| DELETE | 16777223 |
| HOME | 16777232 |
| END | 16777233 |
| PAGEUP | 16777238 |
| PAGEDOWN | 16777239 |
| F1-F12 | 16777264-16777275 |

## Empty Sentinel
When a hotkey slot is unused:
```json
{ "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1 }
```

See also: [[Windows Virtual Key Codes]], [[Action Definition]]
