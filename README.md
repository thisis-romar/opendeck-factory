# OpenDeck Factory

Open-source engine for programmatically creating, editing, and repacking Elgato Stream Deck `.streamDeckProfile` files. Define your shortcuts in JSON, generate icons, and produce ready-to-import profiles — no manual button-by-button setup required.

## Features

- **Extract → Modify → Pack** pipeline for `.streamDeckProfile` ZIP archives
- **Hotkey buttons** with full modifier support (Ctrl, Shift, Alt, Win)
- **Multi-action buttons** for chord shortcuts (e.g., `Ctrl+K` then `Ctrl+M`)
- **Template system** — clone a blank profile and populate it programmatically
- **Icon generation** — 144×144 SVG icons, color-coded by shortcut category
- **Validation** — verify profile structure, image refs, and grid bounds before packing
- **Multi-device support** — MK.2, XL, Mini, and Stream Deck +
- **Pre-commit hook** — auto-validates staged profiles on `git commit`

## Quick Start

```bash
# Install
npm install

# Extract an existing profile to inspect/edit
node src/index.js extract "My Profile.streamDeckProfile" my-profile

# View the button grid
node src/index.js list my-profile

# Validate structure
node src/index.js validate my-profile

# Pack back to importable file
node src/index.js pack my-profile "My Profile.streamDeckProfile"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `extract <profile> [outdir]` | Unzip `.streamDeckProfile` to an editable directory (default: `_extracted`) |
| `pack <dir> <output>` | Pack a directory back into a `.streamDeckProfile` ZIP |
| `validate <dir>` | Validate profile structure, manifests, image refs, and grid bounds |
| `list <dir>` | Print ASCII grid layout showing all pages and button labels |

All commands are run via `node src/index.js <command> <args>`.

## Generating Profiles from Shortcut Data

Instead of manually placing buttons, define shortcuts in a JSON file and generate the entire profile automatically.

```bash
# Generate icons from shortcut definitions
node scripts/generate-icons.js vs-code

# Generate profile from shortcuts (creates from template if profile doesn't exist)
node scripts/generate-from-shortcuts.js vs-code --profile vs-code-colored

# Validate and pack
node src/index.js validate profiles/vs-code-colored
node src/index.js pack profiles/vs-code-colored "builds/VS Code Colored.streamDeckProfile"
```

### Shortcut Data Format

Create `data/shortcuts/<app-name>.json`:

```json
{
  "metadata": {
    "displayName": "VS Code",
    "source": "VS Code Default Keybindings (Windows)",
    "categoryStyles": {
      "general": { "titleColor": "#4FC3F7", "fontSize": 11 },
      "navigation": { "titleColor": "#81C784", "fontSize": 11 }
    }
  },
  "shortcuts": [
    {
      "command": "workbench.action.showCommands",
      "label": "Command\nPalette\n",
      "key": "P",
      "modifiers": { "ctrl": true, "shift": true },
      "category": "general",
      "priority": 1
    },
    {
      "command": "workbench.action.toggleMaximizeEditorGroup",
      "label": "Maximize\nGroup\n",
      "type": "chord",
      "chordKeys": [
        { "key": "K", "ctrl": true },
        { "key": "M", "ctrl": true }
      ],
      "category": "chord",
      "priority": 1
    }
  ]
}
```

**Fields:**
- `label` — Button title. Use `\n` for line breaks (max 3 lines). Must end with `\n`.
- `key` — Key name matching a key in `src/constants.js` `KEY_CODES` (e.g., `P`, `F5`, `BACKTICK`)
- `modifiers` — `{ ctrl, shift, alt, win }` booleans
- `category` — Used for sorting and icon color: `general`, `navigation`, `view`, `editing`, `debug`, `terminal`, `search`, `file`, `editor`, `chord`
- `priority` — Sort order within category (lower = first)
- `type: "chord"` + `chordKeys` — For multi-action buttons that send sequential keypresses

## Project Structure

```
opendeck-factory/
├── src/                    Core modules
│   ├── index.js            CLI entry point
│   ├── profile.js          ProfileEditor class
│   ├── hotkey.js            Hotkey builder (key codes → action JSON)
│   ├── constants.js        Key codes, device models, plugin templates
│   ├── extract.js          ZIP extraction
│   ├── pack.js             ZIP packing
│   ├── validate.js         Profile structure validation
│   └── images.js           Image file handling
├── scripts/                Generation & utility scripts
│   ├── generate-from-shortcuts.js   Build profile from shortcut JSON
│   ├── generate-icons.js            Generate category-colored SVG icons
│   ├── fill-grid.js                 Fill empty slots with placeholders
│   └── fix-typo.js                  Fix label typos in profiles
├── profiles/               Extracted profile directories
│   └── _template/          Blank template (cloned for new profiles)
├── data/                   Shortcut data and icon assets (see catalog repo)
├── docs/
│   └── obsidian-vault/     Technical docs (file format, key codes, API, patterns)
├── .claude/
│   ├── skills/             Claude Code skill definitions (workflow playbooks)
│   ├── agents/             Subagent definitions (e.g., streamdeck-driver)
│   └── settings.json       Project-level Claude Code settings
├── .mcp.json               Project-scoped MCP server config (Windows-MCP)
└── package.json            Node.js ESM, single dependency: adm-zip
```

## ProfileEditor API

The `ProfileEditor` class (`src/profile.js`) provides the programmatic interface for building profiles.

```js
import { ProfileEditor } from './src/profile.js';

// Create a new profile from the blank template
const editor = ProfileEditor.initFromTemplate(
  'profiles/_template',
  'profiles/my-app',
  'My App'
);

// Or load an existing profile
const editor = new ProfileEditor('profiles/my-app');

// Add a hotkey button
editor.addHotkeyButton(pageUUID, col, row, {
  label: 'Save\n',
  key: 'S',
  ctrl: true,
  imagePath: '/path/to/icon.svg',
  titleColor: '#4FC3F7',
});

// Add a multi-action button (chord shortcut)
editor.addMultiActionButton(pageUUID, col, row, {
  label: 'Maximize\nGroup\n',
  steps: [
    { key: 'K', ctrl: true },
    { key: 'M', ctrl: true },
  ],
});

// Query the grid
const pages = editor.getPageUUIDs();
const emptySlots = editor.getEmptyPositions(pageUUID);
const action = editor.getAction(pageUUID, col, row);

// Add pages dynamically
const newPages = editor.addPages(3);

// Save all changes
editor.save();
```

### Key Methods

| Method | Description |
|--------|-------------|
| `initFromTemplate(templateDir, targetDir, name)` | Clone template, generate UUIDs, return new editor |
| `addHotkeyButton(page, col, row, opts)` | Add a single-keypress hotkey button |
| `addMultiActionButton(page, col, row, opts)` | Add a multi-action button for chord shortcuts |
| `addPages(count)` | Create additional blank pages, returns new UUIDs |
| `getPageUUIDs()` | List all page UUIDs in the profile |
| `getEmptyPositions(page)` | Find empty grid slots on a page |
| `getAction(page, col, row)` | Get the action definition at a position |
| `setAction(page, col, row, def)` | Set an action at a position |
| `removeAction(page, col, row)` | Remove an action from a position |
| `updateTitle(page, col, row, title)` | Change a button's label |
| `save()` | Write all changes to disk |

## Supported Devices

| Model ID | Device | Grid |
|----------|--------|------|
| `20GBA9901` / `20GBA9902` | Stream Deck MK.2 | 5 × 3 (15 buttons) |
| `20GBA9911` | Stream Deck XL | 8 × 4 (32 buttons) |
| `20GBA9903` | Stream Deck Mini | 3 × 2 (6 buttons) |
| `10GBD9901` | Stream Deck + | 4 × 2 (8 buttons) |

## Supported Keys

**Letters:** A–Z | **Numbers:** 0–9 | **Function:** F1–F12

**Navigation:** UP, DOWN, LEFT, RIGHT, HOME, END, PAGEUP, PAGEDOWN

**Special:** ENTER, ESCAPE, SPACE, TAB, BACKSPACE, DELETE

**Punctuation:** BACKTICK, MINUS, EQUALS, LBRACKET, RBRACKET, BACKSLASH, SEMICOLON, QUOTE, COMMA, PERIOD, SLASH

**Modifiers:** Ctrl, Shift, Alt, Win (bitmask flags: 2, 1, 4, 8)

Full mappings in [`src/constants.js`](src/constants.js).

## Documentation

Detailed technical documentation lives in [`docs/obsidian-vault/`](docs/obsidian-vault/) as an Obsidian vault:

- **File Format** — ZIP structure, manifest JSON schema, action types, image naming
- **Key Codes** — Windows VKey codes, Qt key codes, modifier bitmask
- **ProfileEditor API** — Loading, adding buttons, querying, saving
- **Patterns** — Extract-Modify-Pack, Batch Add, Find and Fix
- **Hardware** — Stream Deck MK.2 specifications

## Computer-Use Integration (optional)

This branch adds an opt-in integration with the [Windows-MCP](https://github.com/CursorTouch/Windows-MCP) server, enabling Claude Code sessions to drive the Elgato Stream Deck Windows app GUI directly. This is useful when capturing reference profiles for action types whose JSON schema is not yet known to the engine (e.g., Pinned Action, Wallpaper, Multi Action with custom title+icon — all of which require right-click gestures or visual feedback the engine can't reproduce from disk alone).

**JSON-injection-first principle.** GUI driving is the slow, fragile path — every click costs a model decision. The engine should always be the primary authoring surface. Use computer-use only for the irreducibly-GUI parts.

### Prerequisites

- Windows 10 or 11
- Elgato Stream Deck app 6.6+ installed
- [`uv`](https://docs.astral.sh/uv/) installed (`winget install astral-sh.uv`) — provides the `uvx` runner
- Claude Code CLI authenticated

### Setup

The repo ships a project-scoped `.mcp.json` that registers Windows-MCP. On first session start in this directory, Claude Code prompts to approve the new MCP server. Confirm.

```bash
# From this directory:
claude
# Then approve `windows-mcp` when prompted, and verify:
/mcp
# Should show: windows-mcp ✓ connected
```

### Conflict with Claude Desktop

If Claude Desktop on the same machine has Windows-MCP installed as a **DXT extension** (most common install path), **disable it** before driving the GUI from Claude Code. Two clients sharing one OS input queue will race on cursor state with no coordination primitive available.

```powershell
# Disable Windows-MCP DXT in Claude Desktop:
$p = "$env:APPDATA\Claude\Claude Extensions Settings\ant.dir.cursortouch.windows-mcp.json"
'{"isEnabled": false}' | Set-Content -Path $p -Encoding utf8
# Re-enable later by setting it back to true.
```

### Subagent

A purpose-built subagent at `.claude/agents/streamdeck-driver.md` provides a narrow tool surface (Windows-MCP tools + read-only filesystem). Invoke from a parent session for GUI tasks. The subagent has no Bash/Edit/Write — it cannot commit, install, or modify code; it only drives the app.

### When to use what

| Task | Authoring surface |
|------|-------------------|
| Hotkey buttons, multi-action chord shortcuts | `ProfileEditor` (engine) |
| Page layout, icons, titles, colors | `ProfileEditor` + `generate-icons.js` |
| Pinned Action, Wallpaper (right-click gestures) | `streamdeck-driver` subagent |
| Multi Action display with custom title+icon (broken in engine — TODO) | `streamdeck-driver` subagent until fixed |
| Profile export | Either: write `originals/` directly, or right-click → Export via subagent |

## Safety Rules

- **Always validate** before packing: `node src/index.js validate <dir>`
- Profile version must be `"3.0"` for Stream Deck app 7.1+
- Positions are `"col,row"` format (column-first, 0-indexed)
- Images should be 144×144 pixels (retina @2x for 72×72 display buttons)
- **Computer-use safety:** disable Claude Desktop's Windows-MCP before driving from Code; verify foreground window before each click; cap retries at 2 and surface a screenshot on failure (see `streamdeck-driver` agent operating principles)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All commits must be signed off under
the [DCO 1.1](https://developercertificate.org/).

## License

The engine is released under the Apache License, Version 2.0. See
[LICENSE](./LICENSE) and [NOTICE](./NOTICE) for terms and attributions.

The commercial asset catalog (profiles, icon packs, templates) is maintained
in a separate private repository under a proprietary commercial license. This
repository contains only the open-source engine.

"Stream Deck" and "Elgato" are trademarks of Corsair Memory, Inc. and are used
nominatively to describe compatibility. This project is not affiliated with,
endorsed by, or sponsored by Corsair Memory, Inc. or Elgato.
