---
title: Embedding Providers
created: 2026-04-16
tags: [rag, embeddings, providers]
---

# Embedding Providers

The RAG pipeline supports multiple embedding providers for vector search over indexed documentation.

## Current Provider: OpenRouter (nemotron-embed)

| Property | Value |
|----------|-------|
| **Model** | `nvidia/llama-nemotron-embed-vl-1b-v2:free` |
| **Dimensions** | 2048 |
| **Tier** | Free |
| **Rate Limit** | ~200 req/min |
| **Daily Quota** | Very generous (no wall hit at 10K chunks) |

## Previous: GitHub Models (text-embedding-3-small)

| Property | Value |
|----------|-------|
| **Model** | `openai/text-embedding-3-small` |
| **Dimensions** | 1536 |
| **Tier** | Free (GitHub PAT with models:read) |
| **Daily Quota** | ~150 batches/day (hit at ~5,500 chunks) |

## Important: Vector Space Compatibility

**Never mix embedding models in the same store.** Different models produce vectors in incompatible spaces — similarity scores become meaningless. When switching models, use `--re-embed-all` to re-embed everything.

## Available: Gemini (gemini-embedding-001)

| Property | Value |
|----------|-------|
| **Model** | `gemini-embedding-001` |
| **Dimensions** | 3072 |
| **MTEB** | 68.32 (#1 on leaderboard) |
| **Tier** | Free (Google AI Studio) |
| **Daily Quota** | ~1,300 chunks/day (very restrictive) |
| **Asymmetric** | Yes (`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`) |

Best quality but free tier daily quota makes bulk re-embedding impractical. Consider GCP $300 free trial for Vertex AI endpoint (no daily cap, costs $0.15 for 10K chunks).

## Available: Voyage AI (voyage-4)

| Property | Value |
|----------|-------|
| **Model** | `voyage-4` |
| **Dimensions** | 1024 (supports 256/512/1024/2048) |
| **MTEB** | ~67 |
| **Tier** | Free (200M tokens one-time) |
| **Rate Limit** | 3 RPM / 10K TPM without payment method; 2,000 RPM / 8M TPM with |
| **Asymmetric** | Yes (`document` / `query`) |

Excellent free allocation (200M tokens, we need ~1M). Requires payment method on file to unlock usable rate limits — still uses free tokens, no charges.

## Upgrade Path

Add payment method to Voyage AI dashboard → re-embed in ~2 min:
```bash
uv run python scripts/rag_upgrade_embeddings.py --provider voyage --re-embed-all --embed-delay 1 --embed-batch-size 128
```

## Current Store Status (2026-04-16)

- **10,587 chunks**, all using `nemotron-embed` (2048 dims)
- Zero-vector chunks: 0 (100% real embeddings)
- 5 providers in codebase: ZeroVector, GitHubModels, OpenRouter, Gemini, Voyage

See also: [[Chunking and Retrieval]]
