---
title: Capture Stream Deck Reference Profile
description: Build and validate a reference .streamDeckProfile containing all known built-in Stream Deck action types for reverse engineering
version: 1.0.0
created: 2026-04-21T00:00:00Z
last_updated: 2026-04-21T00:00:00Z
---

## Charter

Invoke this skill when asked to build, update, or re-verify the reference profile that documents every known built-in Stream Deck action type. The reference profile serves as a ground-truth JSON corpus for reverse engineering action schemas and validating engine output.

## Inputs and Outputs

**Inputs:**
- Optional: specific action type(s) to add or verify
- Optional: target profile name (default: `reference-all-actions`)

**Outputs:**
- Updated extracted profile at `profiles/reference-all-actions/` (in opendeck-factory)
- Packed `.streamDeckProfile` at `originals/reference-all-actions.streamDeckProfile` (in stream-deck-catalog)

## Tool Safety

| Category | Operations |
|----------|-----------|
| SAFE_READ | `node src/index.js list`, `node src/index.js validate`, reading manifest JSON |
| DESTRUCTIVE | Running `expand-reference-profile.js`, writing manifest files, `pack` |
| GUI (subagent only) | Right-click gestures (Pin, Wallpaper), Export via Stream Deck app |

Never run DESTRUCTIVE operations against the live `%APPDATA%\Elgato\StreamDeck\ProfilesV3\` directory while the Stream Deck app is running — changes write through to app state.

## Workflow

### Step 1: Verify Current State

Read the existing profile's page manifests to see which action types are present:

```bash
node src/index.js list profiles/reference-all-actions
```

Compare against the known action type inventory (see Reference section below).

### Step 2: Regenerate via Script

The authoritative generator is `scripts/expand-reference-profile.js`. Run it against the live profile directory:

```bash
node scripts/expand-reference-profile.js
```

This script:
- Writes all 4 page manifests (Navigation, System, Profile, Multi-action)
- Generates composite SVG icons (colored background + plugin icon) for every button
- Uses viewBox-aware wrapping to normalize icons from different plugin coordinate spaces to 144×144

**viewBox handling:** icons from different plugins use inconsistent SVG coordinate spaces (20px, 24px, 72px, 144px). The script wraps non-144×144 viewBoxes with `<svg x="0" y="0" width="144" height="144" viewBox="...">` to scale them to fill the button canvas.

### Step 3: Validate

```bash
node src/index.js validate profiles/reference-all-actions
```

Confirm 0 errors before proceeding.

### Step 4: Pack and Copy to Catalog

```bash
node src/index.js pack profiles/reference-all-actions "builds/Reference All Actions.streamDeckProfile"
cp "builds/Reference All Actions.streamDeckProfile" ../stream-deck-catalog/originals/reference-all-actions.streamDeckProfile
```

### Step 5: Add New Action Types (if needed)

To add an action type not yet in the reference profile:

1. Identify the action's plugin ID and icon path under `%APPDATA%\Elgato\StreamDeck\plugins\`
2. Add an entry to the `ICON` map in `expand-reference-profile.js`
3. Add a row to the appropriate page's layout array
4. If the action requires GUI gestures (Pin, Wallpaper), invoke the `streamdeck-driver` subagent to place the action via the app, then export and compare the resulting manifest to learn the schema
5. Add the discovered schema to the engine or document it in `docs/obsidian-vault/`

## Reference: Known Action Types

### Page 1 — Navigation
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.profile.openchild` | Open Folder |
| 1 | 0 | `com.elgato.streamdeck.profile.backtoparent` | Back to Parent |
| 0 | 1 | `com.elgato.streamdeck.profile.rotate` | Switch Profile |
| 1 | 1 | `com.elgato.streamdeck.profiles.previouspage` | Prev Page |
| 2 | 1 | `com.elgato.streamdeck.profiles.nextpage` | Next Page |
| 0 | 2 | `com.elgato.streamdeck.profiles.page` | Go to Page |

### Page 2 — System
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.system.open` | Open/Run |
| 1 | 0 | `com.elgato.streamdeck.system.webpage` | Open URL |
| 0 | 1 | `com.elgato.streamdeck.system.text` | Text |
| 1 | 1 | `com.elgato.streamdeck.hotkey` | Hotkey |
| 0 | 2 | `com.elgato.streamdeck.system.mediaplayback` | Media Play/Pause |
| 1 | 2 | `com.elgato.streamdeck.system.audioinputmute` | Mute Mic |

### Page 3 — Profile/Display
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.profile.openchild` | Open Folder |
| 1 | 1 | `com.elgato.streamdeck.profile.backtoparent` | Back |

### Page 4 — Multi-Action
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.multiactions` | Multi-Action |
| 1 | 1 | `com.elgato.streamdeck.multiactions.delay` | Delay |

## Action Types Requiring GUI Capture

These action types cannot be placed via JSON injection alone — their schema is incomplete or they require right-click gestures:

| Action | Reason | Subagent task |
|--------|--------|---------------|
| Pinned Action | Right-click → Pin gesture only | Capture manifest after pinning |
| Wallpaper | Right-click → Set from file | Capture manifest after set |
| Multi Action with custom title+icon | Engine sets display incorrectly | Compare GUI-placed vs engine-placed manifests |

Use the `streamdeck-driver` subagent for these. After capture, diff the exported manifest against an engine-generated one to identify the missing fields.

## Plugin Icon Paths

Icons are sourced from installed Stream Deck plugins:

```
%APPDATA%\Elgato\StreamDeck\plugins\<plugin-id>.sdPlugin\Images\<icon-file>.svg
```

Key plugin IDs:
- `com.elgato.streamdeck.profile.sdPlugin` — profile navigation icons
- `com.elgato.streamdeck.multiactions.sdPlugin` — multi-action icons  
- `com.elgato.streamdeckweb.sdPlugin` — web/URL icons
- `com.elgato.streamdeck.sdPlugin` — core system icons (hotkey, open, text, media)

## Troubleshooting

**App creates extra pages while Stream Deck is running:** Stop the app before writing manifests. Scanning near the "+" button coordinate (x_client≈375) can trigger page creation via SendMessage. If this happens: stop app, remove the spurious UUID from the root `package.json` Pages array, delete its directory, re-run the generator, restart app.

**Page 6 accidentally created:** This happened during coordinate scanning (x_client=375, y=380–500 range hit the "+" button). Fix: stop app → remove UUID from root manifest → delete directory → re-run script → restart app.

**SVG icons display as blank:** Check that the viewBox wrapper is applied. Icons with non-144×144 viewBoxes (e.g., `0 0 20 20`, `-12 -12 48 48`, `0 0 72 72`) need the nested `<svg viewBox>` treatment in `writeComposite()`.
