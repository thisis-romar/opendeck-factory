---
title: Chunking and Retrieval
created: 2026-04-16
tags: [rag, chunking, retrieval]
---

# Chunking and Retrieval

## Chunking Strategy

- **Markdown:** Heading-based splitting (ideal for structured docs)
- **Python:** AST-aware chunking
- **Plain text:** Line-based fallback
- **Max tokens:** 1200 per chunk, 20-line overlap
- **Merge:** Tiny consecutive sections merged (200-2000 chars)

## RAG Store Contents

| Source | Chunks | Ref |
|--------|--------|-----|
| MA2 help docs | 4,822 | `ma2-help-docs` |
| Worktree | 4,214 | `worktree` |
| Skills (35 SKILL.md) | 557 | `skills` |
| Stream Deck MK.2 docs | 486 | `streamdeck-mk2-docs` |
| MCP SDK | 457 | `mcp-sdk` |
| MA2 Lua API | 51 | `ma2-lua-api` |

## Querying

```bash
# Vector similarity + FTS5 keyword search
uv run python scripts/rag_query.py --query "Stream Deck button resolution" --ref "streamdeck-mk2-docs"
```

- Filterable by `repo_ref` and `kind`
- Reranking with keyword overlap scoring
- FTS5 keyword search works even without embeddings

See also: [[Embedding Providers]]
