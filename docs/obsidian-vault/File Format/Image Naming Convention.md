---
title: Image Naming Convention
created: 2026-04-16
tags: [file-format, images, base32]
---

# Image Naming Convention

Button icons are stored in `Images/` subdirectories within each page folder.

## Naming Pattern

26 random characters from the **Base32 RFC 4648** alphabet + `Z` + file extension:

```
ABCDEFGHIJKLMNOPQRSTUVWXYZ234567  (Base32 alphabet)
```

Example: `Images/QWERTYUIOPASDFGHJKLZXCVBNWZ.png`

## Implementation

`src/images.js` provides:
- `generateFilename(ext)` — creates a random Base32 filename
- `addImage(pageDir, srcPath)` — copies source image to `Images/` with generated name, returns relative path

## Specifications

- **Dimensions:** 144x144 pixels (despite official 72x72 spec — app uses @2x retina)
- **Format:** PNG recommended
- **Location:** `Profiles/{PageUUID}/Images/`

See also: [[Stream Deck MK.2]], [[streamDeckProfile ZIP Structure]]
