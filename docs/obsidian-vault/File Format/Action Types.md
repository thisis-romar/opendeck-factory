---
title: Action Types
created: 2026-04-17
updated: 2026-04-21
tags: [file-format, actions, multi-action, reference]
---

# Stream Deck Action Types

All action definitions verified against live `.streamDeckProfile` files and `expand-reference-profile.js`. See `originals/reference-all-actions.streamDeckProfile` in the catalog repo for the ground-truth corpus.

Each action entry in a page manifest has this envelope:

```json
{
  "ActionID": "<random-uuid-v4>",
  "LinkedTitle": true,
  "Name": "<display name>",
  "Plugin": { "Name": "<plugin name>", "UUID": "<plugin-uuid>", "Version": "1.0" },
  "Settings": { ... },
  "State": 0,
  "States": [{ "Image": "Images/<file>", "Title": "Label\n" }],
  "UUID": "<action-uuid>"
}
```

---

## System Actions

Plugin namespace: `com.elgato.streamdeck.system`

### Hotkey

Single keypress with optional modifiers. The core engine action.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.hotkey` |
| Plugin UUID | `com.elgato.streamdeck.system.hotkey` |
| Plugin Name | `Activate a Key Command` |

See [[Action Definition]] for the full `Settings.Hotkeys` schema.

### Hotkey Switch

Toggles between two hotkeys on successive presses.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.hotkeyswitch` |
| Plugin UUID | `com.elgato.streamdeck.system.hotkeyswitch` |

### Open / Run

Launch an application or file.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.open` |
| Plugin UUID | `com.elgato.streamdeck.system.open` |
| Plugin Name | `Open` |

Settings:
```json
{ "path": "C:\\Windows\\System32\\notepad.exe" }
```

### Open Application

Launch an application by bundle/exec path.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.openapp` |
| Plugin UUID | `com.elgato.streamdeck.system.openapp` |

Settings:
```json
{
  "app_name": "",
  "args": "",
  "bring_to_front": true,
  "bundle_id": "",
  "bundle_path": "",
  "exec": "",
  "is_bundle": false,
  "long_press": "quit",
  "source": ""
}
```

### Website / Open URL

Open a URL in the default browser.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.webpage` |
| Plugin UUID | `com.elgato.streamdeck.system.webpage` |
| Plugin Name | `Website` |

Settings:
```json
{ "url": "https://example.com" }
```

> Note: The UUID is `webpage`, not `website`.

### Text

Type a text string via keyboard injection.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.text` |
| Plugin UUID | `com.elgato.streamdeck.system.text` |

Settings:
```json
{ "text": "Hello world", "paste": false }
```

### Media Play/Pause

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.mediaplayback` |
| Plugin UUID | `com.elgato.streamdeck.system.mediaplayback` |

> Note: The UUID is `mediaplayback`, not `multimedia`.

### Mute Microphone

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.system.audioinputmute` |
| Plugin UUID | `com.elgato.streamdeck.system.audioinputmute` |

---

## Navigation Actions

Plugin namespace: `com.elgato.streamdeck.profiles` / `com.elgato.streamdeck.profile`

### Next Page

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profiles.nextpage` |
| Plugin UUID | `com.elgato.streamdeck.profiles.nextpage` |

### Previous Page

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profiles.previouspage` |
| Plugin UUID | `com.elgato.streamdeck.profiles.previouspage` |

### Go to Page

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profiles.page` |
| Plugin UUID | `com.elgato.streamdeck.profiles.page` |

Settings:
```json
{ "page": 0 }
```

### Switch Profile

Switch to a named profile.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profile.rotate` |
| Plugin UUID | `com.elgato.streamdeck.profile.rotate` |

### Open Folder (Child Profile)

Open a sub-profile folder.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profile.openchild` |
| Plugin UUID | `com.elgato.streamdeck.profile.openchild` |

### Back to Parent

Return from a sub-profile folder to its parent.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.profile.backtoparent` |
| Plugin UUID | `com.elgato.streamdeck.profile.backtoparent` |

---

## Multi-Action Actions

Plugin namespace: `com.elgato.streamdeck.multiactions`

All multi-action variants share the same **Plugin UUID** (`com.elgato.streamdeck.multiactions`) but have distinct **action UUIDs**.

### Multi Action (Routine)

Chains multiple actions sequentially on a single button press. Used for chord shortcuts (e.g., Ctrl+K then Ctrl+M).

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.multiactions.routine` |
| Plugin UUID | `com.elgato.streamdeck.multiactions` |
| Plugin Name | `Multi Action` |

Settings:
```json
{ "Actions": [ /* array of sub-action definitions */ ] }
```

> Note: The engine's `ProfileEditor.addMultiActionButton()` uses `com.elgato.streamdeck.system.multiaction` — a different UUID variant. Both appear valid; `system.multiaction` is the legacy/core form.

### Multi Action (Random)

Picks a random action from the list on each press.

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.multiactions.random` |
| Plugin UUID | `com.elgato.streamdeck.multiactions` |

### Delay

Insert a time delay (used inside Multi Action sequences).

| Field | Value |
|-------|-------|
| UUID | `com.elgato.streamdeck.multiactions.delay` |
| Plugin UUID | `com.elgato.streamdeck.multiactions` |

Settings:
```json
{ "duration": 1000 }
```

---

## Action UUID Quick Reference

| UUID | Description |
|------|-------------|
| `com.elgato.streamdeck.system.hotkey` | Single keypress |
| `com.elgato.streamdeck.system.hotkeyswitch` | Toggle between two hotkeys |
| `com.elgato.streamdeck.system.open` | Open app/file |
| `com.elgato.streamdeck.system.openapp` | Open app (bundle path) |
| `com.elgato.streamdeck.system.webpage` | Open URL |
| `com.elgato.streamdeck.system.text` | Type text |
| `com.elgato.streamdeck.system.mediaplayback` | Media play/pause |
| `com.elgato.streamdeck.system.audioinputmute` | Mute microphone |
| `com.elgato.streamdeck.profiles.nextpage` | Next page |
| `com.elgato.streamdeck.profiles.previouspage` | Previous page |
| `com.elgato.streamdeck.profiles.page` | Go to specific page |
| `com.elgato.streamdeck.profile.rotate` | Switch profile |
| `com.elgato.streamdeck.profile.openchild` | Open folder (child profile) |
| `com.elgato.streamdeck.profile.backtoparent` | Back to parent |
| `com.elgato.streamdeck.multiactions.routine` | Multi-action sequence |
| `com.elgato.streamdeck.multiactions.random` | Random action |
| `com.elgato.streamdeck.multiactions.delay` | Delay step |
| `com.elgato.streamdeck.system.multiaction` | Multi-action (legacy/core engine form) |

See also: [[Action Definition]], [[Hotkey Buttons]]

## Sources

- `originals/reference-all-actions.streamDeckProfile` — verified ground-truth profiles
- `scripts/expand-reference-profile.js` — authoritative action UUID and settings inventory
- [Elgato Stream Deck SDK Profiles Guide](https://docs.elgato.com/streamdeck/sdk/guides/profiles/)
- [Elgato Schemas (GitHub)](https://github.com/elgatosf/schemas)
