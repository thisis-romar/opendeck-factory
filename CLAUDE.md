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
- `extract` produces live format; `validate`/`list` accept both live and normalized format

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

## MCP Server

`src/mcp-server.js` — 7 tools: `extract_profile`, `pack_profile`, `validate_profile`, `list_profile`, `add_shortcut`, `generate_icons`, `list_shortcuts`.

**Claude Desktop config** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "opendeck": {
      "command": "node",
      "args": ["C:/Users/romar/projects/opendeck/opendeck-factory/src/mcp-server.js"]
    }
  }
}
```

## Claude Code Plugin

`.claude-plugin/plugin.json` — bundles MCP server + skills for Claude Code plugin marketplace distribution.

## Frontmatter Timestamps

When writing or editing any `.md` file with YAML frontmatter, call `get_current_time` first and use the returned `datetime` value for the `lastmod` field. Set `created` only on first creation; never modify it afterward. Fallback: `date -u +%Y-%m-%dT%H:%M:%SZ`.

Files that carry frontmatter in this repo: `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `.claude/skills/<name>/SKILL.md`.
