# VS Code Keyboard Shortcuts Report

Generated: 2026-04-17
VS Code version: 1.99 (defaults reference)

## 1. Custom Keybindings (keybindings.json)

Source: `C:\Users\romar\AppData\Roaming\Code\User\keybindings.json`

| Shortcut | Action | Context |
|----------|--------|---------|
| Ctrl+Enter | Send `\` + newline to terminal | terminalFocus |
| Shift+Enter | Send `\` + newline to terminal | terminalFocus |

No conflicts with Stream Deck profile shortcuts.

## 2. Stream Deck Profile Shortcuts (data/shortcuts/vs-code.json)

45 single-keypress shortcuts across 6 categories. All verified against VS Code 1.99 defaults.

### General (6)

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+P | Command Palette |
| Ctrl+P | Quick Open |
| Ctrl+` | Terminal |
| Ctrl+, | Settings |
| F11 | Full Screen |
| Ctrl+Shift+B | Run Build |

### Navigation (8)

| Shortcut | Action |
|----------|--------|
| Ctrl+G | Go To Line |
| F12 | Go To Definition |
| Ctrl+Shift+O | Go To Symbol |
| F8 | Next Error |
| Alt+- | Go Back |
| Shift+Alt+= | Go Forward |
| Alt+F12 | Peek Definition |
| Ctrl+Space | Trigger Suggest |

### View (10)

| Shortcut | Action |
|----------|--------|
| Ctrl+B | Primary Sidebar |
| Ctrl+J | Panel |
| Ctrl+Shift+E | Explorer |
| Ctrl+Shift+F | Search |
| Ctrl+Alt+B | Secondary Sidebar |
| Ctrl+Shift+X | Extensions |
| Ctrl+Shift+D | Run & Debug |
| Ctrl+Shift+G | Source Control |
| Ctrl+= | Zoom In |
| Ctrl+- | Zoom Out |

### Editing (13)

| Shortcut | Action |
|----------|--------|
| Shift+Alt+F | Format Doc |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Alt+Z | Word Wrap |
| Ctrl+/ | Toggle Comment |
| Ctrl+] | Indent |
| Ctrl+[ | Outdent |
| Ctrl+X | Cut Line |
| Shift+Alt+Down | Copy Line Down |
| Alt+Down | Move Line Down |
| Alt+Up | Move Line Up |
| Ctrl+A | Select All |
| Ctrl+D | Select Next Match |

### Debug (7)

| Shortcut | Action |
|----------|--------|
| F5 | Start Debug |
| Shift+F5 | Stop Debug |
| F10 | Step Over |
| F11 | Step Into |
| Shift+F11 | Step Out |
| F9 | Toggle Breakpoint |
| F5 | Continue |

### Terminal (1)

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+` | New Terminal |

## 3. VS Code Defaults NOT in Stream Deck Profile

Notable single-keypress defaults omitted from the profile (candidates for future addition):

### Search & Replace

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Find |
| Ctrl+H | Replace |
| Ctrl+Shift+H | Replace in Files |

### File Management

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save |
| Ctrl+N | New File |
| Ctrl+Shift+S | Save As |
| Ctrl+Shift+T | Reopen Closed Editor |

### Editing

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+K | Delete Line |
| Ctrl+L | Select Line |
| Ctrl+Shift+L | Select All Occurrences |
| F2 | Rename Symbol |
| Ctrl+. | Quick Fix |
| Ctrl+Enter | Insert Line Below |
| Ctrl+Shift+Enter | Insert Line Above |
| Ctrl+U | Undo Last Cursor |
| Ctrl+F2 | Change All Occurrences |
| Ctrl+Shift+\ | Jump to Matching Bracket |
| Ctrl+Shift+A | Toggle Block Comment |
| Shift+Alt+I | Insert Cursor at End of Each Line |
| Ctrl+Alt+Down | Insert Cursor Below |
| Ctrl+Alt+Up | Insert Cursor Above |

### Editor Management

| Shortcut | Action |
|----------|--------|
| Ctrl+\ | Split Editor |
| Ctrl+1/2/3 | Focus Editor Group |
| Ctrl+F4 | Close Editor |
| Ctrl+Shift+N | New Window |

### Display

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+U | Show Output |
| Ctrl+Shift+M | Show Problems |

### Debug

| Shortcut | Action |
|----------|--------|
| Ctrl+F5 | Start Without Debugging |
| F6 | Pause |

### Chord-based (unsupported by Stream Deck hotkey action)

> **Note:** Chord shortcuts require two sequential keypresses (e.g., Ctrl+K *then* Ctrl+M).
> The Stream Deck `com.elgato.streamdeck.system.hotkey` action only supports single-keypress
> hotkeys, so these cannot be assigned directly. To use them, rebind to a single-keypress
> shortcut in VS Code's keybindings.json or invoke via Command Palette (Ctrl+Shift+P).

| Shortcut | Action |
|----------|--------|
| Ctrl+K Ctrl+M | Toggle Maximize Editor Group |
| Ctrl+K Ctrl+F | Format Selection |
| Ctrl+K F12 | Open Definition to Side |
| Ctrl+K Z | Zen Mode |
| Ctrl+K Ctrl+I | Show Hover |
| Ctrl+K M | Change Language Mode |
| Ctrl+K F | Close Folder |
| Ctrl+K P | Copy Path of Active File |

## 4. Sources

| Source | Location |
|--------|----------|
| VS Code Default Keybindings Reference | https://code.visualstudio.com/docs/reference/default-keybindings |
| VS Code Keyboard Shortcuts PDF (Windows) | https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf |
| VS Code Keybindings Documentation | https://code.visualstudio.com/docs/configure/keybindings |
| User Custom Keybindings | `C:\Users\romar\AppData\Roaming\Code\User\keybindings.json` |
| Curated Stream Deck Shortcut Data | `data/shortcuts/vs-code.json` |
