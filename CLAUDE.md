# stream-deck-profile

Programmatically extract, modify, and repack Elgato Stream Deck `.streamDeckProfile` files.

## Architecture

Node.js ESM project using `adm-zip` for ZIP handling.

| Directory | Purpose |
|-----------|---------|
| `src/` | Core modules: ProfileEditor, hotkey builder, extract/pack/validate |
| `scripts/` | Automation scripts (batch add, generation, fixes) |
| `profiles/` | Extracted profile directories (editable JSON + images) |
| `data/shortcuts/` | Structured shortcut data per application (JSON) |
| `builds/` | Output `.streamDeckProfile` files (ZIP) |
| `originals/` | Pristine backup profiles — **never overwrite** |
| `docs/obsidian-vault/` | Technical documentation (file format, API, patterns) |

## Commands

```bash
node src/index.js extract <profile> <outdir>   # Unzip to editable directory
node src/index.js pack <dir> <output>           # Pack directory to .streamDeckProfile
node src/index.js validate <dir>                # Validate extracted structure
node src/index.js list <dir>                    # Show grid layout
```

## Key Constraints

- **Single-keypress hotkeys only** — no chord shortcuts (Ctrl+K Ctrl+C)
- All keys must exist in `src/constants.js` KEY_CODES
- Positions are `"col,row"` (column-first, 0-indexed)
- Labels must end with `\n` — use `\n` for line breaks (max 3 lines)
- Images are 144x144 pixels (retina @2x for 72x72 buttons)
- Always validate before packing

## Safety

- Never overwrite files in `originals/`
- Always run `validate` before `pack`
- Profile version must be `"3.0"` for Stream Deck app 7.1+

## Skills

- Profile generation workflow: `.claude/skills/generate-profile/SKILL.md`
