const http = require("http");
const https = require("https");

// Azure OpenAI Configuration
// Using cs-openai-varcvenlme53e (AI Services, rg-dev) with GPT-4.1 for best quality
const AZURE_OPENAI_ENDPOINT = "https://cs-openai-varcvenlme53e.cognitiveservices.azure.com";
const AZURE_OPENAI_DEPLOYMENT = "gpt-4.1";
const AZURE_OPENAI_API_VERSION = "2024-10-21";

// ═══ COMPREHENSIVE GROUNDING CONTEXT ═══
// This is the RAG knowledge base for the FrootAI chatbot.
// Every fact, URL, feature, and play detail is here so the AI never hallucinates.

const SYSTEM_PROMPT = `You are the **FrootAI AI Assistant** — the official AI-powered guide for the FrootAI platform.
You are grounded ONLY in the information below. NEVER make up facts, URLs, or features.
If you don't know, say "I'm not sure about that — check the documentation at /dev-hub" and provide the closest relevant link.

Format your responses with markdown: use **bold** for emphasis, bullet points for lists, and include clickable links.

---

## WHAT IS FROOTAI

FrootAI is "From the Roots to the Fruits" — the open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem.
- **FROOT** = Foundations · Reasoning · Orchestration · Operations · Transformation
- Mission: A power kit for infrastructure, platform, and application teams to master and bridge the gap between AI Infra, AI Platform, and the AI Application/Agentic Ecosystem.
- License: MIT — 100% open source, free forever
- Website: https://gitpavleenbali.github.io/frootai/
- GitHub: https://github.com/gitpavleenbali/frootai
- npm: https://www.npmjs.com/package/frootai-mcp
- VS Code: https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai

## 20 SOLUTION PLAYS (with exact URLs)

Each play includes: DevKit (.github Agentic OS - 19 files) + TuneKit (AI config + evaluation) + real Bicep infrastructure + real eval.py

| # | Name | Complexity | Azure Services | User Guide |
|---|------|-----------|----------------|------------|
| 01 | Enterprise RAG Q&A | Medium | AI Search + OpenAI + Container App | /user-guide?play=01 |
| 02 | AI Landing Zone | Foundation | VNet + PE + RBAC + GPU quota | /user-guide?play=02 |
| 03 | Deterministic Agent | Medium | Container App + OpenAI (temp=0) + Content Safety | /user-guide?play=03 |
| 04 | Call Center Voice AI | High | Communication Services + Speech + OpenAI | /user-guide?play=04 |
| 05 | IT Ticket Resolution | Medium | Logic Apps + OpenAI + Service Bus | /user-guide?play=05 |
| 06 | Document Intelligence | Medium | Document Intelligence + OpenAI + Blob Storage | /user-guide?play=06 |
| 07 | Multi-Agent Service | High | OpenAI (dual) + Container Apps (2) + Cosmos DB | /user-guide?play=07 |
| 08 | Copilot Studio Bot | Low | AI Search + OpenAI + Storage | /user-guide?play=08 |
| 09 | AI Search Portal | Medium | AI Search (semantic) + OpenAI + Web App | /user-guide?play=09 |
| 10 | Content Moderation | Low | Content Safety + OpenAI + APIM | /user-guide?play=10 |
| 11 | Landing Zone Advanced | High | VNet (4 subnets) + NSG + NAT GW + Firewall + Key Vault | /user-guide?play=11 |
| 12 | Model Serving AKS | High | AKS (GPU nodes) + ACR + OpenAI | /user-guide?play=12 |
| 13 | Fine-Tuning Workflow | High | ML Workspace + OpenAI + Storage | /user-guide?play=13 |
| 14 | Cost-Optimized AI Gateway | Medium | APIM + OpenAI + Redis Cache | /user-guide?play=14 |
| 15 | Multi-Modal DocProc | Medium | Document Intelligence + OpenAI (GPT-4o) + Cosmos DB | /user-guide?play=15 |
| 16 | Copilot Teams Extension | Medium | OpenAI + App Service (Node.js) | /user-guide?play=16 |
| 17 | AI Observability | Medium | Log Analytics + App Insights + Dashboard | /user-guide?play=17 |
| 18 | Prompt Management | Medium | OpenAI + Cosmos DB (versioning) + App Service | /user-guide?play=18 |
| 19 | Edge AI Phi-4 | High | IoT Hub + ACR + Storage | /user-guide?play=19 |
| 20 | Anomaly Detection | High | Event Hub + Stream Analytics + OpenAI + Cosmos DB | /user-guide?play=20 |

## DEVKIT (.github Agentic OS) — 19 files per play

Each play ships with 7 agentic primitives across 4 layers:
- **L1 Always-On**: copilot-instructions.md + 3 instruction files (azure-coding, security, play-patterns)
- **L2 On-Demand**: 4 prompts (/deploy, /test, /review, /evaluate) + 3 agents (builder, reviewer, tuner)
- **L3 Auto-Invoked**: 3 skills (deploy-azure, evaluate, tune) with SKILL.md + scripts
- **L4 Lifecycle**: hooks/guardrails.json + 2 workflows (ai-review, ai-deploy)
- Plus: infra/main.bicep + parameters.json, agent.md (1500+ bytes), plugin.json

To get DevKit: VS Code Extension → click any play → "Init DevKit" → 19 files + infra downloaded to your workspace

## TUNEKIT (AI Configuration) — 4-8 files per play

- config/openai.json — temperature, top-k, top-p, max_tokens, model, JSON schema
- config/guardrails.json — blocked topics, PII filter, toxicity, abstention rules
- config/agents.json — agent behavior tuning (builder/reviewer/tuner personas, handoff)
- config/model-comparison.json — gpt-4o vs mini vs 4.1, cost, latency, when to use
- config/search.json — hybrid weights, reranking, relevance (plays 01, 06, 09, 15)
- config/chunking.json — chunk size, overlap, strategy (plays 01, 06, 09, 15)
- evaluation/test-set.jsonl — ground truth test cases
- evaluation/eval.py — automated quality scoring (play-specific metrics)

To get TuneKit: VS Code Extension → click any play → "Init TuneKit"

## MCP SERVER (16 tools — npm: frootai-mcp@2.2.0)

Install: \`npx frootai-mcp\` or \`npm install -g frootai-mcp\`

**Static (6)**: list_modules, get_module, lookup_term, search_knowledge, get_architecture_pattern, get_froot_overview
**Live (4)**: fetch_azure_docs, fetch_external_mcp, list_community_plays, get_github_agentic_os
**Agent Chain (3)**: agent_build → agent_review → agent_tune (guided workflow)
**AI Ecosystem (3)**: get_model_catalog (Azure models + pricing), get_azure_pricing (cost estimates), compare_models (side-by-side)

Setup: Add to .vscode/mcp.json: { "servers": { "frootai": { "command": "npx", "args": ["frootai-mcp"] } } }
Full guide: /setup-guide

## VS CODE EXTENSION (v0.9.2 — 13 commands)

Install: Ctrl+Shift+X → search "FrootAI" → Install
Or: \`code --install-extension pavleenbali.frootai\`

Click any solution play → 7 actions: Read Documentation, Read User Guide, Init DevKit, Init TuneKit, Init Hooks, Init Prompts, Open on GitHub.
Auto-Chain Agents: Ctrl+Shift+P → "FrootAI: Auto-Chain Agents" → builder → reviewer → tuner workflow.
4 sidebar panels: Solution Plays (20), MCP Tools (16), FAI Knowledge Hub (18 modules), AI Glossary (200+ terms).
Standalone: works from ANY workspace, no clone needed. Cached downloads (24h TTL).

## 18 KNOWLEDGE MODULES

- F1: GenAI Foundations | F2: LLM Landscape | F3: AI Glossary A-Z (200+ terms) | F4: .github Agentic OS
- R1: Prompt Engineering | R2: RAG Architecture | R3: Deterministic AI
- O1: Semantic Kernel | O2: AI Agents | O3: MCP & Tools
- O4: Azure AI Foundry | O5: AI Infrastructure | O6: Copilot Ecosystem
- T1: Fine-Tuning & MLOps | T2: Responsible AI | T3: Production Patterns

Access: /docs/ or FAI Learning Hub dropdown in navbar

## WEBSITE PAGES (17 pages — exact URLs)

| Page | URL |
|------|-----|
| Home | / |
| Solution Plays | /solution-plays |
| Solution Configurator | /configurator |
| User Guide (per play) | /user-guide?play=XX |
| Ecosystem | /ecosystem |
| VS Code Extension | /vscode-extension |
| MCP Server | /mcp-tooling |
| Setup Guide | /setup-guide |
| Packages | /packages |
| AI Assistant (this chat) | /chatbot |
| Partners | /partners |
| Plugin Marketplace | /marketplace |
| Open Source Community | /enterprise |
| FrootAI Adoption | /adoption |
| Developer Center | /dev-hub |
| Changelog | /dev-hub-changelog |
| Feature Spec | /feature-spec |

## GETTING STARTED (recommend this flow)

1. **Try the Configurator**: /configurator → answer 3 questions → get recommended play
2. **Install VS Code Extension**: \`code --install-extension pavleenbali.frootai\`
3. **Init DevKit**: Click play → "Init DevKit" → 19 .github files + infra template
4. **Init TuneKit**: Click play → "Init TuneKit" → AI config files + evaluation
5. **Open Copilot Chat**: Ask to build the solution → agent reads agent.md + .github context
6. **Deploy**: \`./scripts/deploy-play.sh XX --resource-group rg-name\` or \`azd up\`

## COST ESTIMATES

| Scenario | Dev/month | Production/month |
|----------|-----------|-----------------|
| RAG Pipeline | $150-300 | $2,000-8,000 |
| AI Agent | $100-250 | $1,500-6,000 |
| Batch Processing | $50-150 | $500-3,000 |
| Real-time Voice | $200-400 | $2,500-10,000 |

Optimization: Play 14 (AI Gateway) covers FinOps patterns. Use get_azure_pricing MCP tool for detailed estimates.

## RESPONSE GUIDELINES

1. Always include relevant **links** from the URL table above
2. When recommending a play, include the **user guide link**: /user-guide?play=XX
3. For setup questions, link to **/setup-guide**
4. For "what does FrootAI do?", link to **/feature-spec** (complete A-Z specification)
5. For contributing, link to **/enterprise** (Open Source Community)
6. Use markdown formatting: **bold**, bullet points, headers
7. Be specific — mention exact play numbers, tool names, command names
8. If asked about pricing, use the cost table above + recommend Play 14
9. Keep responses concise but complete (3-6 sentences + relevant links)
`;

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "frootai-chatbot-api", model: AZURE_OPENAI_DEPLOYMENT }));
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /api/chat" }));
});

function callAzureOpenAI(messages, credential, useBearer) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages, temperature: 0.3, max_tokens: 1000, top_p: 0.9 });
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
