const http = require("http");
const https = require("https");

// Azure OpenAI Configuration
// Using cs-openai-varcvenlme53e (AI Services, rg-dev) with gpt-4o-mini for speed + quality balance
const AZURE_OPENAI_ENDPOINT = "https://cs-openai-varcvenlme53e.cognitiveservices.azure.com";
const AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
const AZURE_OPENAI_API_VERSION = "2024-10-21";

// ═══ COMPREHENSIVE GROUNDING CONTEXT ═══
// This is the RAG knowledge base for the FrootAI chatbot.
// Every fact, URL, feature, and play detail is here so the AI never hallucinates.

const SYSTEM_PROMPT = `You are **Agent FAI** — the official AI-powered guide for **FrootAI**.
Grounded ONLY in the knowledge below. NEVER make up facts, URLs, or features.
If unsure, say "Check the documentation at [Developer Hub](/dev-hub)".

## FORMAT RULES
Use rich markdown: **## emoji headers**, **bold**, bullet points, tables for comparisons, \`code\` for commands, [clickable links](/path), > blockquotes for tips, --- dividers. End with **## 🚀 Next Steps** (2-3 links). Keep answers substantive and visually rich.

---

## WHAT IS FROOTAI

**FrootAI** ("From the Roots to the Fruits") is a **Build It Yourself (BIY) AI LEGO Kit** — the open-source glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem.

- **FROOT** = **F**oundations · **R**easoning · **O**rchestration · **O**perations · **T**ransformation
- **Mission**: A power kit for infrastructure, platform, and application teams to master and bridge the gap between **AI Infra**, **AI Platform**, and the **AI Application/Agentic Ecosystem**.
- **Tagline**: "From a single token to a production agent fleet."
- **License**: MIT — 100% open source, free forever
- **Creator**: Built by the FrootAI community
- [Website](https://frootai.dev) | [GitHub](https://github.com/frootai/frootai) | [npm](https://www.npmjs.com/package/frootai-mcp) | [VS Code](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai)

### Why FrootAI?
Unlike generic Azure templates, FrootAI provides:
1. **Agentic OS** (.github layer) — so Copilot/agents understand your project from day one
2. **TuneKit** — AI config files to fine-tune behavior without changing code
3. **Real Bicep** — production-ready infrastructure templates per play
4. **Real eval.py** — automated quality scoring with play-specific metrics
5. **MCP Server** — 23 tools your AI agent can call for live knowledge
6. **Auto-Chain Agents** — builder → reviewer → tuner workflow

Each play ships: **DevKit** (19 .github Agentic OS files) + **TuneKit** (AI config) + **Bicep** infra + **eval.py**

## 20 SOLUTION PLAYS

| # | Name | Complexity | Key Azure Services | Architecture Pattern | URL |
|---|------|-----------|-------------------|---------------------|-----|
| 01 | Enterprise RAG Q&A | Med | AI Search+OpenAI+Container App | RAG: hybrid search, chunking, reranking | [/user-guide?play=01](/user-guide?play=01) |
| 02 | AI Landing Zone | Found | VNet+PE+RBAC+GPU | Hub-spoke, private endpoints, RBAC | [/user-guide?play=02](/user-guide?play=02) |
| 03 | Deterministic Agent | Med | Container App+OpenAI(temp=0) | Zero-temp chain, content filtering | [/user-guide?play=03](/user-guide?play=03) |
| 04 | Call Center Voice AI | High | Comms+Speech+OpenAI | STT→LLM→TTS streaming pipeline | [/user-guide?play=04](/user-guide?play=04) |
| 05 | IT Ticket Resolution | Med | Logic Apps+OpenAI+Service Bus | Event-driven async automation | [/user-guide?play=05](/user-guide?play=05) |
| 06 | Document Intelligence | Med | Doc Intel+OpenAI+Blob | OCR+LLM extraction, structured output | [/user-guide?play=06](/user-guide?play=06) |
| 07 | Multi-Agent Service | High | OpenAI(dual)+Container Apps+Cosmos | Agent-to-agent handoff, shared state | [/user-guide?play=07](/user-guide?play=07) |
| 08 | Copilot Studio Bot | Low | AI Search+OpenAI+Storage | Low-code bot, knowledge grounding | [/user-guide?play=08](/user-guide?play=08) |
| 09 | AI Search Portal | Med | AI Search(semantic)+OpenAI+Web | Hybrid search + GPT synthesis | [/user-guide?play=09](/user-guide?play=09) |
| 10 | Content Moderation | Low | Content Safety+OpenAI+APIM | Safety gateway, severity scoring | [/user-guide?play=10](/user-guide?play=10) |
| 11 | Landing Zone Adv | High | VNet+NSG+NAT+Firewall+KV | Enterprise network, segmentation | [/user-guide?play=11](/user-guide?play=11) |
| 12 | Model Serving AKS | High | AKS(GPU)+ACR+OpenAI | GPU cluster, custom model hosting | [/user-guide?play=12](/user-guide?play=12) |
| 13 | Fine-Tuning Workflow | High | ML Workspace+OpenAI+Storage | LoRA fine-tuning, evaluation | [/user-guide?play=13](/user-guide?play=13) |
| 14 | AI Gateway FinOps | Med | APIM+OpenAI+Redis | Semantic caching, token metering | [/user-guide?play=14](/user-guide?play=14) |
| 15 | Multi-Modal DocProc | Med | Doc Intel+OpenAI(4o)+Cosmos | Images+text+tables→structured | [/user-guide?play=15](/user-guide?play=15) |
| 16 | Copilot Teams Ext | Med | OpenAI+App Service | Teams bot, adaptive cards | [/user-guide?play=16](/user-guide?play=16) |
| 17 | AI Observability | Med | Log Analytics+App Insights | KQL dashboards, alerting | [/user-guide?play=17](/user-guide?play=17) |
| 18 | Prompt Management | Med | OpenAI+Cosmos+App Service | Prompt versioning, A/B testing | [/user-guide?play=18](/user-guide?play=18) |
| 19 | Edge AI Phi-4 | High | IoT Hub+ACR+Storage | Phi-4 SLM, offline inference | [/user-guide?play=19](/user-guide?play=19) |
| 20 | Anomaly Detection | High | Event Hub+Stream Analytics+OpenAI | Streaming anomaly + AI enrichment | [/user-guide?play=20](/user-guide?play=20) |

### Play Selection Guidance
- **New to AI?** Play 02 (Landing Zone) → Play 01 (RAG) → Play 03 (Agent)
- **RAG?** Play 01 (basic), Play 09 (search portal), Play 06/15 (documents)
- **Agents?** Play 03 (deterministic), Play 07 (multi-agent), Play 05 (automation)
- **Voice/Teams?** Play 04 (voice AI), Play 16 (Teams extension)
- **Cost optimization?** Play 14 (AI Gateway FinOps), Play 17 (observability)
- **Edge/IoT?** Play 19 (Phi-4 edge), Play 20 (anomaly detection)
- **Security?** Play 10 (content moderation), Play 11 (advanced network)
- **MLOps?** Play 13 (fine-tuning), Play 18 (prompt management)
- **Best first play?** Use the [Solution Configurator](/configurator) — 3 questions → personalized recommendation

## DEVKIT (.github Agentic OS) — 19 files/play
4 layers: **L1 Always-On** (copilot-instructions.md + 3 instruction files), **L2 On-Demand** (4 prompts: /deploy, /test, /review, /evaluate + 3 agents: builder, reviewer, tuner), **L3 Auto-Invoked** (3 skills: deploy-azure, evaluate, tune), **L4 Lifecycle** (guardrails.json + 2 GitHub Actions).
Plus: infra/main.bicep + parameters.json, agent.md, plugin.json.
Get it: VS Code Extension → click play → "Init DevKit"

## TUNEKIT — 4-8 config files/play
\`config/openai.json\` (temperature, model, max_tokens) · \`config/guardrails.json\` (blocked topics, PII filter) · \`config/agents.json\` (agent behavior) · \`config/model-comparison.json\` (cost vs quality) · \`evaluation/eval.py\` (automated scoring) · \`evaluation/test-set.jsonl\` (test cases)
Get it: VS Code Extension → click play → "Init TuneKit"

## MCP SERVER — 23 tools (frootai-mcp@3.2.0)
Install: \`npx frootai-mcp@latest\` | Docker: \`docker run -i ghcr.io/frootai/frootai-mcp\` | Setup: .vscode/mcp.json
**Static(6)**: list_modules, get_module, lookup_term, search_knowledge, get_architecture_pattern, get_froot_overview
**Live(4)**: fetch_azure_docs, fetch_external_mcp, list_community_plays, get_github_agentic_os
**Chain(3)**: agent_build → agent_review → agent_tune (guided workflow)
**Ecosystem(3)**: get_model_catalog, get_azure_pricing, compare_models
Full guide: [/setup-guide](/setup-guide)

## VS CODE EXTENSION — v1.4.0, 19 commands
Install: \`code --install-extension pavleenbali.frootai\`
Per-play: Read Docs, User Guide, Init DevKit/TuneKit/SpecKit/Hooks/Prompts, Open on GitHub
Global: Auto-Chain Agents, Search Knowledge, Lookup Term, Browse Patterns, Open Module, View MCP Tools
4 sidebar panels: Plays(20), MCP(23), Knowledge(18), Glossary(200+). Standalone — no clone needed.

## SPECKIT — Architecture specification + WAF alignment
\`spec/play-spec.json\` — defines architecture, components, config, evaluation thresholds, and WAF alignment for each play.
Get it: VS Code Extension → click play → "Init SpecKit" | CLI: \`npx frootai init\` (scaffolds spec/ + WAF instructions)
WAF pillars: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency, Responsible AI
Validate: \`npx frootai validate --waf\` → WAF scorecard (6 pillars, 17 checks, pass/fail per check)
Website: [/packages](/packages) | [SpecKit Template](https://github.com/frootai/frootai/blob/main/config/spec-template.json)

## CLI — \`npx frootai\` (6 commands)
Install: \`npm install -g frootai-mcp\` or use directly: \`npx frootai <command>\`
| Command | Description |
|---------|-------------|
| \`npx frootai init\` | Interactive scaffolding — creates .vscode/mcp.json, .github/agents, config/, spec/, WAF instructions |
| \`npx frootai search "query"\` | Search 16 knowledge modules + 159 glossary terms |
| \`npx frootai cost <play> [--scale dev\\|prod]\` | Estimate monthly Azure cost for any play |
| \`npx frootai validate [--waf]\` | Check project structure + optional WAF scorecard |
| \`npx frootai doctor\` | Health check — Node.js, npm, VS Code, MCP, Docker versions |
| \`npx frootai help\` | Show all commands |
Website: [/cli](/cli) | npm: [frootai-mcp](https://www.npmjs.com/package/frootai-mcp)

## REST API — 5 endpoints (frootai-chatbot-api.azurewebsites.net)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/search-plays | Search 20 solution plays by keyword |
| POST | /api/estimate-cost | Estimate monthly Azure cost for a play |
| POST | /api/chat | Chat with Agent FAI (complete response) |
| POST | /api/chat/stream | Chat with Agent FAI (streaming SSE) |
| GET | /api/openapi.json | OpenAPI 3.1 specification |
Rate limit: 60 req/min. Website: [/api-docs](/api-docs) | [OpenAPI Spec](https://frootai-chatbot-api.azurewebsites.net/api/openapi.json)

## 16 KNOWLEDGE MODULES (FROOT Framework)
**F** — Foundations: GenAI Foundations, LLM Landscape, AI Glossary A-Z (200+ terms), .github Agentic OS
**R** — Reasoning: Prompt Engineering, RAG Architecture, Deterministic AI
**O** — Orchestration: Semantic Kernel, AI Agents, MCP & Tools
**O** — Operations: Azure AI Foundry, AI Infrastructure, Copilot Ecosystem
**T** — Transformation: Fine-Tuning & MLOps, Responsible AI, Production Patterns
Access: [/docs/](/docs/) or FAI Learning Hub navbar

## KEY PAGES (24 pages)
/ (Home) | [/solution-plays](/solution-plays) | [/configurator](/configurator) | [/user-guide?play=XX](/user-guide?play=01) | [/ecosystem](/ecosystem) | [/vscode-extension](/vscode-extension) | [/mcp-tooling](/mcp-tooling) | [/cli](/cli) | [/setup-guide](/setup-guide) | [/packages](/packages) | [/chatbot](/chatbot) | [/api-docs](/api-docs) | [/partners](/partners) | [/marketplace](/marketplace) | [/community](/community) | [/adoption](/adoption) | [/dev-hub](/dev-hub) | [/dev-hub-changelog](/dev-hub-changelog) | [/feature-spec](/feature-spec) | [/learning-hub](/learning-hub) | [/hi-fai](/hi-fai) | [/enterprise](/enterprise)

## GETTING STARTED (recommend this flow)
1. **Try the Configurator**: [/configurator](/configurator) → 3 questions → recommended play
2. **Install VS Code Extension**: \`code --install-extension pavleenbali.frootai\`
3. **Browse Plays**: [/solution-plays](/solution-plays) → explore all 20 plays
4. **Init DevKit**: Click play → "Init DevKit" → 19 .github files + infra in workspace
5. **Init TuneKit**: Click play → "Init TuneKit" → AI config + evaluation
6. **Init SpecKit**: Click play → "Init SpecKit" → spec/play-spec.json + WAF instructions
7. **Build with Copilot**: Open Copilot Chat → it reads agent.md + .github context automatically
8. **Deploy**: \`azd up\` with provided Bicep templates
Or use CLI: \`npx frootai init\` → scaffolds everything in one command

## PYTHON SDK + MCP (pip install)
- **pip install frootai** — Offline Python SDK: search 16 modules, 20 plays, cost estimation, A/B testing. Zero dependencies.
- **pip install frootai-mcp** — Python MCP server: same 23 tools over stdio.
- **pip install frootai && frootai search embeddings** — CLI works too.
PyPI: [pypi.org/project/frootai](https://pypi.org/project/frootai/) | [pypi.org/project/frootai-mcp](https://pypi.org/project/frootai-mcp/)

## COST ESTIMATES (monthly)
| Scenario | Dev/Test | Production |
|----------|----------|------------|
| RAG Pipeline (01) | $150-300 | $2K-8K |
| AI Agent (03/07) | $100-250 | $1.5K-6K |
| Voice AI (04) | $200-400 | $2.5K-10K |
| AI Gateway (14) | $80-200 | $1K-5K |
| Observability (17) | $30-80 | $200-1K |
| Edge AI (19) | $20-50 | $100-500 |

> 💡 **Cost tips**: Use Play 14 for FinOps patterns. Semantic caching saves 30-50%. Use gpt-4o-mini for classification ($0.15/1M vs $2.50/1M for gpt-4o).

## FAQ
**Q: How is FrootAI different from Azure Quickstarts?**
A: Quickstarts give code. FrootAI gives code + .github Agentic OS + TuneKit + real Bicep + real evaluation + MCP tools — a complete BIY kit.

**Q: Do I need Azure?**
A: No! Knowledge modules, VS Code extension, MCP server work without Azure. Only needed for deploying plays.

**Q: Can I contribute?**
A: Yes! Visit [/community](/community) for guidelines.

## GUIDELINES
1. Always include relevant [clickable links](/solution-plays) using markdown
2. When recommending a play, include the [User Guide](/user-guide?play=XX) link
3. For setup → [Setup Guide](/setup-guide) | For learning → [FAI Learning Hub](/learning-hub)
4. For dev docs → [Developer Hub](/dev-hub) | For contributing → [Community](/community)
5. Use tables for comparisons. Be specific with play numbers and tool names.
6. Suggest [Configurator](/configurator) when users are unsure which play to pick
7. For quick start, recommend [🖐️ Hi FAI](/hi-fai) — 5-minute quickstart guide
`;

const PORT = process.env.PORT || 8080;

// ═══ COMPUTE DATA (mirrors MCP tools) ═══
const PLAY_DATA = [
  { id: "01", name: "Enterprise RAG Q&A", services: ["AI Search", "OpenAI (gpt-4o)", "Container App", "Blob Storage"], pattern: "RAG hybrid search chunking semantic reranking retrieval augmented generation document qa question answering knowledge base", cx: "Medium" },
  { id: "02", name: "AI Landing Zone", services: ["VNet + PE", "Key Vault"], pattern: "landing zone infrastructure network security private endpoints rbac governance", cx: "Foundation" },
  { id: "03", name: "Deterministic Agent", services: ["Container App", "OpenAI (gpt-4o)", "Content Safety"], pattern: "deterministic agent zero temperature reliable reproducible guardrails", cx: "Medium" },
  { id: "04", name: "Call Center Voice AI", services: ["Communication Services", "Speech Service", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "voice call center speech stt tts real time audio phone", cx: "High" },
  { id: "05", name: "IT Ticket Resolution", services: ["OpenAI (gpt-4o-mini)", "App Service (B1)"], pattern: "ticket resolution automation helpdesk workflow", cx: "Medium" },
  { id: "06", name: "Document Intelligence", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "document extraction ocr invoice receipt structured output pdf", cx: "Medium" },
  { id: "07", name: "Multi-Agent Service", services: ["OpenAI (gpt-4o)", "Container App", "Cosmos DB"], pattern: "multi agent collaboration handoff orchestration", cx: "High" },
  { id: "08", name: "Copilot Studio Bot", services: ["AI Search", "OpenAI (gpt-4o-mini)", "Blob Storage"], pattern: "copilot studio low code bot chatbot", cx: "Low" },
  { id: "09", name: "AI Search Portal", services: ["AI Search", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "search portal semantic hybrid keyword", cx: "Medium" },
  { id: "10", name: "Content Moderation", services: ["Content Safety", "OpenAI (gpt-4o-mini)", "APIM"], pattern: "content moderation safety filtering toxic", cx: "Low" },
  { id: "11", name: "Landing Zone Advanced", services: ["VNet + PE", "Firewall", "Key Vault", "NAT Gateway"], pattern: "advanced network segmentation firewall dns", cx: "High" },
  { id: "12", name: "Model Serving AKS", services: ["AKS (GPU)", "ACR", "OpenAI (gpt-4o)"], pattern: "model serving kubernetes gpu cluster hosting", cx: "High" },
  { id: "13", name: "Fine-Tuning Workflow", services: ["ML Workspace", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "fine tuning lora training dataset mlops", cx: "High" },
  { id: "14", name: "Cost-Optimized AI Gateway", services: ["APIM", "OpenAI (gpt-4o)", "Redis Cache"], pattern: "cost optimization finops gateway caching token metering", cx: "Medium" },
  { id: "15", name: "Multi-Modal DocProc", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "multi modal document images tables extraction", cx: "Medium" },
  { id: "16", name: "Copilot Teams Extension", services: ["OpenAI (gpt-4o)", "App Service (B1)"], pattern: "teams bot copilot extension adaptive cards", cx: "Medium" },
  { id: "17", name: "AI Observability", services: ["Log Analytics", "App Insights"], pattern: "observability monitoring telemetry kql dashboards", cx: "Medium" },
  { id: "18", name: "Prompt Management", services: ["OpenAI (gpt-4o)", "Cosmos DB", "App Service (B1)"], pattern: "prompt management versioning ab testing", cx: "Medium" },
  { id: "19", name: "Edge AI Phi-4", services: ["IoT Hub", "ACR", "Blob Storage"], pattern: "edge ai phi small language model iot offline", cx: "High" },
  { id: "20", name: "Anomaly Detection", services: ["Event Hub", "Stream Analytics", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "anomaly detection streaming real time event", cx: "High" },
];

const SVC_PRICING = { "AI Search": [75,500], "OpenAI (gpt-4o)": [50,2000], "OpenAI (gpt-4o-mini)": [10,200], "Container App": [15,150], "App Service (B1)": [13,55], "Cosmos DB": [25,300], "AKS (GPU)": [200,2000], "ML Workspace": [50,500], "VNet + PE": [10,50], "Firewall": [0,500], "Key Vault": [1,5], "APIM": [50,300], "Redis Cache": [15,100], "Event Hub": [10,150], "Stream Analytics": [50,300], "Log Analytics": [10,100], "App Insights": [5,50], "Blob Storage": [5,50], "Communication Services": [20,500], "Speech Service": [15,200], "Document Intelligence": [15,150], "Content Safety": [10,50], "IoT Hub": [10,100], "ACR": [5,50], "NAT Gateway": [0,30] };

function searchPlays(query) {
  const qt = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (!qt.length) return PLAY_DATA.slice(0, 3);
  return PLAY_DATA.map(p => {
    const text = `${p.name} ${p.pattern} ${p.services.join(" ")}`.toLowerCase().split(/\s+/);
    let hits = 0;
    for (const q of qt) { for (const t of text) { if (t.includes(q) || q.includes(t)) { hits++; break; } } }
    return { ...p, score: hits / qt.length };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function estimateCost(playId, scale) {
  const p = PLAY_DATA.find(d => d.id === playId.padStart(2, "0"));
  if (!p) return null;
  const idx = scale === "prod" ? 1 : 0;
  let total = 0;
  const items = p.services.map(s => { const pr = SVC_PRICING[s] || [0,0]; const c = pr[idx]; total += c; return { service: s, cost: c }; });
  return { play: p, items, total, scale };
}

// ═══ RATE LIMITING (in-memory, sliding window) ═══
const RATE_LIMIT = { windowMs: 60000, maxRequests: 60 };
const rateLimitStore = new Map();

function rateLimitCheck(ip) {
  const now = Date.now();
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, [now]);
    return true;
  }
  const timestamps = rateLimitStore.get(ip).filter(t => now - t < RATE_LIMIT.windowMs);
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  return timestamps.length <= RATE_LIMIT.maxRequests;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT.windowMs);
    if (valid.length === 0) rateLimitStore.delete(ip);
    else rateLimitStore.set(ip, valid);
  }
}, 300000);

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ═══ RATE LIMITING (in-memory, per IP) ═══
  const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!rateLimitCheck(clientIP)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Rate limit exceeded. Max 60 requests per minute." }));
    return;
  }

  // OpenAPI spec
  if (req.method === "GET" && req.url === "/api/openapi.json") {
    try {
      const spec = require("fs").readFileSync(require("path").join(__dirname, "openapi.json"), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(spec);
    } catch (e) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "OpenAPI spec not found" }));
    }
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "frootai-chatbot-api", model: AZURE_OPENAI_DEPLOYMENT, tools: 22, version: "3.1.2" }));
    return;
  }

  // ═══ COMPUTE API ENDPOINTS (MCP tools as REST) ═══

  // Search plays
  if (req.method === "POST" && req.url === "/api/search-plays") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { query } = JSON.parse(body);
        const results = searchPlays(query || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Estimate cost
  if (req.method === "POST" && req.url === "/api/estimate-cost") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { play, scale } = JSON.parse(body);
        const result = estimateCost(play || "01", scale || "dev");
        if (!result) { res.writeHead(404); res.end(JSON.stringify({ error: "Play not found" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Chat endpoint
  if (req.method === "POST" && (req.url === "/api/chat" || req.url === "/chat")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, history = [] } = JSON.parse(body);
        if (!message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'message' in request body" }));
          return;
        }

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-10),
          { role: "user", content: message },
        ];

        // Try Managed Identity first (production), fall back to API key (dev)
        let credential;
        let useBearer = false;
        const apiKey = process.env.AZURE_OPENAI_KEY;

        if (process.env.IDENTITY_ENDPOINT) {
          // Running on Azure — use Managed Identity
          try {
            credential = await getManagedIdentityToken();
            useBearer = true;
            console.log("Using Managed Identity token");
          } catch (tokenErr) {
            console.error("MI token failed:", tokenErr.message);
            if (apiKey) { credential = apiKey; } else { throw tokenErr; }
          }
        } else if (apiKey) {
          credential = apiKey;
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No auth configured. Set AZURE_OPENAI_KEY or enable Managed Identity." }));
          return;
        }

        const reply = await callAzureOpenAI(messages, credential, useBearer);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(reply));
      } catch (err) {
        console.error("Chat error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to get response", detail: err.message }));
      }
    });
    return;
  }

  // Streaming chat endpoint
  if (req.method === "POST" && (req.url === "/api/chat/stream" || req.url === "/chat/stream")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, history = [] } = JSON.parse(body);
        if (!message) { res.writeHead(400); res.end("Missing message"); return; }

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-10),
          { role: "user", content: message },
        ];

        let credential;
        let useBearer = false;
        const apiKey = process.env.AZURE_OPENAI_KEY;
        if (process.env.IDENTITY_ENDPOINT) {
          try { credential = await getManagedIdentityToken(); useBearer = true; }
          catch { if (apiKey) credential = apiKey; else throw new Error("No auth"); }
        } else if (apiKey) { credential = apiKey; }
        else { res.writeHead(500); res.end("No auth"); return; }

        // SSE streaming
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
          "Access-Control-Allow-Headers": "Content-Type",
        });

        const reqBody = JSON.stringify({ messages, temperature: 0.4, max_tokens: 1000, top_p: 0.9, stream: true });
        const url = new URL(`/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, AZURE_OPENAI_ENDPOINT);
        const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(reqBody) };
        if (useBearer) headers["Authorization"] = `Bearer ${credential}`;
        else headers["api-key"] = credential;

        const apiReq = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: "POST", headers }, (apiRes) => {
          let buffer = "";
          apiRes.on("data", (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const json = JSON.parse(line.slice(6));
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
                } catch {}
              }
              if (line === "data: [DONE]") {
                res.write("data: [DONE]\n\n");
                res.end();
              }
            }
          });
          apiRes.on("end", () => { if (!res.writableEnded) { res.write("data: [DONE]\n\n"); res.end(); } });
        });
        apiReq.on("error", (e) => { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end(); });
        apiReq.write(reqBody);
        apiReq.end();
      } catch (err) {
        res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /api/chat" }));
});

function callAzureOpenAI(messages, credential, useBearer) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages, temperature: 0.4, max_tokens: 1000, top_p: 0.9 });
    const url = new URL(`/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, AZURE_OPENAI_ENDPOINT);

    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    };

    if (useBearer) {
      headers["Authorization"] = `Bearer ${credential}`;
    } else {
      headers["api-key"] = credential;
    }

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          resolve({ reply: parsed.choices?.[0]?.message?.content || "No response", model: parsed.model, usage: parsed.usage });
        } catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

server.listen(PORT, () => {
  console.log(`FrootAI Chatbot API running on port ${PORT}`);
  console.log(`Auth: ${process.env.IDENTITY_ENDPOINT ? 'Managed Identity' : (process.env.AZURE_OPENAI_KEY ? 'API Key' : 'NONE')}`);
  console.log(`Health: GET /api/health`);
  console.log(`Chat: POST /api/chat`);
});

// Get access token from Azure Managed Identity
function getManagedIdentityToken() {
  return new Promise((resolve, reject) => {
    const identityEndpoint = process.env.IDENTITY_ENDPOINT;
    const identityHeader = process.env.IDENTITY_HEADER;

    if (!identityEndpoint || !identityHeader) {
      reject(new Error("Managed Identity not available (no IDENTITY_ENDPOINT)"));
      return;
    }

    const tokenUrl = new URL(identityEndpoint);
    tokenUrl.searchParams.set("resource", "https://cognitiveservices.azure.com/");
    tokenUrl.searchParams.set("api-version", "2019-08-01");

    const options = {
      hostname: tokenUrl.hostname,
      port: tokenUrl.port,
      path: tokenUrl.pathname + tokenUrl.search,
      method: "GET",
      headers: { "X-IDENTITY-HEADER": identityHeader },
    };

    const protocol = tokenUrl.protocol === "https:" ? https : http;
    const req = protocol.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`No access_token in MI response: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`MI parse error: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// Deploy test: 2026-03-26 00:18