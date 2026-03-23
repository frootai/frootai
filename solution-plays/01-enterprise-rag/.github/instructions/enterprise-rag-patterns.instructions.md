# RAG Architecture Patterns

> Layer 1 — Always-On Context. RAG-specific coding rules for this solution play.

## Chunking Rules
- Use semantic chunking (not fixed-size) — respect paragraph and section boundaries
- Target 512 tokens per chunk with 10% overlap (see config/chunking.json)
- Preserve document metadata in every chunk: source, page, section, timestamp
- Strip headers/footers/boilerplate before chunking

## Retrieval Rules
- Always use hybrid search (vector 60% + keyword 40%) — see config/search.json
- Apply semantic reranker as second pass on top-k=5 results
- Set minimum relevance score threshold (0.78) — do NOT return low-confidence chunks
- Include source citations in every response

## Prompt Construction
- System message defines persona + guardrails (from agent.md)
- User context = retrieved chunks (max 3,000 tokens) + user question
- Use structured JSON output schema (from config/openai.json)
- Temperature = 0.1 for factual accuracy (never > 0.3 for RAG)

## Grounding & Anti-Hallucination
- If no relevant chunks found, respond: "I don't have enough information to answer this"
- Never fabricate references or citations
- Always cite which chunk/document the answer came from
- Use Azure OpenAI Content Safety for all inputs and outputs

## Evaluation
- Track: groundedness (>0.95), relevance (>0.90), fluency (>0.85)
- Run evaluation suite on every PR (see evaluation/eval.py)
- Test with adversarial inputs: off-topic, toxic, injection attempts
