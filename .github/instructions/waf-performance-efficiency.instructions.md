---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
---
# Performance Efficiency — Azure Well-Architected Framework

When implementing or reviewing code, enforce these performance principles:

## AI Response Performance
- Target: < 3s for simple queries, < 10s for complex multi-step reasoning
- Use streaming responses for AI chat interfaces
- Implement response caching for repeated queries (semantic similarity > 0.95)
- Use Azure AI Search semantic ranker for faster, more relevant retrieval

## Caching Strategy
- Cache knowledge.json in memory (682KB — fits easily)
- Cache AI Search results with 5-minute TTL
- Cache Azure pricing data with 1-hour TTL
- Use CDN for static website assets (GitHub Pages handles this)

## Async & Parallel
- Use async/await for all I/O operations
- Parallelize independent AI calls (e.g., search + glossary lookup)
- Use streaming for MCP tool responses where supported
- Queue long-running operations (batch evaluations, knowledge rebuilds)

## Bundle & Payload
- MCP server: single index.js + knowledge.json (minimal cold start)
- Website: code-split pages, lazy-load heavy components
- Docker image: multi-stage build, minimize layers
- API responses: paginate large result sets, compress with gzip

## Database & Search
- Use appropriate indexing strategies for Azure AI Search
- Configure semantic configuration for natural language queries
- Set top_k appropriately (5-10 for most RAG scenarios)
- Use hybrid search (keyword + vector) for best accuracy-speed tradeoff
