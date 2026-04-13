---
description: "TypeScript cost optimization — streaming responses, semantic cache, token metering, efficient serialization."
applyTo: "**/*.ts"
waf:
  - "cost-optimization"
---

# TypeScript Cost Optimization — FAI Standards

## Streaming Response Handling

Always use streaming to avoid buffering full completions in memory and to enable early abort.

```typescript
// ✅ Preferred — stream + abort on token budget
async function streamChat(prompt: string, maxTokens: number): Promise<string> {
  const stream = await client.chat.completions.create({
    model: routeModel(prompt),
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    stream: true,
  });
  const chunks: string[] = [];
  let tokenCount = 0;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    chunks.push(delta);
    tokenCount += estimateTokens(delta);
    if (tokenCount >= maxTokens) break; // Early abort — stop paying
  }
  return chunks.join("");
}
```

```typescript
// ❌ Avoided — buffered completion wastes tokens on unused output
const result = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }],
  // No max_tokens cap — unbounded spend
});
return result.choices[0].message.content;
```

## Semantic Cache with Redis

Cache semantically similar prompts to eliminate redundant LLM calls.

```typescript
// ✅ Preferred — embedding-based semantic cache
import { createClient } from "redis";
import { cosineSimilarity } from "./math-utils";

interface CacheEntry { embedding: number[]; response: string; ttl: number; }

async function semanticLookup(
  redis: ReturnType<typeof createClient>,
  queryEmbedding: number[],
  threshold = 0.95,
): Promise<string | null> {
  const keys = await redis.keys("sem-cache:*");
  for (const key of keys) {
    const entry: CacheEntry = JSON.parse((await redis.get(key))!);
    if (cosineSimilarity(queryEmbedding, entry.embedding) >= threshold) {
      return entry.response; // Cache hit — zero LLM cost
    }
  }
  return null;
}
```

- Use Redis `EXPIRE` with TTL from `config/cache.json` — never infinite TTL
- Index embeddings with RediSearch `VECTOR` type for O(log n) lookup at scale
- Cache key = hash of the embedding vector, not the raw prompt text

## Token Metering Middleware

Track token usage per request, per user, per model in Express middleware.

```typescript
// ✅ Preferred — metering middleware with budget enforcement
interface TokenBudget { daily: number; perRequest: number; }

function tokenMeter(budgets: TokenBudget): RequestHandler {
  return async (req, res, next) => {
    const userId = req.headers["x-user-id"] as string;
    const used = await getUsedTokens(userId, "today");
    if (used >= budgets.daily) {
      return res.status(429).json({ error: "Daily token budget exceeded" });
    }
    res.locals.remainingTokens = Math.min(
      budgets.perRequest,
      budgets.daily - used,
    );
    res.on("finish", () => {
      recordTokenUsage(userId, res.locals.actualTokens);
    });
    next();
  };
}
```

- Read budgets from `config/cost.json` — never hardcode token limits
- Emit `token_usage` custom metric to Application Insights on every response
- Track `prompt_tokens` and `completion_tokens` separately for FinOps reporting

## Model Routing

Route requests to the cheapest model that meets quality requirements.

```typescript
// ✅ Preferred — complexity-based model router
type ModelTier = "mini" | "standard" | "reasoning";

function routeModel(prompt: string, config = loadConfig()): string {
  const len = prompt.length;
  const tier: ModelTier =
    len < 200 && !prompt.includes("explain") ? "mini" :
    len < 2000 ? "standard" : "reasoning";

  const models: Record<ModelTier, string> = {
    mini: config.models.cheap,       // gpt-4o-mini — $0.15/1M input
    standard: config.models.default, // gpt-4o — $2.50/1M input
    reasoning: config.models.premium // o3 — $10/1M input
  };
  return models[tier];
}
```

- Classification, extraction, summarization → always `gpt-4o-mini`
- Complex reasoning, multi-step planning → `gpt-4o` or `o3`
- Never use `o3` for simple formatting or templating tasks

## Batch Embedding

Maximize throughput and minimize API calls for embedding workloads.

```typescript
// ✅ Preferred — chunked batch embedding
async function batchEmbed(
  texts: string[],
  batchSize = 16,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model: "text-embedding-3-small", // 5x cheaper than ada-002
      input: batch,
      dimensions: 256, // Reduce dimensions — cheaper storage + faster search
    });
    results.push(...response.data.map((d) => d.embedding));
  }
  return results;
}
```

- Use `text-embedding-3-small` with reduced `dimensions` (256 or 512) unless recall drops
- Batch size 16 per call — maximizes throughput within rate limits
- Deduplicate inputs before embedding — never embed the same text twice

## Azure SDK Cost Patterns

```typescript
// ✅ Preferred — share client instances across requests
const clientCache = new Map<string, OpenAIClient>();

function getClient(endpoint: string, credential: TokenCredential): OpenAIClient {
  if (!clientCache.has(endpoint)) {
    clientCache.set(endpoint, new OpenAIClient(endpoint, credential));
  }
  return clientCache.get(endpoint)!;
}
```

- Reuse `OpenAIClient` and `SearchClient` instances — creating per-request wastes TCP setup
- Use `@azure/abort-controller` with timeouts to kill hung requests before they burn tokens
- Set `Connection: keep-alive` on HTTP agents — reuse sockets across LLM calls

## Anti-Patterns

- ❌ Creating a new `OpenAIClient` per request — TCP handshake + auth per call
- ❌ Embedding the same document on every query — cache embeddings at ingest time
- ❌ Using `gpt-4o` for intent classification — `gpt-4o-mini` is 17x cheaper and sufficient
- ❌ Omitting `max_tokens` — model generates until context window exhausted
- ❌ Logging full prompt + completion to Application Insights — storage costs explode
- ❌ Polling LLM for status updates — use Event Grid or Service Bus instead
- ❌ Storing embeddings as JSON arrays — use binary `Float32Array` for 75% size reduction
- ❌ Re-computing embeddings on config change — version your embedding model separately
- ❌ Using `Promise.all` on 1000 LLM calls — triggers 429s and wastes retries; use `p-limit`

## WAF Alignment

| Pillar | TypeScript Cost Pattern | Impact |
|--------|------------------------|--------|
| Cost Optimization | Model routing by complexity tier | 60-80% spend reduction on simple tasks |
| Cost Optimization | Semantic cache with Redis + cosine similarity | Eliminates repeat LLM calls |
| Cost Optimization | Token metering middleware with daily budgets | Prevents runaway spend |
| Cost Optimization | Batch embedding with reduced dimensions | 5x cheaper embeddings |
| Cost Optimization | Streaming + early abort on budget hit | Stops paying mid-generation |
| Performance | Client instance reuse via `Map` cache | Eliminates per-request TCP overhead |
| Performance | `p-limit` concurrency control | Prevents 429 retry storms |
| Reliability | `AbortController` timeouts on LLM calls | Kills hung requests before budget burn |
| Operational Excellence | `token_usage` metrics per user/model | FinOps visibility in App Insights |
