---
title: Drive Windows GUI (Stream Deck App)
name: drive-windows-gui
description: Orchestrate the streamdeck-driver subagent to perform GUI operations in the Elgato Stream Deck app that cannot be done via JSON injection
version: 1.0.0
created: 2026-04-21T00:00:00Z
lastmod: 2026-04-23T03:05:07Z
---

## Charter

Invoke this skill when a task requires interacting with the Elgato Stream Deck Windows app UI directly — right-click gestures, GUI-only action placement, profile export, or capturing unknown action schemas. This skill orchestrates the `streamdeck-driver` subagent; it does not drive the GUI itself.

**JSON-injection-first principle.** GUI driving costs ~one model decision per click and is brittle to UI version changes. Always prefer writing manifest JSON directly. Only invoke this skill for the irreducibly-GUI parts.

## Inputs and Outputs

**Inputs:**
- Task description (what GUI operation must happen)
- Expected output (screenshot path, exported file path, or discovered JSON schema)

**Outputs:**
- Exported `.streamDeckProfile` file path (if export task)
- Discovered manifest JSON diff (if schema capture task)
- Subagent hand-off report (what was done, what was skipped, any UI surprises)

## Pre-flight Checklist

Before invoking the subagent, verify all three conditions:

1. **Stream Deck app is running** — `Get-Process StreamDeck` returns a process
2. **Windows-MCP is connected** — `/mcp` shows `windows-mcp ✓ connected`
3. **Desktop DXT is disabled** — `%APPDATA%\Claude\Claude Extensions Settings\ant.dir.cursortouch.windows-mcp.json` shows `{"isEnabled": false}`

If condition 3 fails, disable it first:
```powershell
$p = "$env:APPDATA\Claude\Claude Extensions Settings\ant.dir.cursortouch.windows-mcp.json"
'{"isEnabled": false}' | Set-Content -Path $p -Encoding utf8
```
Then restart Claude Desktop for the change to take effect.

If condition 1 fails, start the Stream Deck app before proceeding.

## When to Use This Skill

| Task | Use this skill? |
|------|----------------|
| Place Hotkey, Text, Open/Run, Media, Switch Profile buttons | No — use ProfileEditor |
| Place Open Folder, Back to Parent, Switch Page buttons | No — use ProfileEditor |
| Place Multi-Action (content only) | No — use ProfileEditor |
| **Pin a button via right-click** | Yes |
| **Set Wallpaper via right-click → Set from file** | Yes |
| **Capture unknown action type schema** | Yes |
| **Export profile via Preferences → Export** | Yes (or use PowerShell ZipArchive directly) |
| **Multi Action with custom title+icon (engine broken)** | Yes — until engine fix lands |

## Workflow

### Step 1: Confirm Pre-flight

Run the three pre-flight checks above. Do not proceed until all pass.

### Step 2: Invoke streamdeck-driver Subagent

Spawn the subagent with a precise task description:

```
Task: [specific UI operation]
Expected outcome: [what the subagent should return]
Live profile path: %APPDATA%\Elgato\StreamDeck\ProfilesV3\<uuid>.sdProfile\Profiles\<page-uuid>\manifest.json
Primary monitor: 1280×853 logical (scale 1.5×, raw 1920×1280)
Secondary monitor: 1099×720 logical at offset (1280, -118)
```

The subagent has `Read` + `mcp__windows-mcp__*` tools only — no Bash, Edit, or Write.

### Step 3: Receive Hand-off Report

The subagent returns:
1. What was completed
2. What was skipped and why
3. Any UI surprises (labels, behaviors differing from expectations)
4. Exported file path (if applicable)
5. Final Snapshot if UI is in non-trivial end state

### Step 4: Post-process Results

**For schema capture tasks:**
1. Read the manifest file the subagent operated on
2. Diff against a known-good engine-generated manifest
3. Document new fields in `docs/obsidian-vault/`
4. Update the engine (ProfileEditor / hotkey.js / constants.js) if the schema can be expressed programmatically

**For export tasks:**
1. Verify the exported file exists at the expected path
2. Move/copy to `stream-deck-catalog/originals/` if it's a reference profile
3. Run `node src/index.js validate` on the extracted version

### Step 5: Re-enable Desktop DXT (if disabled for this session)

After the GUI session is complete, re-enable Desktop DXT if the user wants it back:

```powershell
$p = "$env:APPDATA\Claude\Claude Extensions Settings\ant.dir.cursortouch.windows-mcp.json"
'{"isEnabled": true}' | Set-Content -Path $p -Encoding utf8
```

## DPI and Coordinate Reference

This machine has a 2-monitor setup at 150% DPI scaling:
- **Display 1 (primary):** 1280×853 logical → 1920×1280 raw; origin (0, 0)
- **Display 2:** 1099×720 logical → 1648×1080 raw; logical offset (1280, −118)

Coordinate conversion: `x_raw = x_logical × 1.5`, `y_raw = (y_logical + 118) × 1.5`

The Stream Deck app typically opens on Display 1. Confirm with a Snapshot before clicking.

## Known Fragile Areas

- **Page navigation in Stream Deck app:** Clicking page tabs is unreliable via SendMessage. If page navigation fails after 2 attempts, read the manifest files from disk instead of continuing GUI attempts.
- **"+" button collision:** The add-page button is near x_client≈375. Scanning or clicking that region accidentally creates a new page. Keep clicks away from the right edge of the page tab bar.
- **Right-click context menus:** Context menus are modal and disappear on focus loss. The subagent must complete the right-click sequence in a single uninterrupted burst of actions.

## Session Resume

If a GUI session was interrupted, check `C:\tmp\session-resume-streamdeck-mcp.md` for in-flight state before starting a new session.
