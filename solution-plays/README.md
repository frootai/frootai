# FrootAI Solution Plays

> **101 solution plays. Each has a canonical numeric identity, DevKit (.github Agentic OS), TuneKit (AI config + eval), SpecKit (architecture + wiring), and infrastructure assets.**

The machine-readable source of truth for all 101 identities and links is [`../orchard/registry/solution-play-index.json`](../orchard/registry/solution-play-index.json). The table below is the original first-50 launch roster; the canonical index includes Plays 51-101 without renaming or deleting any play.

| # | Solution | Status | Complexity |
|---|---------|--------|-----------|
| 01 | [Enterprise RAG Q&A](./01-enterprise-rag/) | ✅ Ready | Medium |
| 02 | [AI Landing Zone](./02-ai-landing-zone/) | ✅ Ready | Foundation |
| 03 | [Deterministic Agent](./03-deterministic-agent/) | ✅ Ready | Medium |
| 04 | [Call Center Voice AI](./04-call-center-voice-ai/) | ✅ Ready | High |
| 05 | [IT Ticket Resolution](./05-it-ticket-resolution/) | ✅ Ready | Medium |
| 06 | [Document Intelligence](./06-document-intelligence/) | ✅ Ready | Medium |
| 07 | [Multi-Agent Service](./07-multi-agent-service/) | ✅ Ready | High |
| 08 | [Copilot Studio Bot](./08-copilot-studio-bot/) | ✅ Ready | Low |
| 09 | [AI Search Portal](./09-ai-search-portal/) | ✅ Ready | Medium |
| 10 | [Content Moderation](./10-content-moderation/) | ✅ Ready | Low |
| 11 | [Landing Zone Advanced](./11-ai-landing-zone-advanced/) | ✅ Ready | High |
| 12 | [Model Serving AKS](./12-model-serving-aks/) | ✅ Ready | High |
| 13 | [Fine-Tuning Workflow](./13-fine-tuning-workflow/) | ✅ Ready | High |
| 14 | [AI Gateway](./14-cost-optimized-ai-gateway/) | ✅ Ready | Medium |
| 15 | [Multi-Modal DocProc](./15-multi-modal-docproc/) | ✅ Ready | Medium |
| 16 | [Copilot Teams Extension](./16-copilot-teams-extension/) | ✅ Ready | Medium |
| 17 | [AI Observability](./17-ai-observability/) | ✅ Ready | Medium |
| 18 | [Prompt Management](./18-prompt-management/) | ✅ Ready | Medium |
| 19 | [Edge AI Phi-4](./19-edge-ai-phi4/) | ✅ Ready | High |
| 20 | [Anomaly Detection](./20-anomaly-detection/) | ✅ Ready | High |
| 21 | [Agentic RAG](./21-agentic-rag/) | ✅ Ready | High |
| 22 | [Multi-Agent Swarm](./22-multi-agent-swarm/) | ✅ Ready | High |
| 23 | [Browser Automation](./23-browser-automation-agent/) | ✅ Ready | Medium |
| 24 | [AI Code Review Pipeline](./24-ai-code-review-pipeline/) | ✅ Ready | Medium |
| 25 | [Conversation Memory](./25-conversation-memory-layer/) | ✅ Ready | High |
| 26 | [Semantic Search Engine](./26-semantic-search-engine/) | ✅ Ready | Medium |
| 27 | [AI Data Pipeline](./27-ai-data-pipeline/) | ✅ Ready | High |
| 28 | [Knowledge Graph RAG](./28-knowledge-graph-rag/) | ✅ Ready | High |
| 29 | [MCP Gateway](./29-mcp-gateway/) | ✅ Ready | Medium |
| 30 | [AI Security Hardening](./30-ai-security-hardening/) | ✅ Ready | High |
| 31 | [Low-Code AI Builder](./31-low-code-ai-builder/) | ✅ Ready | Medium |
| 32 | [AI-Powered Testing](./32-ai-powered-testing/) | ✅ Ready | Medium |
| 33 | [Voice AI Agent](./33-voice-ai-agent/) | ✅ Ready | High |
| 34 | [Edge AI Deployment](./34-edge-ai-deployment/) | ✅ Ready | High |
| 35 | [AI Compliance Engine](./35-ai-compliance-engine/) | ✅ Ready | High |
| 36 | [Multimodal Agent](./36-multimodal-agent/) | ✅ Ready | Medium |
| 37 | [AI-Powered DevOps](./37-ai-powered-devops/) | ✅ Ready | Medium |
| 38 | [Document Understanding v2](./38-document-understanding-v2/) | ✅ Ready | High |
| 39 | [AI Meeting Assistant](./39-ai-meeting-assistant/) | ✅ Ready | Medium |
| 40 | [Copilot Studio Advanced](./40-copilot-studio-advanced/) | ✅ Ready | High |
| 41 | [AI Red Teaming](./41-ai-red-teaming/) | ✅ Ready | High |
| 42 | [Computer Use Agent](./42-computer-use-agent/) | ✅ Ready | High |
| 43 | [AI Video Generation](./43-ai-video-generation/) | ✅ Ready | Medium |
| 44 | [Foundry Local On-Device](./44-foundry-local-on-device/) | ✅ Ready | High |
| 45 | [Real-Time Event AI](./45-realtime-event-ai/) | ✅ Ready | High |
| 46 | [Healthcare Clinical AI](./46-healthcare-clinical-ai/) | ✅ Ready | High |
| 47 | [Synthetic Data Factory](./47-synthetic-data-factory/) | ✅ Ready | High |
| 48 | [AI Model Governance](./48-ai-model-governance/) | ✅ Ready | High |
| 49 | [Creative AI Studio](./49-creative-ai-studio/) | ✅ Ready | High |
| 50 | [Financial Risk Intelligence](./50-financial-risk-intelligence/) | ✅ Ready | High |

### What Every Play Includes

** DevKit** (.github Agentic OS  19 files per play):
- `copilot-instructions.md` + `instructions/*.instructions.md` (L1: Always-On)
- `prompts/*.prompt.md` (L2: /deploy, /test, /review, /evaluate)
- `agents/*.agent.md` (L2: builder, reviewer, tuner chain)
- `skills/*/SKILL.md` (L3: deploy-azure, evaluate, tune)
- `hooks/guardrails.json` (L4: lifecycle enforcement)
- `workflows/*.md` (L4: ai-review, ai-deploy)
- `infra/main.bicep + parameters.json` (Azure infrastructure)
- `agent.md` (rich play-specific  1500+ bytes)
- `plugin.json` (marketplace manifest)

** TuneKit** (AI fine-tuning configs):
- `config/openai.json`  temperature, top-k, model
- `config/guardrails.json`  PII, toxicity, abstention
- `config/agents.json`  agent behavior tuning
- `config/model-comparison.json`  model selection guide
- `evaluation/test-set.jsonl + eval.py`  quality scoring

> Use the [FrootAI VS Code Extension](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) to scaffold any play with one click.