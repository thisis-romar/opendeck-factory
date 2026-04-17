---
title: Stream Deck Profile Operations
created: 2026-04-16
tags: [moc, stream-deck, index]
---

# Stream Deck Profile Operations

Programmatic tooling for creating and modifying `.streamDeckProfile` files.
**Project:** `C:\Users\romar\projects\stream-deck-profile` (Node.js ESM, `adm-zip` dependency)

---

## Hardware
- [[Stream Deck MK.2]] — Device specs, grid layout, image dimensions

## File Format
- [[streamDeckProfile ZIP Structure]] — ZIP archive layout and contents
- [[Manifest JSON Schema]] — Profile and page manifest structure
- [[Action Definition]] — Hotkey action JSON schema
- [[Image Naming Convention]] — Base32 naming for button icons

## Key Codes & Modifiers
- [[Windows Virtual Key Codes]] — NativeCode values (A=65..Z=90, F1=112..F12=123)
- [[Qt Key Codes]] — QTKeyCode for special keys
- [[Modifier Bitmask]] — Shift=1, Ctrl=2, Alt=4, Win=8

## ProfileEditor API
- [[Loading Profiles]] — `new ProfileEditor(path)`
- [[Querying the Grid]] — `getPageUUIDs()`, `getActions()`, `getEmptyPositions()`
- [[Hotkey Buttons]] — `addHotkeyButton()` with key codes and modifiers
- [[Saving Changes]] — `save()` writes modified manifests

## Patterns
- [[Extract-Modify-Pack Pipeline]] — End-to-end workflow
- [[Batch Add]] — Fill empty grid positions programmatically
- [[Find and Fix]] — Search and update existing buttons

## RAG Integration
- [[Embedding Providers]] — OpenRouter nemotron-embed, GitHub Models, comparison
- [[Chunking and Retrieval]] — How docs are indexed and queried

## Troubleshooting
- [[Common Issues]] — Gotchas, encoding, dimension mismatches
