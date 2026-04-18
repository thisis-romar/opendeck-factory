---
title: Action Types
created: 2026-04-17
tags: [file-format, actions, multi-action]
---

# Stream Deck Action Types

All built-in actions use the `com.elgato.streamdeck.system` UUID namespace.

## Hotkey

Single keypress with optional modifiers.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.hotkey` |
| Plugin Name | Activate a Key Command |

See: [[Action Definition]]

## Multi Action

Chains multiple actions sequentially on a single button press. Used for VS Code chord shortcuts (e.g., Ctrl+K Ctrl+M).

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.multiaction` |
| Plugin Name | Multi Action |

```json
{
  "Name": "Multi Action",
  "Plugin": {
    "Name": "Multi Action",
    "UUID": "com.elgato.streamdeck.system.multiaction",
    "Version": "1.0"
  },
  "Settings": {
    "Actions": [
      { /* hotkey sub-action 1 */ },
      { /* hotkey sub-action 2 */ }
    ]
  }
}
```

Each sub-action is a full action definition (same structure as a standalone hotkey). Stream Deck executes them top-to-bottom with configurable delays (2-100ms, default ~50ms).

## Other System Actions (not yet implemented in tooling)

| Action | UUID | Purpose |
|--------|------|---------|
| Open | `com.elgato.streamdeck.system.open` | Launch app/URL |
| Website | `com.elgato.streamdeck.system.website` | Open website |
| Multimedia | `com.elgato.streamdeck.system.multimedia` | Media controls |
| Text | `com.elgato.streamdeck.system.text` | Type text string |
| Switch Hotkey | `com.elgato.streamdeck.system.hotkey.switch` | Toggle between hotkeys |

## Navigation Actions

| Action | Purpose |
|--------|---------|
| Go to Page | Navigate to a specific page |
| Next Page | Navigate to next page |
| Previous Page | Navigate to previous page |
| Create Folder | Create a button folder (sub-menu) |

## Sources

- [Elgato Stream Deck — Multi Actions](https://help.elgato.com/hc/en-us/articles/360027960912)
- [Elgato Stream Deck — System Actions](https://help.elgato.com/hc/en-us/articles/360028234471)
- [Stream Deck SDK — Profiles Guide](https://docs.elgato.com/streamdeck/sdk/guides/profiles/)
- [Elgato Schemas (GitHub)](https://github.com/elgatosf/schemas)

See also: [[Action Definition]], [[Hotkey Buttons]]
