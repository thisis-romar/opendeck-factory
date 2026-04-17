---
title: streamDeckProfile ZIP Structure
created: 2026-04-16
tags: [file-format, zip, structure]
---

# .streamDeckProfile File Format

A `.streamDeckProfile` file is a **ZIP archive** (DEFLATE compression) containing:

```
package.json                                    # App metadata
Profiles/{ProfileUUID}.sdProfile/
  manifest.json                                 # Profile: Name, Pages[], Device, Version "3.0"
  Profiles/{PageUUID}/
    manifest.json                               # Page: Controllers[0].Actions{"col,row": actionDef}
    Images/{Base32x26}Z.png                     # 144x144 button icons
```

## package.json

```json
{
  "AppVersion": "7.1.0",
  "DeviceModel": "20GBA9901",
  "Name": "VS Code",
  "Version": "1.0"
}
```

## Profile manifest.json

Contains `Name`, `Pages[]` (array of page UUIDs), `Device` info, `Version` (must be `"3.0"` for Stream Deck app 7.1+).

## Page manifest.json

Contains `Controllers` array. `Controllers[0].Actions` is an object keyed by `"col,row"` strings (0-indexed, column first).

See also: [[Action Definition]], [[Manifest JSON Schema]], [[Image Naming Convention]]
