---
title: Loading Profiles
created: 2026-04-16
tags: [api, profile-editor, loading]
---

# Loading Profiles

The `ProfileEditor` class (`src/profile.js`) is the central API for reading and writing profile data.

## Constructor

```js
import { resolve } from 'node:path';
import { ProfileEditor } from '../src/profile.js';

const editor = new ProfileEditor(resolve('profiles/vs-code'));
```

Takes the path to an **extracted** profile directory (not the .streamDeckProfile ZIP).

## What it loads

1. Reads `package.json` for device model info
2. Finds the `.sdProfile` directory
3. Reads the profile `manifest.json` for pages list
4. Provides access to device info:

```js
const { cols, rows } = editor.deviceInfo;
// { name: "Stream Deck MK.2", cols: 5, rows: 3 }
```

## Creating from Template

For new applications, use `initFromTemplate()` to clone `profiles/_template/` with proper UUIDs:

```js
const templateDir = resolve('profiles/_template');
const targetDir = resolve('profiles/my-app');

const editor = ProfileEditor.initFromTemplate(templateDir, targetDir, 'My App');
```

This method:
1. Clones the template directory
2. Generates UUIDs for the profile folder and all page folders
3. Updates the profile manifest with new page UUID references and profile name
4. Returns a `ProfileEditor` instance ready for populating

## Prerequisites

For existing profiles, extract first:
```bash
node src/index.js extract "originals/VS Code.streamDeckProfile" profiles/vs-code
```

See also: [[Querying the Grid]], [[Extract-Modify-Pack Pipeline]]
