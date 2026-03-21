# Changelog — Enterprise RAG Solution Play

## v0.1.0 (March 2026)
- Initial skeleton with full directory structure
- agent.md with production rules + 3 few-shot examples
- instructions.md with system prompt + guardrails
- config/openai.json (temp=0.1, seed=42, JSON schema)
- config/search.json (hybrid 60/40, top-k=5, semantic reranker)
- config/chunking.json (512 tokens, semantic, 10% overlap)
- config/guardrails.json (content safety, PII, prompt injection)
- .github/copilot-instructions.md for developer playground
- .vscode/mcp.json + settings.json for IDE integration
- evaluation/test-set.jsonl (sample test set)
- evaluation/eval.py (skeleton)
- infra/main.bicep (skeleton)
- mcp/index.js (skeleton)
- plugins/README.md (specification)
