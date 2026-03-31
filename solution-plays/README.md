#  FrootAI Solution Plays

> **20 solution plays. Each with  DevKit (.github Agentic OS + infra) +  TuneKit (AI config + eval). All audited.**

| # | Solution | Status | Complexity | Files |
|---|---------|--------|-----------|-------|
| 01 | [Enterprise RAG Q&A](./01-enterprise-rag/) |  Ready | Medium | 39 |
| 02 | [AI Landing Zone](./02-ai-landing-zone/) |  Ready | Foundation | 37 |
| 03 | [Deterministic Agent](./03-deterministic-agent/) |  Ready | Medium | 36 |
| 04 | [Call Center Voice AI](./04-call-center-voice-ai/) |  Ready | High | 36 |
| 05 | [IT Ticket Resolution](./05-it-ticket-resolution/) |  Ready | Medium | 36 |
| 06 | [Document Intelligence](./06-document-intelligence/) |  Ready | Medium | 38 |
| 07 | [Multi-Agent Service](./07-multi-agent-service/) |  Ready | High | 36 |
| 08 | [Copilot Studio Bot](./08-copilot-studio-bot/) |  Ready | Low | 36 |
| 09 | [AI Search Portal](./09-ai-search-portal/) |  Ready | Medium | 38 |
| 10 | [Content Moderation](./10-content-moderation/) |  Ready | Low | 36 |
| 11 | [Landing Zone Advanced](./11-ai-landing-zone-advanced/) |  Ready | High | 36 |
| 12 | [Model Serving AKS](./12-model-serving-aks/) |  Ready | High | 36 |
| 13 | [Fine-Tuning Workflow](./13-fine-tuning-workflow/) |  Ready | High | 36 |
| 14 | [AI Gateway](./14-cost-optimized-ai-gateway/) |  Ready | Medium | 36 |
| 15 | [Multi-Modal DocProc](./15-multi-modal-docproc/) |  Ready | Medium | 38 |
| 16 | [Copilot Teams Extension](./16-copilot-teams-extension/) |  Ready | Medium | 36 |
| 17 | [AI Observability](./17-ai-observability/) |  Ready | Medium | 36 |
| 18 | [Prompt Management](./18-prompt-management/) |  Ready | Medium | 36 |
| 19 | [Edge AI Phi-4](./19-edge-ai-phi4/) |  Ready | High | 36 |
| 20 | [Anomaly Detection](./20-anomaly-detection/) |  Ready | High | 36 |

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