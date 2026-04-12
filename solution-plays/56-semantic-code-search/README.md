# Play 56 — Semantic Code Search

Vector-based code search engine — AST-aware function parsing (tree-sitter), multi-field embedding (signature + docstring + body), hybrid keyword+vector search with boost weights, semantic reranking, incremental re-indexing on git push, natural language→code queries, cross-repo search with access control.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Code Embeddings | Azure OpenAI (text-embedding-3-large) | Function-level vector embeddings |
| Search Index | Azure AI Search | Hybrid keyword + vector search |
| Code Parser | tree-sitter (local) | AST-aware function/class extraction |
| Search API | Azure Container Apps | Query endpoint with filters |
| Webhook | GitHub Webhooks | Incremental re-index on push |
| Secrets | Azure Key Vault | API keys |

## How It Differs from Related Plays

| Aspect | Play 26 (Semantic Search) | **Play 56 (Code Search)** | Play 01 (Enterprise RAG) |
|--------|--------------------------|--------------------------|--------------------------|
| Content | General documents | **Source code specifically** | Corporate knowledge |
| Parsing | Text chunking | **AST-aware function extraction** | Semantic chunking |
| Embedding | Document vectors | **Signature + docstring + body vectors** | Document vectors |
| Query | NL → document | **NL → code snippet** | NL → knowledge |
| Freshness | Batch re-index | **Git push webhook (<60s)** | Scheduled re-index |
| Access | User auth | **Repo-level permissions** | Doc-level ACL |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| NDCG@5 | > 0.75 | Normalized Discounted Cumulative Gain |
| Recall@10 | > 85% | Relevant results in top 10 |
| P95 Latency | < 300ms | Search response time |
| Index Freshness | < 60s | Push to searchable |
| Access Control | 100% | No unauthorized repo access |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Security** | Repo-level access control, permission caching, Key Vault |
| **Performance Efficiency** | HNSW vector index, hybrid search, semantic reranking |
| **Cost Optimization** | Incremental indexing (changed files only), embedding model choice |
| **Reliability** | Webhook retry on failure, weekly full reindex backup |
| **Operational Excellence** | NDCG tracking, latency monitoring, index health dashboard |
| **Responsible AI** | Access control prevents code leakage, no PII in code index |
