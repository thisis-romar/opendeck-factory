---
title: Extract-Modify-Pack Pipeline
created: 2026-04-16
tags: [patterns, pipeline, workflow]
---

# Extract → Modify → Pack Pipeline

## Step 1: Extract `.streamDeckProfile` to editable directory

```bash
node src/index.js extract "originals/VS Code.streamDeckProfile" profiles/vs-code
```

Uses `adm-zip` to unpack the ZIP archive. Creates the full directory tree.

## Step 2: Modify via scripts or manual JSON editing

```bash
node scripts/fill-grid.js     # Programmatic modification
# Or: directly edit profiles/vs-code/Profiles/{UUID}/Profiles/{PageUUID}/manifest.json
```

## Step 3: Validate

```bash
node src/index.js validate profiles/vs-code
```

Checks (`src/validate.js`):
- `package.json` has `AppVersion` + `DeviceModel`
- `.sdProfile` directory + `manifest.json` with Name/Version/Device/Pages
- Page Controllers arrays valid
- Action positions within grid bounds (col < cols, row < rows)
- Referenced image files exist on disk

## Step 4: Pack back to `.streamDeckProfile`

```bash
node src/index.js pack profiles/vs-code "builds/VS Code.streamDeckProfile"
```

Walks directory tree, adds all files to ZIP with DEFLATE, writes output.
**ZIP uses forward slashes** — even on Windows.

## Combined Build Script

```bash
npm run build:vs-code  # validate + pack in one step
```

See also: [[Loading Profiles]], [[Saving Changes]]
