---
description: "Play 21 patterns — Agentic RAG patterns — retrieval decision loop, multi-source routing, query refinement, self-evaluation."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 21 — Agentic RAG Patterns — FAI Standards

## Query Planning Agent

Decompose complex questions into sub-queries before retrieval. Each sub-query targets a specific facet, enabling parallel retrieval and focused chunk selection.

```python
from dataclasses import dataclass
from openai import AzureOpenAI

@dataclass
class SubQuery:
    text: str
    target_index: str  # which index/source to query
    reasoning: str     # why this sub-query is needed

def plan_queries(question: str, client: AzureOpenAI, config: dict) -> list[SubQuery]:
    """Decompose a complex question into targeted sub-queries."""
    response = client.chat.completions.create(
        model=config["planner_model"],
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": (
                "Decompose the user question into 1-5 sub-queries. "
                "Each sub-query targets one fact. Return JSON: "
                '{"sub_queries": [{"text": "...", "target_index": "...", "reasoning": "..."}]}'
            )},
            {"role": "user", "content": question},
        ],
        max_tokens=config.get("planner_max_tokens", 512),
    )
    parsed = json.loads(response.choices[0].message.content)
    return [SubQuery(**sq) for sq in parsed["sub_queries"]]
```

## Adaptive Retrieval — Index/Source Routing

Route each sub-query to the best retrieval source based on query type. Structured data goes to SQL, factual lookups to vector search, recent events to web search.

```python
RETRIEVER_REGISTRY: dict[str, Callable] = {
    "vector": retrieve_from_ai_search,
    "sql": retrieve_from_sql,
    "graph": retrieve_from_graph_db,
    "web": retrieve_from_bing,
}

def adaptive_retrieve(sub_query: SubQuery, registry: dict) -> list[Chunk]:
    retriever = registry.get(sub_query.target_index, registry["vector"])
    return retriever(sub_query.text, top_k=5)
```

## Multi-Hop Reasoning Loop

Iterative retrieve → synthesize → decide-if-done loop. Each hop retrieves new evidence, synthesizes with prior context, then checks whether the answer is complete.

```python
@dataclass
class HopState:
    question: str
    accumulated_context: list[Chunk]
    synthesis: str
    hop_count: int
    token_budget_remaining: int

def multi_hop_rag(question: str, client: AzureOpenAI, config: dict) -> HopState:
    max_hops = config.get("max_hops", 4)
    token_budget = config.get("token_budget_per_query", 8000)
    state = HopState(question, [], "", 0, token_budget)

    while state.hop_count < max_hops and state.token_budget_remaining > 0:
        # Plan next retrieval based on what's missing
        follow_up = generate_follow_up(state, client, config)
        if follow_up is None:
            break  # Agent decided it has enough evidence

        chunks = adaptive_retrieve(follow_up, RETRIEVER_REGISTRY)
        chunks = relevance_rerank(chunks, state.question, client, config)
        state.accumulated_context.extend(chunks[:3])  # top-3 per hop

        # Deduct tokens consumed this hop
        hop_tokens = sum(c.token_count for c in chunks[:3])
        state.token_budget_remaining -= hop_tokens
        state.hop_count += 1

        # Intermediate synthesis — merge new evidence with prior
        state.synthesis = synthesize_intermediate(state, client, config)

    return state
```

## Dynamic Chunk Selection — Per-Hop Reranking

After each retrieval hop, rerank chunks against the *evolving* question context — not just the original query. Discard chunks below a relevance threshold.

```python
def relevance_rerank(
    chunks: list[Chunk], query: str, client: AzureOpenAI, config: dict
) -> list[Chunk]:
    threshold = config.get("rerank_threshold", 0.65)
    scored = []
    for chunk in chunks:
        score = compute_relevance(chunk.text, query, client)
        if score >= threshold:
            scored.append((score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored]
```

## Tool-Augmented RAG

When retrieval alone is insufficient, the agent invokes tools: calculator for numeric reasoning, code interpreter for data transformations, web search for real-time facts.

```python
TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "calculator", "description": "Evaluate math expressions", "parameters": {...}}},
    {"type": "function", "function": {"name": "code_interpreter", "description": "Run Python for data analysis", "parameters": {...}}},
    {"type": "function", "function": {"name": "web_search", "description": "Search Bing for recent information", "parameters": {...}}},
]

def agentic_rag_with_tools(state: HopState, client: AzureOpenAI, config: dict) -> str:
    response = client.chat.completions.create(
        model=config["reasoning_model"],
        messages=build_messages(state),
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
        max_tokens=config.get("synthesis_max_tokens", 1024),
    )
    # Execute tool calls, feed results back, re-synthesize
    return process_tool_calls(response, state, client, config)
```

## Self-Reflection and Citation Verification

Before answering, the agent critiques its own retrieval: are sources sufficient? Do citations support claims? Flag unsupported statements.

```python
def verify_citations(answer: str, chunks: list[Chunk], client: AzureOpenAI, config: dict) -> dict:
    response = client.chat.completions.create(
        model=config["reviewer_model"],
        temperature=0,
        messages=[
            {"role": "system", "content": (
                "Verify each claim in the answer against the provided sources. "
                "Return JSON: {\"claims\": [{\"text\": ..., \"supported\": bool, \"source_id\": ...}], "
                "\"unsupported_count\": int, \"confidence\": float}"
            )},
            {"role": "user", "content": f"Answer: {answer}\n\nSources: {format_chunks(chunks)}"},
        ],
    )
    result = json.loads(response.choices[0].message.content)
    if result["confidence"] < config.get("min_citation_confidence", 0.7):
        return {"action": "retry_retrieval", "gaps": result}
    return {"action": "accept", "verified": result}
```

## Context Window Management Across Hops

Track cumulative token count across hops. Compress older context when approaching limits. Never exceed the model's context window.

```python
def manage_context_window(state: HopState, max_context_tokens: int) -> list[Chunk]:
    total = sum(c.token_count for c in state.accumulated_context)
    if total <= max_context_tokens:
        return state.accumulated_context
    # Keep most recent + highest relevance, compress older hops
    ranked = sorted(state.accumulated_context, key=lambda c: c.relevance_score, reverse=True)
    selected, running = [], 0
    for chunk in ranked:
        if running + chunk.token_count > max_context_tokens:
            break
        selected.append(chunk)
        running += chunk.token_count
    return selected
```

## Evaluation Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Multi-hop recall | ≥ 0.80 | Fraction of required evidence retrieved across all hops |
| Answer faithfulness | ≥ 0.85 | Claims supported by retrieved sources (via LLM judge) |
| Citation precision | ≥ 0.90 | Cited sources actually support the claim they're attached to |
| Hop efficiency | ≤ 3 avg | Average hops needed to reach sufficient evidence |
| Latency p95 | < 12s | End-to-end including all hops and tool calls |

## Guardrails

- **Max hops**: cap at 4 (config-driven) — exponential latency otherwise
- **Token budget per hop**: 2000 tokens default, deducted from total budget
- **Total token budget**: 8000 per query — forces context compression
- **Retrieval timeout**: 5s per source — circuit-break slow indexes
- **Tool call limit**: max 3 tool invocations per query
- **Self-reflection**: mandatory before final answer when confidence < 0.7

## Agentic RAG vs Basic RAG

| Dimension | Basic RAG | Agentic RAG (Play 21) |
| --- | --- | --- |
| Query handling | Single query → single retrieval | Decomposed sub-queries → multi-source |
| Retrieval | One-shot vector search | Iterative multi-hop with reranking |
| Source selection | Fixed index | Adaptive routing (vector/SQL/graph/web) |
| Reasoning | Retrieve then generate | Retrieve → synthesize → reflect → iterate |
| Tool use | None | Calculator, code interpreter, web search |
| Citation | Appended chunks | Verified per-claim with confidence scores |
| Cost | Low (1 LLM call + 1 search) | Higher (N hops × LLM + retrieval + tools) |
| When to use | Simple factual lookups | Complex, multi-faceted, comparative questions |

## Anti-Patterns

- ❌ Unlimited hops without token budget — runaway loops drain PTU quota
- ❌ Reranking against original query only — stale relevance after context evolves
- ❌ Skipping citation verification — hallucinated references erode trust
- ❌ Tool calls without output validation — injected content from web search
- ❌ Flat context window (no compression) — older hops push out recent evidence
- ❌ Single model for all roles — use gpt-4o-mini for planning, gpt-4o for synthesis
- ❌ No hop-level telemetry — impossible to debug which hop introduced bad evidence
- ❌ Hardcoded retrieval sources — new indexes require code changes instead of config

## WAF Alignment

| Pillar | Agentic RAG Patterns |
|--------|---------------------|
| **Reliability** | Circuit breakers per retrieval source, hop-level retries with backoff, graceful degradation to fewer hops on timeout, health checks per index |
| **Security** | Content Safety on tool outputs, prompt injection defense at each hop boundary, PII redaction before logging intermediate synthesis, Managed Identity for all index connections |
| **Cost Optimization** | Token budget enforcement per hop, gpt-4o-mini for planning/routing, semantic cache on sub-query results, max-hop cap prevents runaway spend |
| **Operational Excellence** | Hop-level traces with correlation IDs, per-hop latency/token metrics in App Insights, evaluation pipeline for multi-hop recall and faithfulness |
| **Performance Efficiency** | Parallel sub-query retrieval, streaming intermediate results, context compression to stay within window, async tool execution |
| **Responsible AI** | Self-reflection before final answer, citation verification with confidence scoring, unsupported-claim flagging, human escalation when confidence < threshold |
