---
title: Manifest JSON Schema
created: 2026-04-16
tags: [file-format, manifest, schema]
---

# Manifest JSON Schema

## Profile Manifest (`Profiles/{UUID}.sdProfile/manifest.json`)

```json
{
  "Name": "VS Code",
  "Version": "3.0",
  "Device": {
    "Model": "20GBA9901",
    "Name": "Stream Deck MK.2",
    "Size": { "Columns": 5, "Rows": 3 }
  },
  "Pages": ["page-uuid-1", "page-uuid-2"]
}
```

- `Version` must be `"3.0"` for Stream Deck app 7.1+
- `Pages` array defines page order

## Page Manifest (`Profiles/{PageUUID}/manifest.json`)

```json
{
  "Controllers": [{
    "Actions": {
      "0,0": { /* action definition */ },
      "1,1": { /* action definition */ },
      "4,2": { /* action definition */ }
    }
  }]
}
```

- Positions are `"col,row"` strings — **column first**, 0-indexed
- Empty pages (no Actions) are valid
- Action positions must be within grid bounds (col < 5, row < 3 for MK.2)

See also: [[Action Definition]], [[Stream Deck MK.2]]
