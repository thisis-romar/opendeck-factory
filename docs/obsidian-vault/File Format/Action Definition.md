---
title: Action Definition
created: 2026-04-16
tags: [file-format, action, hotkey]
---

# Action Definition Structure

Each button in a page manifest is an action definition:

```json
{
  "ActionID": "random-uuid-v4",
  "LinkedTitle": true,
  "Name": "Hotkey",
  "Plugin": {
    "Name": "Activate a Key Command",
    "UUID": "com.elgato.streamdeck.system.hotkey",
    "Version": "1.0"
  },
  "Settings": {
    "Coalesce": true,
    "Hotkeys": [activeSlot, emptySlot, emptySlot, emptySlot]
  },
  "State": 0,
  "States": [{
    "Image": "Images/ABCDEFGHIJKLMNOPQRSTUVWXYZZ.png",
    "Title": "Label\n"
  }]
}
```

## Hotkeys Array

4-slot array. **Only slot 0 is active**, slots 1-3 must be the empty sentinel:

```json
{ "NativeCode": 146, "QTKeyCode": 33554431, "VKeyCode": -1 }
```

## Active Slot Structure

```json
{
  "KeyModifiers": 2,        // Bitmask: Shift=1, Ctrl=2, Alt=4, Win=8
  "NativeCode": 80,         // Windows Virtual Key Code (e.g., P=80)
  "QTKeyCode": 80,          // ASCII for letters/numbers; Qt offset for special keys (F1-F12, arrows, etc.)
  "VKeyCode": 80            // Matches NativeCode for letters/numbers (A-Z, 0-9); -1 for all other keys
}
```

See also: [[Windows Virtual Key Codes]], [[Modifier Bitmask]], [[Hotkey Buttons]]
