---
title: Capture Stream Deck Reference Profile
name: capture-streamdeck-reference
description: Build and validate a reference .streamDeckProfile containing all known built-in Stream Deck action types for reverse engineering
version: 1.0.0
created: 2026-04-21T00:00:00Z
lastmod: 2026-04-23T03:05:07Z
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

Read the page manifests directly to see which action types are present:

```bash
# Note: list/validate commands do NOT work on profiles/reference-all-actions/
# because that directory uses the live-app format (manifest.json + Profiles/<page-uuid>/)
# not the ProfileEditor format (package.json + Profiles/<uuid>.sdProfile/...).
# Read page manifests directly instead:
ls profiles/reference-all-actions/Profiles/  # list page UUIDs
cat profiles/reference-all-actions/Profiles/<page-uuid>/manifest.json
```

Compare the Actions keys against the known action type inventory (see Reference section below).

### Step 2: Regenerate via Script

The authoritative generator is `scripts/expand-reference-profile.js`. Run it against the live profile directory:

```bash
node scripts/expand-reference-profile.js
```

This script:
- Writes all 4 page manifests (Navigation, System, Profile, Multi-action)
- Generates composite SVG icons (colored background + plugin icon) for every button
- Uses viewBox-aware wrapping to normalize icons from different plugin coordinate spaces to 144×144

**viewBox handling:** icons from different plugins use inconsistent SVG coordinate spaces (24px, 72px, 144px). For non-144×144 viewBoxes, the script uses `<g transform="scale(N)">` where N = 144/viewBoxWidth. Note: nested `<svg viewBox>` was tried but the Stream Deck app ignores nested SVG elements — `<g transform>` is the correct approach.

### Step 3: Validate

The `validate` command does not work on this profile (format mismatch — see Step 1 note). Validation is:
1. The script ran without errors
2. Visual inspection in the Stream Deck app — navigate all 4 pages and confirm buttons render correctly

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

### Page 1 — System (electric blue)
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.system.website` | Website |
| 1 | 0 | `com.elgato.streamdeck.system.hotkeyswitch` | Hotkey Switch |
| 2 | 0 | `com.elgato.streamdeck.system.hotkey` | Hotkey Ctrl+A |
| 3 | 0 | `com.elgato.streamdeck.system.open` | Open |
| 4 | 0 | `com.elgato.streamdeck.page.indicator` (app-rendered) | Page Indicator |
| 0 | 1 | `com.elgato.streamdeck.system.close` | Close |
| 1 | 1 | `com.elgato.streamdeck.system.text` | Text |
| 2 | 1 | `com.elgato.streamdeck.system.openapp` | Open App |
| 3 | 1 | `com.elgato.streamdeck.system.multimedia` (actionIdx:0) | Prev Track |
| 4 | 1 | `com.elgato.streamdeck.system.multimedia` (actionIdx:1) | Play/Pause |
| 0 | 2 | `com.elgato.streamdeck.page` (nav) | ← Prev Page |
| 1 | 2 | `com.elgato.streamdeck.system.multimedia` (actionIdx:2) | Next Track |
| 2 | 2 | `com.elgato.streamdeck.system.multimedia` (actionIdx:3) | Stop |
| 3 | 2 | `com.elgato.streamdeck.system.multimedia` (actionIdx:4) | Mute |
| 4 | 2 | `com.elgato.streamdeck.page` (nav) | Next Page → |

### Page 2 — Stream Deck (vivid orange)
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.system.timer` | Timer |
| 1 | 0 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:0) | Brighter |
| 2 | 0 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:1) | Darker |
| 3 | 0 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:2) | Max |
| 4 | 0 | `com.elgato.streamdeck.page.indicator` (app-rendered) | Page Indicator |
| 0 | 1 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:4) | Medium |
| 1 | 1 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:5) | Low |
| 2 | 1 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:6) | Minimum |
| 3 | 1 | `com.elgato.streamdeck.system.sleep` | Sleep |
| 4 | 1 | `com.elgato.streamdeck.vsdtoggle` | Toggle VSD |
| 0 | 2 | `com.elgato.streamdeck.page` (nav) | ← Prev Page |
| 1 | 2 | `com.elgato.streamdeck.system.keybrightness` (actionIdx:3) | High |
| 2 | 2 | `com.elgato.streamdeck.system.multimedia` (actionIdx:6) | Vol- |
| 3 | 2 | `com.elgato.streamdeck.system.multimedia` (actionIdx:5) | Vol+ |
| 4 | 2 | `com.elgato.streamdeck.page` (nav) | Next Page → |

### Page 3 — Navigation (vivid emerald)
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.profile.rotate` | Switch Profile |
| 1 | 0 | `com.elgato.streamdeck.page.goto` | Go to Page |
| 4 | 0 | `com.elgato.streamdeck.page.indicator` (app-rendered) | Page Indicator |
| 0 | 1 | `com.elgato.streamdeck.profile.backtoparent` | Parent Folder |
| 0 | 2 | `com.elgato.streamdeck.page` (nav) | ← Prev Page |
| 4 | 2 | `com.elgato.streamdeck.page` (nav) | Next Page → |
| GUI only | — | `com.elgato.streamdeck.profile.openchild` | Create Folder (see GUI Capture table) |

### Page 4 — Soundboard + Multi Act + Keys (vivid violet)
| Col | Row | Action ID | Label |
|-----|-----|-----------|-------|
| 0 | 0 | `com.elgato.streamdeck.soundboard.playaudio` | Play Audio |
| 1 | 0 | `com.elgato.streamdeck.soundboard.stopaudioplay` | Stop Audio |
| 2 | 0 | `com.elgato.streamdeck.multiactions.routine` | Multi Action |
| 3 | 0 | `com.elgato.streamdeck.multiactions.routine2` | Multi Switch |
| 4 | 0 | `com.elgato.streamdeck.page.indicator` (app-rendered) | Page Indicator |
| 0 | 1 | `com.elgato.streamdeck.keys.logic` | Key Logic |
| 1 | 1 | `com.elgato.streamdeck.multiactions.delay` | Delay |
| 2 | 1 | `com.elgato.streamdeck.system.digitaltime` | Digital Time |
| 3 | 1 | `com.elgato.streamdeck.keys.adaptor` | Key Adaptor |
| 4 | 1 | `com.elgato.streamdeck.keys.stack` | Key Stack |
| 0 | 2 | `com.elgato.streamdeck.page` (nav) | ← Prev Page |
| 1 | 2 | `com.elgato.streamdeck.multiactions.random` | Random Action |
| 2 | 2 | `com.elgato.streamdeck.system.pagination` | Pagination |
| 4 | 2 | `com.elgato.streamdeck.page` (nav) | Next Page → |

## Action Types Requiring GUI Capture

These action types cannot be placed via JSON injection alone — their schema is incomplete or they require right-click gestures. Use the `drive-windows-gui` skill for all of these.

| Action | UUID | Status | Reason | Subagent task |
|--------|------|--------|--------|---------------|
| Create Folder | `com.elgato.streamdeck.profile.openchild` | ❌ Not captured | Requires sub-profile structure the app creates on placement; JSON-only placement is silently dropped | Drag-drop onto Page 3, export manifest, diff against engine-generated |
| Pinned Action | unknown | ❌ Not captured | Right-click → Pin gesture only; no JSON equivalent | Right-click any button → Pin, export, read manifest |
| Wallpaper | unknown | ❌ Not captured | Right-click → Set Wallpaper from file | Right-click canvas → Set Wallpaper, export, read manifest |
| Multi Action title+icon | `com.elgato.streamdeck.multiactions.routine` | ❌ Not captured | Engine-placed Multi Action renders display incorrectly vs GUI-placed | Place via GUI, export, diff `States` and `Settings` vs engine output |

After capturing each schema, document the discovered fields in `docs/obsidian-vault/` and add to `expand-reference-profile.js` where applicable.

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
