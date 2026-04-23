---
title: Generate Stream Deck Profile from App Shortcuts
name: generate-profile
description: End-to-end workflow for generating a .streamDeckProfile from an application's keyboard shortcuts
version: 1.1.0
created: 2026-04-17T00:00:00Z
lastmod: 2026-04-23T03:05:07Z
---

## Charter

Invoke this skill when asked to generate a `.streamDeckProfile` for an application's keyboard shortcuts. This skill takes structured shortcut data and produces a validated, packed profile ready for import into the Stream Deck app.

## Inputs and Outputs

**Inputs:**
- Application name (e.g., `vs-code`) — must match a file at `data/shortcuts/{app-name}.json`
- Device model (optional, default: MK.2 `20GBA9901` — 5 cols x 3 rows)
- Selection criteria (optional): category filter, max shortcut count, priority threshold

**Outputs:**
- Packed `.streamDeckProfile` in `builds/{App Name}.streamDeckProfile`
- Generation script at `scripts/generate-{app-name}.js` (reusable)

## Tool Safety

| Category | Operations |
|----------|-----------|
| SAFE_READ | `node src/index.js list`, `node src/index.js validate`, reading JSON files, reading `src/constants.js` |
| DESTRUCTIVE | `node src/index.js pack`, writing generation scripts, `editor.save()` |

Confirm with the user before running DESTRUCTIVE operations.

## Workflow

### Step 1: Load Shortcut Data

Read `data/shortcuts/{app-name}.json`. Validate that the file exists and each entry has:
- `command` (string) — VS Code command ID or description
- `label` (string) — Button label with `\n` line breaks, ending with `\n`
- `key` (string) — Key name matching a KEY_CODES entry in `src/constants.js`
- `modifiers` (object) — `{ ctrl, shift, alt, win }` booleans
- `category` (string) — One of: `general`, `editing`, `navigation`, `view`, `debug`, `terminal`
- `priority` (number) — Lower = higher priority (1 = most important)

If the file does not exist, inform the user it must be created first. Offer to help curate one.

### Step 2: Select Shortcuts

Apply selection criteria. Default strategy:
1. Sort by priority (ascending)
2. Group by category
3. Select top N shortcuts per grid capacity:
   - MK.2: 15 per page, 45 max (3 pages)
   - XL: 32 per page
   - Mini: 6 per page
   - +: 8 per page

### Step 3: Plan Grid Layout

Assign shortcuts to grid positions using category-based row grouping:

**MK.2 (5x3) default layout:**
| Row | Category | Example buttons |
|-----|----------|----------------|
| 0 | Navigation/Core | Command Palette, Quick Open, Terminal, Go To... |
| 1 | View/Panel | Sidebar, Panel, Explorer, Search, Extensions |
| 2 | Editing | Undo, Redo, Format, Comment, Word Wrap |

**Fill order:** Left-to-right within each row.

**Multi-page rules:**
- ≤15 shortcuts: 1 page
- ≤30 shortcuts: 2 pages (core on page 1, secondary on page 2)
- ≤45 shortcuts: 3 pages max (diminishing returns beyond 3)

**Overflow:** When a row is full, remaining shortcuts from that category spill into the next available row, then onto the next page.

### Step 4: Validate Key Compatibility

Check every shortcut's `key` against `KEY_CODES` in `src/constants.js`:

```
Supported: A-Z, 0-9, F1-F12, UP, DOWN, LEFT, RIGHT, ENTER, ESCAPE, SPACE, TAB,
           BACKSPACE, DELETE, HOME, END, PAGEUP, PAGEDOWN, BACKTICK, MINUS, EQUALS,
           LBRACKET, RBRACKET, BACKSLASH, SEMICOLON, QUOTE, COMMA, PERIOD, SLASH
```

**Flag and skip:**
- Keys not in KEY_CODES (e.g., Insert, PrintScreen, NumPad keys)

**Chord shortcuts** (multi-step like Ctrl+K then Ctrl+C) — use `editor.addMultiActionButton()` instead of `addHotkeyButton()`. Pass `steps` array with each keypress.

Report flagged shortcuts to the user.

### Step 5: Generate Script

Write a Node.js ESM script at `scripts/generate-{app-name}.js` following the pattern in `scripts/generate-from-shortcuts.js`:

```javascript
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ProfileEditor } from '../src/profile.js';

const appName = '{app-name}';
const shortcutData = JSON.parse(readFileSync(`data/shortcuts/${appName}.json`, 'utf8'));
const shortcuts = shortcutData.shortcuts;

// Clone template (with UUID generation) or use existing profile
const templateDir = resolve('profiles/_template');
const profileDir = resolve(`profiles/${appName}`);

let editor;
if (!existsSync(profileDir)) {
  const displayName = shortcutData.metadata?.displayName || appName;
  editor = ProfileEditor.initFromTemplate(templateDir, profileDir, displayName);
} else {
  editor = new ProfileEditor(profileDir);
}

const pages = editor.getPageUUIDs();
let pageIdx = 0;
let targetPage = pages[pageIdx];

// Layout: group by category, assign to grid
for (const shortcut of shortcuts) {
  const empty = editor.getEmptyPositions(targetPage);
  if (empty.length === 0) {
    pageIdx++;
    if (pageIdx >= pages.length) break;
    targetPage = pages[pageIdx];
  }

  const pos = editor.getEmptyPositions(targetPage)[0];
  editor.addHotkeyButton(targetPage, pos.col, pos.row, {
    label: shortcut.label,
    key: shortcut.key,
    ctrl: shortcut.modifiers?.ctrl || false,
    shift: shortcut.modifiers?.shift || false,
    alt: shortcut.modifiers?.alt || false,
    win: shortcut.modifiers?.win || false,
  });
}

editor.save();
console.log(`Profile generated for ${appName}.`);
```

`initFromTemplate()` automatically generates real UUIDs for the profile and page folders (replacing template placeholders like TEMPLATE-PROFILE, PAGE-1/2/3) and sets the profile name.

Adapt this template based on the actual layout plan from Step 3.

### Step 6: Run, Validate, and Pack

```bash
node scripts/generate-{app-name}.js
node src/index.js validate profiles/{app-name}
node src/index.js pack profiles/{app-name} "builds/{App Name}.streamDeckProfile"
```

### Step 7: Report

Print the final grid layout as a visual table:

```
Page 1: "Main"
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Command     │ Quick       │ Terminal    │ Go To Line  │ Maximize    │
│ Palette     │ Open        │             │             │ Window      │
│ Ctrl+Sh+P  │ Ctrl+P      │ Ctrl+`      │ Ctrl+G      │ Win+Up      │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ ...         │ ...         │ ...         │ ...         │ ...         │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

## Label Formatting Rules

- Max 2 words per line, max 3 lines
- Always end with `\n`
- Use `\n` to force line breaks at word boundaries
- Keep labels short — the 72x72 pixel buttons are small

**Examples:**
| VS Code Command | Label |
|-----------------|-------|
| Command Palette | `"Command\nPalette\n"` |
| Toggle Terminal | `"Terminal\n"` |
| Find in Files | `"Find in\nFiles\n"` |
| Format Document | `"Format\nDoc\n"` |
| Toggle Word Wrap | `"Word\nWrap\n"` |
| Primary Sidebar | `"Primary\nSidebar\n"` |

## Shortcut Translation Reference

VS Code notation → `addHotkeyButton()` params:

| VS Code | key | ctrl | shift | alt | win |
|---------|-----|------|-------|-----|-----|
| `Ctrl+Shift+P` | `"P"` | true | true | | |
| `Ctrl+P` | `"P"` | true | | | |
| `` Ctrl+` `` | `"BACKTICK"` | true | | | |
| `Shift+Alt+F` | `"F"` | | true | true | |
| `Alt+Z` | `"Z"` | | | true | |
| `Ctrl+Shift+E` | `"E"` | true | true | | |
| `Win+Up` | `"UP"` | | | | true |
| `Ctrl+/` | `"SLASH"` | true | | | |
| `Ctrl+[` | `"LBRACKET"` | true | | | |
| `F5` | `"F5"` | | | | |

## Device Grid Reference

| Model | Code | Grid | Keys/Page |
|-------|------|------|-----------|
| Stream Deck MK.2 | `20GBA9901` | 5x3 | 15 |
| Stream Deck XL | `20GBA9911` | 8x4 | 32 |
| Stream Deck Mini | `20GBA9903` | 3x2 | 6 |
| Stream Deck + | `10GBD9901` | 4x2 | 8 |

## Button Styling Properties

`addHotkeyButton()` accepts these optional styling properties in `States[0]`:

| Property | Type | Values | Effect |
|----------|------|--------|--------|
| `titleColor` | string | `"#RRGGBB"` | Title text color |
| `titleAlignment` | string | `"top"`, `"middle"`, `"bottom"` | Vertical title placement |
| `fontSize` | number | e.g., 11, 12, 16 | Font size |
| `fontStyle` | string | `"Bold"`, `"Italic"`, `"Bold Italic"` | Font weight/style |

These are only written to the manifest when provided (omitted = Stream Deck defaults).

## Colored Icon Generation

Run `node scripts/generate-icons.js <app-name>` to generate category-coded SVG icons.

**Category color scheme:**
| Category | Color | Hex |
|----------|-------|-----|
| general | Blue | `#3B82F6` |
| navigation | Green | `#22C55E` |
| view | Purple | `#A855F7` |
| editing | Orange | `#F97316` |
| debug | Red | `#EF4444` |
| terminal | Teal | `#14B8A6` |

Icons are output to `data/icons/<app-name>/` and automatically picked up by `generate-from-shortcuts.js`.

Use `categoryStyles` in the shortcut JSON metadata to apply consistent styling per category:
```json
"categoryStyles": {
  "general": { "titleColor": "#FFFFFF", "titleAlignment": "bottom", "fontSize": 11, "fontStyle": "Bold" }
}
```

## Template Profile

For new applications, clone `profiles/_template/` as the starting point. It contains:
- `package.json` with MK.2 device model
- Empty profile manifest with 3 pre-created pages
- Empty page manifests with Controllers ready for actions

To generate for a different device model, update `package.json.DeviceModel` after cloning.

## Quick Start: Full Pipeline

```bash
# 1. Generate colored icons
node scripts/generate-icons.js vs-code

# 2. Generate profile (from template, with icons and styling)
node scripts/generate-from-shortcuts.js vs-code --profile vs-code-colored

# 3. Validate and pack
node src/index.js validate profiles/vs-code-colored
node src/index.js pack profiles/vs-code-colored "builds/VS Code Colored.streamDeckProfile"

# 4. Check grid layout
node src/index.js list profiles/vs-code-colored
```
