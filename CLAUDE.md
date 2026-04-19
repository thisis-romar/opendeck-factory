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

Apache License, Version 2.0. See LICENSE and NOTICE.

## Skills

- Profile generation workflow: `.claude/skills/generate-profile/SKILL.md`
