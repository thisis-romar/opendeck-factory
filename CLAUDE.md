# OpenDeck Factory

Open-source engine for programmatically extracting, modifying, and repacking Elgato Stream Deck `.streamDeckProfile` files.

## Architecture

Node.js ESM project using `adm-zip` for ZIP handling.

| Directory | Purpose |
|-----------|---------|
| `src/` | Core modules: ProfileEditor, hotkey builder, extract/pack/validate |
| `scripts/` | Main generation scripts + one-off utilities (see `scripts/README.md`) |
| `profiles/` | Extracted profile directories (editable JSON + images) |
| `profiles/_template/` | Template profile cloned by `initFromTemplate()` for new apps |
| `docs/obsidian-vault/` | Technical documentation (file format, API, patterns) |
| `.claude/skills/` | Claude Code skill definitions (e.g. `generate-profile`) |

## Commands

```bash
node src/index.js extract <profile> <outdir>   # Unzip to editable directory
node src/index.js pack <dir> <output>           # Pack directory to .streamDeckProfile
node src/index.js validate <dir>                # Validate extracted structure
node src/index.js list <dir>                    # Show grid layout
```

## Key Constraints

- All keys must exist in `src/constants.js` KEY_CODES
- Multi-action buttons supported for chord shortcuts (Ctrl+K Ctrl+C)
- Positions are `"col,row"` (column-first, 0-indexed)
- Labels must end with `\n` — use `\n` for line breaks (max 3 lines)
- Images are 144x144 pixels (retina @2x for 72x72 buttons)
- Always validate before packing

## Safety

- Always run `validate` before `pack`
- Profile version must be `"3.0"` for Stream Deck app 7.1+
- Commercial assets (profiles, icons, shortcuts, builds) belong in the private catalog repo, not here

## License

Functional Source License, Version 1.1 (FSL-1.1-ALv2). Source-available;
auto-converts to Apache 2.0 two years after each release. See LICENSE and NOTICE.

## Skills

- Profile generation workflow: `.claude/skills/generate-profile/SKILL.md`
- Capture reference profile (all action types): `.claude/skills/capture-streamdeck-reference/SKILL.md`
- Drive Windows GUI (Stream Deck app): `.claude/skills/drive-windows-gui/SKILL.md`

## Computer-Use Integration (this branch only — `feat/windows-mcp-computer-use`)

This branch adds opt-in integration with [Windows-MCP](https://github.com/CursorTouch/Windows-MCP) for driving the Stream Deck Windows app GUI when JSON injection is insufficient.

**Surface:**
- `.mcp.json` — project-scoped Windows-MCP registration (loads on next session start; approve when prompted)
- `.claude/agents/streamdeck-driver.md` — narrow-surface subagent (Windows-MCP tools + Read only; no Bash/Edit/Write)

**JSON-injection-first principle.** GUI driving costs one model decision per click (~2 min/action observed in prior runs). Always prefer writing directly to `%APPDATA%\Elgato\StreamDeck\ProfilesV3\<uuid>.sdProfile\Profiles\<page-uuid>\manifest.json` when the action's schema is known. Use the subagent only for irreducibly-GUI parts (Pin gesture, Wallpaper, Multi Action display capture, Export dialog).

**Concurrency safety.** If Claude Desktop has the Windows-MCP DXT installed, **disable it** before driving the GUI from Code — two clients sharing the OS input queue race with no coordination primitive available. Toggle via:
```
%APPDATA%\Claude\Claude Extensions Settings\ant.dir.cursortouch.windows-mcp.json → {"isEnabled": false}
```

**Pre-flight before any GUI session:**
1. `Get-Process StreamDeck` confirms app running
2. `/mcp` confirms `windows-mcp ✓ connected`
3. The Desktop DXT JSON above shows `isEnabled: false`

**If session resumes after `claude -c`:** check `C:\tmp\session-resume-streamdeck-mcp.md` for in-flight workflow state.
