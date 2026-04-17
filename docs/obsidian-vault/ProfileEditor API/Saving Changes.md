---
title: Saving Changes
created: 2026-04-16
tags: [api, profile-editor, save]
---

# Saving Changes

```js
editor.save();
```

Writes all modified page `manifest.json` files to disk. Only pages that have been changed are written.

## Important Notes

- `save()` writes to the **extracted directory**, not to a `.streamDeckProfile` file
- To produce a final `.streamDeckProfile`, use the [[Extract-Modify-Pack Pipeline]]
- Always validate before packing:

```bash
node src/index.js validate profiles/vs-code
node src/index.js pack profiles/vs-code "builds/VS Code.streamDeckProfile"
```

See also: [[Hotkey Buttons]], [[Extract-Modify-Pack Pipeline]]
