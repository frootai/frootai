---
description: "Semantic Code Search domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Semantic Code Search — Domain Knowledge

This workspace implements semantic code search — vector-based code understanding, natural language code queries, cross-repository search, and code snippet ranking using embeddings and AST analysis.

## Code Search Architecture (What the Model Gets Wrong)

### Code Embedding Strategy
```python
# WRONG — embed raw code as plain text (loses structure)
embedding = embed("def calculate_tax(amount, rate): return amount * rate")

# CORRECT — embed with context: docstring + signature + body separately
code_embedding = {
    "signature": embed("calculate_tax(amount: float, rate: float) -> float"),
    "docstring": embed("Calculate tax amount given base amount and tax rate"),
    "body": embed(function_body),
    "combined": embed(f"{docstring}\n{signature}\n{body}"),  # For hybrid search
}
```

### Natural Language → Code Query
```python
# User asks: "How do I handle authentication errors?"
# Search pipeline:
# 1. Embed the NL query
# 2. Search code embeddings (catches: try/except auth patterns)
# 3. Search docstring embeddings (catches: "authentication error handling")
# 4. Merge + rank by combined score
results = hybrid_code_search(
    query="How do I handle authentication errors?",
    search_fields=["docstring_vector", "code_vector", "comment_vector"],
    boost_weights={"docstring": 3, "code": 1, "comment": 2},
)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Embed entire files | Too large, meaning diluted | Embed per function/class, not per file |
| Plain text embedding for code | Loses AST structure (indentation, nesting) | Use code-specific embeddings (CodeBERT, StarCoder) |
| No docstring/comment indexing | NL queries can't match code patterns | Index docstrings and comments separately |
| Exact match only | Misses semantic similarity | Hybrid: keyword (function names) + vector (meaning) |
| No language detection | Wrong parser applied | Detect language, use language-specific AST parser |
| Stale index | New code not searchable | Webhook on push → re-index changed files only |
| No access control | Search exposes private repos | Filter results by user's repo permissions |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Embedding model (text-embedding-3-large vs code-specific) |
| `config/search.json` | Boost weights, top_k, score threshold |
| `config/guardrails.json` | Access control rules, index refresh rate |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement code indexing, embedding pipeline, search API |
| `@reviewer` | Audit search relevance, access control, index freshness |
| `@tuner` | Optimize embedding model, boost weights, query rewriting |

## Slash Commands
`/deploy` — Deploy search engine | `/test` — Test search quality | `/review` — Audit access | `/evaluate` — Measure NDCG + recall
