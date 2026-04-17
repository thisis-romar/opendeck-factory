---
title: Batch Add
created: 2026-04-16
tags: [patterns, batch, scripting]
---

# Batch Add Buttons to Empty Positions

Script pattern from `scripts/fill-grid.js`:

```js
const newButtons = [
  { col: 1, row: 0, label: "Command\nPalette\n", key: "P", ctrl: true, shift: true },
  { col: 2, row: 0, label: "Quick\nOpen\n", key: "P", ctrl: true },
  { col: 3, row: 0, label: "Terminal\n", key: "BACKTICK", ctrl: true },
];

for (const btn of newButtons) {
  if (editor.getAction(targetPage, btn.col, btn.row)) {
    console.log(`Skipping ${btn.col},${btn.row} — occupied`);
    continue;
  }
  editor.addHotkeyButton(targetPage, btn.col, btn.row, btn);
}
editor.save();
```

## Key Points

- Always check if position is occupied before adding
- Use `getEmptyPositions()` to find available slots
- Titles must end with `\n`
- Key names must match `KEY_CODES` in `src/constants.js`

See also: [[Hotkey Buttons]], [[Querying the Grid]]
