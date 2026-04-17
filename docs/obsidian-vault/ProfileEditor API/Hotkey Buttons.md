---
title: Hotkey Buttons
created: 2026-04-16
tags: [api, profile-editor, hotkey]
---

# Adding Hotkey Buttons

## addHotkeyButton()

```js
editor.addHotkeyButton(pageUUID, col, row, {
  label: "Command\nPalette\n",   // \n for line breaks, end with \n
  key: "P",                      // KEY_CODES name (see constants.js)
  ctrl: true,                    // Modifier booleans
  shift: true,
  alt: false,
  win: false,
  imagePath: "/abs/path/icon.png" // Optional — copies to Images/ with Base32 name
});
```

## Under the Hood (`src/hotkey.js`)

1. Looks up `KEY_CODES[key]` for NativeCode (Windows Virtual Key Code)
2. Calculates `KeyModifiers` bitmask: Shift=1, Ctrl=2, Alt=4, Win=8
3. QTKeyCode = ASCII for letters/numbers, Qt offset for special keys
4. Returns 4-slot array: `[activeSlot, empty, empty, empty]`

## Modifying Existing Buttons

```js
// Update title
editor.updateTitle(pageUUID, col, row, "New Label\n");

// Replace entire action definition
editor.setAction(pageUUID, col, row, customActionDef);

// Remove a button
editor.removeAction(pageUUID, col, row);
```

See also: [[Modifier Bitmask]], [[Windows Virtual Key Codes]], [[Saving Changes]]
