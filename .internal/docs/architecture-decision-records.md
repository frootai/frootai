# Architecture Decision Records (ADR) — FAI Agent

> This document records design shifts and configuration changes for the FAI Agent chatbot.
> Use this to understand current state, rollback to previous configurations, or plan future upgrades.

---

## ADR-001: FAI Agent Speed Optimization (March 24, 2026)

### Context
FAI Agent was responding in **15-20 seconds** per query. Users reported it felt slow compared to ChatGPT.

### Root Cause Analysis
| Factor | Impact |
|--------|--------|
| GPT-4.1 model (1M context window) | Heaviest model — slow inference |
| ~5500 token system prompt | Large input payload every request |
| max_tokens: 1000 | Model generates up to 1000 output tokens |
| No streaming | User sees nothing until full response arrives |

### Decision: 4 Changes Implemented

#### 1. Model: gpt-4.1 → gpt-4o-mini
```
BEFORE: AZURE_OPENAI_DEPLOYMENT = "gpt-4.1"
AFTER:  AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini"
```
- **Why**: 3-5x faster inference, 13x cheaper ($0.15/1M vs $2/1M input)
- **Trade-off**: Slightly less capable on complex reasoning, but for a grounded chatbot with a comprehensive system prompt, quality is excellent
- **Deployment**: `gpt-4o-mini` was already deployed on `cs-openai-varcvenlme53e` (AI Services, rg-dev)

#### 2. Max Tokens: 1000 → 600
```
BEFORE: max_tokens: 1000, temperature: 0.3
AFTER:  max_tokens: 600,  temperature: 0.4
```
- **Why**: Cuts generation time ~40%. Typical responses use 200-350 tokens anyway
- **Trade-off**: Very long detailed comparisons may be slightly truncated
- **Temperature**: Raised from 0.3→0.4 for slightly more creative markdown formatting

#### 3. System Prompt: ~5500 → ~3000 tokens
**Sections REMOVED (still in grounding, just compressed):**
- Verbose "Architecture Pattern" column in plays table → kept only name + services + URL
- Detailed per-file DevKit listing (19 files) → compressed to 2-line summary
- Detailed per-file TuneKit listing (8 files) → compressed to 1-line summary
- Detailed per-tool MCP descriptions (16 tools) → compressed to category summary
- Per-command VS Code Extension listing → compressed to summary
- Full per-module Knowledge Module descriptions → compressed to topic list
- Full FAQ section (4 Q&As) → removed (info exists on website pages)
- Model Comparison table (4 models) → removed (available via MCP tool)
- Full Website Pages table (19 rows) → compressed to inline list

**Sections KEPT (essential for quality):**
- All 20 plays with names, Azure services, and URLs (compact table)
- Play selection guidance (one-liner per category)
- DevKit/TuneKit/MCP/VS Code summaries
- All page URLs (inline format)
- Getting started flow (5 steps)
- Cost estimates (compact)
- Format rules (emoji headers, tables, links, Next Steps)
- Response guidelines

#### 4. Streaming: New `/api/chat/stream` SSE endpoint
```
NEW ENDPOINT: POST /api/chat/stream
PROTOCOL:     Server-Sent Events (SSE)
FORMAT:       data: {"content": "chunk"}\n\n  ...  data: [DONE]\n\n
```
- **Server**: Sends `stream: true` to Azure OpenAI, forwards delta chunks as SSE
- **Frontend**: `chatbot.tsx` reads EventSource stream, updates chat bubble in real-time
- **Fallback**: On error, falls back to `/api/chat` (non-streaming) + client-side fallback answers
- **Why**: First token appears in <1 second — user perceives instant response

### Results (Measured)
| Metric | Before (gpt-4.1) | After (gpt-4o-mini) | Improvement |
|--------|------------------|---------------------|-------------|
| Simple query | ~15-20s | 5.6s | 3x faster |
| Complex comparison | ~25-30s | 6.0s | 4-5x faster |
| First token visible | 15-20s | <1s (streaming) | Instant feel |
| Input tokens/request | ~5500 | ~2050 | 63% less |
| Max output tokens | 1000 | 600 | 40% less |
| Cost per request | ~$0.02 | ~$0.0005 | 40x cheaper |
| Response quality | Excellent | Very good | Acceptable |

### How to Rollback to GPT-4.1
If you need higher quality or more detailed answers:

**Step 1**: Change model in `functions/server.js`:
```js
const AZURE_OPENAI_DEPLOYMENT = "gpt-4.1";  // was "gpt-4o-mini"
```

**Step 2**: Restore max_tokens:
```js
// In callAzureOpenAI() and /api/chat/stream handler:
max_tokens: 1000,  // was 600
temperature: 0.3,  // was 0.4
```

**Step 3**: Restore full system prompt from git history:
```bash
git show 88ad0cd:functions/server.js > /tmp/old-server.js
# Copy SYSTEM_PROMPT from that file
```
Commit `88ad0cd` was the last commit with the full ~5500 token prompt + gpt-4.1.

**Step 4**: Redeploy:
```bash
cd C:\temp
Copy-Item functions/server.js C:\temp\server.js
Copy-Item functions/package.json C:\temp\package.json
Compress-Archive -Path C:\temp\server.js,C:\temp\package.json -DestinationPath C:\temp\deploy.zip -Force
az webapp deploy --name frootai-chatbot-api --resource-group rg-foundry-demo --src-path C:\temp\deploy.zip --type zip
```

### Hybrid Option (Future)
Use gpt-4o-mini for simple questions, gpt-4.1 for complex ones:
- Detect question complexity (keyword matching or a fast classifier)
- Route simple → gpt-4o-mini (fast), complex → gpt-4.1 (thorough)
- This gives best-of-both-worlds but adds routing logic

---

## Key Git Commits for Reference

| Commit | Description |
|--------|------------|
| `88ad0cd` | Last state with gpt-4.1 + full ~5500 token prompt + max_tokens:1000 |
| `be7c58c` | Current: gpt-4o-mini + trimmed prompt + streaming + max_tokens:600 |

---

## Azure Resources

| Resource | Details |
|----------|---------|
| App Service | frootai-chatbot-api (rg-foundry-demo, Sweden Central, B1 Linux) |
| OpenAI | cs-openai-varcvenlme53e (rg-dev) |
| Deployments | gpt-4.1, gpt-4o-mini, text-embedding-3-small |
| Auth | Managed Identity (principal: 830e5dd4-4234-467f-9680-430b9b9babe1) |
