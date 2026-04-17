---
title: Common Issues
created: 2026-04-16
tags: [troubleshooting, gotchas]
---

# Common Issues & Gotchas

## File Format

1. **Positions are `"col,row"` strings** — column first, 0-indexed
2. **Titles end with `\n`** — always append a trailing newline
3. **Icons are 144x144** — despite official 72x72 spec (app uses @2x)
4. **4-slot Hotkeys array** — only slot 0 is active, slots 1-3 must be empty sentinel
5. **No chord shortcuts** — single keypress only per button
6. **Profile version `"3.0"`** — required for Stream Deck app 7.1+
7. **ZIP uses forward slashes** — even on Windows
8. **Empty pages are normal** — Controllers with no Actions is valid

## Embedding Issues

- **Dimension mismatch**: Never mix embedding models (1536-dim vs 2048-dim vectors are incompatible)
- **Daily quota**: GitHub Models free tier caps at ~150 batches/day; use OpenRouter for larger jobs
- **FTS5 trigger bug**: The `chunks_fts_update` trigger causes SQL errors during UPDATE-only operations; upgrade script drops/recreates it
- **Network errors**: `httpx.RemoteProtocolError` on long embedding runs; retry logic handles this

## Environment

- **`.env` auto-loading**: Both `rag_ingest_web.py` and `rag_upgrade_embeddings.py` auto-load `.env`
- **Unicode on Windows**: Set `PYTHONIOENCODING=utf-8` for emoji-containing content

See also: [[Embedding Providers]], [[Stream Deck MK.2]]
