# 🌳 FrootAI — Roadmap

> **Know the roots. Ship the fruit.**
> From a single token to a production agent fleet.

---

## Motto

**FrootAI equips infrastructure and platform teams to go full-stack agentic — from ideation to shipping — without depending on AI application teams for the last 20%.**

The world is changing. Full-stack is no longer back-end + front-end. It's full-stack from an **agentic point of view** — from infrastructure bedrock to production AI agents. FrootAI is the power kit that makes this possible.

---

## The $100B Gap

Infra and platform teams do **80% of the work** — networking, GPU, landing zones, security, identity, hosting, scaling. But they stop at the "AI boundary" because nobody gave them the vocabulary, the patterns, or the packaged solutions to cross it.

Then an application/AI team comes in, does the remaining 20% (tuning temperature, configuring prompts, setting up agents) — and takes **all the credit**.

**FrootAI's play**: Give infra teams the **last mile** — pre-packaged solution plays where they can deploy RAG pipelines, tune AI parameters, configure semantic ranking, set up agent hosting — without needing an AI specialist.

---

## Vision

FrootAI is not documentation. It's an **engine** — a platform that empowers infrastructure and platform teams to design, deploy, and operate AI solutions end-to-end.

**The outcome**: An infra person runs `azd up`, and a production-grade RAG pipeline deploys — with pre-tuned temperature, chunk sizes, semantic ranking, agent instructions, and evaluation pipeline. No AI specialist needed.

---

## Two Modes of Empowerment

FrootAI operates in **two distinct modes**. Both are equally critical:

### Mode 1: Developer Playground Empowerment 🛠️

*For developers BUILDING AI solutions in VS Code or any IDE.*

When a developer is coding a solution play, FrootAI empowers their IDE:

| Asset | What It Does | How Developer Uses It |
|-------|-------------|----------------------|
| **agent.md** | Defines agent personality, constraints, tools | VS Code Copilot reads it → co-coder understands the solution context |
| **instructions.md** | System prompts, few-shot examples, guardrails | Copilot uses as reference when generating code |
| **MCP server** | Exposes solution-specific tools + knowledge | Copilot queries MCP for architecture patterns while coding |
| **plugins/** | Reusable SK/Agent Framework functions | Developer imports and composes into their code |
| **.vscode/mcp.json** | Auto-connects FrootAI MCP in workspace | Zero-config — open folder, MCP is live |

**The result**: The developer's co-coder (Copilot, Cursor, Claude) becomes **solution-aware**. It doesn't just write generic code — it writes code tuned for THIS solution play with the RIGHT parameters, the RIGHT patterns, the RIGHT guardrails.

### Mode 2: Production AI Tuning 🎛️

*For platform teams DEPLOYING and TUNING AI solutions in production.*

Once infrastructure is deployed, FrootAI provides pre-tuned configuration for the AI layer:

| Asset | What It Does | How Platform Team Uses It |
|-------|-------------|--------------------------|
| **config/openai.json** | Model, temperature, top-k, top-p, seed, schema | Review defaults → adjust knobs → deploy |
| **config/search.json** | Vector config, hybrid weights, reranking, thresholds | Tune retrieval quality for their data |
| **config/chunking.json** | Chunk size, overlap, strategy | Match to their document types |
| **agent.md** | Agent behavior in production | System prompt deployed to the runtime |
| **evaluation/** | Test set + scoring script | Run `eval.py` → verify quality meets targets |

**The result**: The platform team doesn't need to guess AI parameters. They're pre-tuned by architects. They review, adjust if needed, deploy, and validate with the included evaluation pipeline.

### Why Both Modes Matter

```
Developer Mode:   Coding  →  agent.md + MCP + plugins  →  Solution-aware co-coder
Production Mode:  Deploy  →  config/ + eval/            →  Pre-tuned, validated AI

Both together:    Ideation → Coding → Deploy → Tune → Evaluate → Ship
                  ─────────── FrootAI covers the entire journey ───────────────
```

---

## Product Layers

```
Layer 5: 🎯 SOLUTION PLAYS        Complete end-to-end deployable solutions
Layer 4: 🤖 AGENTS + INSTRUCTIONS  agent.md, system prompts, behavior configs
Layer 3: 🔌 MCPs + PLUGINS         Reusable MCP servers, SK plugins, tools
Layer 2: 📖 FROOT KNOWLEDGE        17 modules, 200+ terms, architecture patterns
Layer 1: ⚙️ INFRA BLUEPRINTS       Bicep/Terraform for AI Landing Zones
```

Each layer builds on the one below. Solution plays compose all layers into one-click deployments.

**Layer 3 clarification**: MCPs and plugins are NOT just documentation links. They are:
- **MCP servers** that expose APIs, documentation, knowledge bases, and solution-specific tools
- **SK plugins** that provide reusable functions for Semantic Kernel / Agent Framework
- **Skill sets** similar to Anthropic Claude Skills or Azure VS Code skill sets
- **The knowledge engine** — exposing curated, concise information that any agent can query

---

## Phase 1: Foundation + First Solution Plays (Now → Month 1)

### What We Have (✅ Done)
- [x] 17 FROOT knowledge modules
- [x] MCP server with 6 tools
- [x] Website with packages page
- [x] Setup guide for MCP integration
- [x] GitHub Actions deploy pipeline
- [x] .vscode/mcp.json auto-connect

### Phase 1 Deliverables
- [ ] **ROADMAP.md** — this file
- [ ] **Solution Play 01: Enterprise RAG** — complete deployable RAG pipeline
- [ ] **Solution Play 02: AI Landing Zone** — foundational infrastructure
- [ ] **Solution Play 03: Deterministic Agent** — reliable agent with guardrails
- [ ] **Solution plays page** on website — browsable catalog
- [ ] Fix Mermaid diagram overflow across all docs
- [ ] Update packages page to include solution plays

### Solution Play Structure
```
solution-plays/
└── 01-enterprise-rag/
    ├── README.md              Overview, architecture diagram, what it solves
    ├── agent.md               Agent personality, constraints, tool access
    ├── instructions.md        System prompts, few-shot examples, guardrails
    ├── infra/
    │   ├── main.bicep         One-click Azure deployment
    │   └── parameters.json    Configurable knobs (region, SKU, model)
    ├── config/
    │   ├── openai.json        Model, temperature, top-k, top-p, max-tokens
    │   ├── search.json        Index schema, semantic config, scoring
    │   └── chunking.json      Chunk size, overlap, strategy
    ├── mcp/
    │   └── index.js           MCP server exposing solution-specific tools
    ├── plugins/
    │   └── search-plugin.py   SK/Agent Framework plugin
    └── evaluation/
        ├── test-set.jsonl     100 test Q&A pairs with ground truth
        └── eval.py            Automated quality scoring script
```

---

## Phase 2: Scale to 10 Solution Plays (Month 2–3)

### Solution Plays 04–10
| # | Solution Play | Target Persona | Key AI Config |
|---|---|---|---|
| 04 | Call Center Voice AI | Infra + Comms team | Speech-to-text, agent prompts, fallback |
| 05 | IT Ticket Resolution | Platform + ITSM team | Classification, routing, ServiceNow MCP |
| 06 | Document Intelligence Pipeline | Data platform team | Extraction prompts, confidence thresholds |
| 07 | Multi-Agent Customer Service | Platform team | Supervisor routing, tool schemas, memory |
| 08 | Copilot Studio Enterprise Bot | Citizen devs + IT | Topics, knowledge sources, guardrails |
| 09 | AI-Powered Search Portal | Web team + infra | Hybrid weights, semantic config, filters |
| 10 | Content Moderation Pipeline | Security + platform | Severity levels, custom categories |

### Platform Enhancements
- [ ] npm publish `frootai-mcp` — `npx frootai-mcp` works globally
- [ ] Solution play MCP tools — each play exposes its own tools
- [ ] VS Code extension scaffold — FrootAI sidebar for browsing solutions
- [ ] Community contribution guide — PR template for new solution plays
- [ ] Agent coding support — agent.md + instructions that assist VS Code Copilot

---

## Phase 3: Full Platform (Month 4–6)

### Solution Plays 11–20
| # | Solution Play | Target Persona | Key AI Config |
|---|---|---|---|
| 11 | AI Landing Zone (Advanced) | Cloud architects | Multi-region, RBAC, private endpoints |
| 12 | Model Serving on AKS | Platform + ML team | vLLM, quantization, batching, scaling |
| 13 | Fine-Tuning Workflow | Platform + data team | LoRA config, data prep, eval pipeline |
| 14 | Cost-Optimized AI Gateway | Platform + FinOps | APIM policies, caching, token budgets |
| 15 | Multi-Modal Document Processing | Data platform | Image prompts, extraction schemas |
| 16 | Copilot Extension for Teams | IT + dev team | Declarative agent, Graph API, scoping |
| 17 | AI Observability Dashboard | SRE + platform | KQL queries, quality alerts, workbooks |
| 18 | Prompt Management System | Dev + platform | Version control, A/B testing, rollback |
| 19 | Edge AI with Phi-4 | IoT + edge team | ONNX quantization, local serving |
| 20 | Real-Time Anomaly Detection | Data + SRE | Streaming, threshold tuning, alerts |

### Platform Features
- [ ] Website chatbot agent (powered by FrootAI MCP on AI Foundry)
- [ ] Interactive solution configurator on website
- [ ] Bicep/Terraform registry for all infra blueprints
- [ ] Automated testing pipeline for solution plays
- [ ] Marketplace listing (Azure Marketplace / GitHub Marketplace)

---

## Phase 4: Ecosystem + Growth (Month 6+)

### Community & Scale
- [ ] 100+ community-contributed solution plays
- [ ] Partner integrations (ServiceNow, Salesforce, SAP MCP servers)
- [ ] Enterprise support tier
- [ ] Conference talks, workshops, certifications
- [ ] FrootAI certification program for architects

### Revenue Paths
- Open source core (free forever)
- Enterprise solution packs (premium pre-validated solutions)
- Consulting and implementation services
- Certification and training programs
- Acquisition opportunity (Microsoft, Anthropic, or consulting firms)

---

## 20 Solution Plays — Complete List

| # | Name | Complexity | Infra | AI Config | Agent |
|---|------|-----------|-------|-----------|-------|
| 01 | Enterprise RAG Q&A | Medium | AI Search + OpenAI + Container App | Chunks, embeddings, top-k, reranking | ✅ |
| 02 | AI Landing Zone | Foundation | VNet + PE + RBAC + GPU quota | N/A (infra only) | ❌ |
| 03 | Deterministic Agent | Medium | Container App + OpenAI | temp=0, JSON schema, verification | ✅ |
| 04 | Call Center Voice AI | High | Comm Services + Speech + Agent | Grounding, fallback prompts | ✅ |
| 05 | IT Ticket Resolution | Medium | Logic Apps + Foundry + ITSM | Classification, routing | ✅ |
| 06 | Document Intelligence | Medium | Blob + DocIntel + OpenAI | Extraction, confidence | ❌ |
| 07 | Multi-Agent Service | High | Container Apps + Agent Framework | Supervisor, tools, memory | ✅ |
| 08 | Copilot Studio Bot | Low | Copilot Studio + Dataverse | Topics, knowledge, guardrails | ❌ |
| 09 | AI Search Portal | Medium | AI Search + Web App | Hybrid weights, semantic | ❌ |
| 10 | Content Moderation | Low | Content Safety + APIM | Severity, categories | ❌ |
| 11 | Landing Zone (Adv) | High | Multi-region + PE + policy | Governance at scale | ❌ |
| 12 | Model Serving AKS | High | AKS + vLLM + GPU | Quantization, batching | ❌ |
| 13 | Fine-Tuning Workflow | High | Foundry + LoRA | Hyperparameters, eval | ❌ |
| 14 | AI Gateway | Medium | APIM + cache + LB | Token budgets, caching | ❌ |
| 15 | Multi-Modal DocProc | Medium | GPT-4o + Blob + Cosmos | Image prompts, schemas | ❌ |
| 16 | Copilot Teams Ext | Medium | M365 + Graph + plugin | Declarative agent | ❌ |
| 17 | AI Observability | Medium | App Insights + KQL | Metrics, alerts | ❌ |
| 18 | Prompt Management | Medium | Prompt Flow + Git + CI/CD | Versioning, A/B | ❌ |
| 19 | Edge AI Phi-4 | High | IoT Hub + ONNX | Quantization, sync | ❌ |
| 20 | Anomaly Detection | High | Event Hub + Stream + AI | Thresholds, alerts | ❌ |

---

## Principles

1. **Infra-first**: Every solution starts from the infrastructure up, not the application down.
2. **One command**: `azd up` deploys everything — infra, AI config, agent, evaluation.
3. **Pre-tuned**: AI parameters (temperature, top-k, chunk size) are pre-optimized, not left as exercises.
4. **Evaluated**: Every solution includes a test set and automated quality scoring.
5. **Open source**: Core is free forever. The community grows the catalog.
6. **Composable**: Solutions use shared MCPs, plugins, and infra blueprints.
7. **Agent-native**: Every solution comes with instructions that work in VS Code Copilot, AI Foundry, or standalone.
8. **Two modes**: Developer playground (agent.md + MCP for coding) AND production tuning (config/ + eval/).
9. **Agnostic extensibility**: Users bring their own solution plays, infra, and use FrootAI as the skill/knowledge layer.

---

## Competitive Edge

### What Makes FrootAI Different

| Competitor | What They Do | What FrootAI Does Better |
|-----------|-------------|-------------------------|
| **awesome-copilot** | Catalogs 244 skills, 179 agents | FrootAI doesn't catalog — it **solves**. Complete solutions, not lists |
| **Azure Quickstarts** | Deploy templates (Bicep/ARM) | FrootAI adds AI tuning + agent.md + evaluation on top of infra |
| **LangChain Hub** | Prompt templates | FrootAI gives infra + prompts + evaluation + agent — the whole stack |
| **Anthropic Skills** | Claude-specific skill sets | FrootAI is cross-platform (Azure, any MCP client) and infra-focused |
| **Terraform Registry** | Infrastructure modules | FrootAI extends to Layer 5 (AI config + agents + evaluation) |

### The Moat

The moat is **not the code**. It's:
1. **Curation** — every parameter is tuned by architects who've done this in production
2. **The two-mode model** — nobody else gives BOTH developer co-coder empowerment AND production AI tuning
3. **Community** — like Terraform Registry or Awesome lists, value compounds with every contribution
4. **The vocabulary bridge** — FrootAI gives infra teams the AI vocabulary they need to cross the boundary

### Why This Gets Acquired

| Buyer | Why They'd Want FrootAI |
|-------|------------------------|
| **Microsoft** | Complements Azure AI Foundry — platform exists but "infra-to-AI bridge" content doesn't. FrootAI becomes the official getting-started for enterprise AI |
| **Anthropic** | Claude Skills/Essentials direction — FrootAI is what they're building at cloud.anthropic.com, but for the Azure/infra audience |
| **Meta** | Llama ecosystem needs deployment patterns — FrootAI provides them |
| **Consulting firms** | Accenture, Deloitte, Wipro — their consultants need this exact toolkit for every AI engagement |

---

## Revenue Paths

- **Open source core** (free forever) — builds community, trust, adoption
- **Enterprise solution packs** — premium pre-validated solutions with SLA
- **Consulting & implementation** — help enterprises deploy customized solution plays
- **Certification & training** — FrootAI certified architect program
- **Acquisition** — proven community + adopted toolkit = acquisition target

---

> **FrootAI** — Know the roots. Ship the fruit.
> The power kit that equips infra and platform teams to go full-stack agentic.
> From ideation to shipping. No silos. No dependencies. Ship it yourself.
