---
title: Find and Fix
created: 2026-04-16
tags: [patterns, search, fix]
---

# Find and Fix Pattern

Script pattern from `scripts/fix-typo.js`:

```js
for (const pageUUID of editor.getPageUUIDs()) {
  const action = editor.getAction(pageUUID, 1, 1);
  if (action?.States?.[0]?.Title === "Pannel\n") {
    editor.updateTitle(pageUUID, 1, 1, "Panel\n");
    editor.save();
  }
}
```

## Use Cases

- Fix typos in button labels
- Update key bindings across pages
- Search for specific action types
- Bulk rename operations

See also: [[Querying the Grid]], [[Hotkey Buttons]]
