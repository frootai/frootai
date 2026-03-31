# Solution Play 05: IT Ticket Resolution

> **Complexity:** Medium | **Status:** ✅ Ready
> AI-powered IT support — auto-classify, route, and resolve tickets with Azure OpenAI + Logic Apps.

## Architecture

```mermaid
graph LR
    TKT[Incoming Ticket] --> LA[Logic Apps<br/>Orchestrator]
    LA --> LLM[Azure OpenAI<br/>GPT-4o]
    LLM --> CLASS[Classify &<br/>Prioritize]
    CLASS --> ROUTE[Auto-Route<br/>or Resolve]
    ROUTE --> KB[AI Search<br/>Knowledge Base]
    ROUTE --> TEAMS[Teams<br/>Notification]
    LLM --> LOG[App Insights]
```

## Azure Services

| Service | Purpose |
|---------|---------|
| Azure Logic Apps | Ticket ingestion and workflow orchestration |
| Azure OpenAI Service | Classification, summarization, resolution suggestions |
| Azure AI Search | Knowledge base retrieval for known solutions |
| Azure Service Bus | Ticket queue and priority routing |
| Azure Container Apps | Host the resolution agent API |

## DevKit (.github Agentic OS)

This play includes the full .github Agentic OS (19 files):
- **Layer 1:** copilot-instructions.md + 3 modular instruction files
- **Layer 2:** 4 slash commands + 3 chained agents (builder → reviewer → tuner)
- **Layer 3:** 3 skill folders (deploy-azure, evaluate, tune)
- **Layer 4:** guardrails.json + 2 agentic workflows
- **Infrastructure:** infra/main.bicep + parameters.json

Run `Ctrl+Shift+P` → **FrootAI: Init DevKit** in VS Code.

## TuneKit (AI Configuration)

| Config File | What It Controls |
|-------------|-----------------|
| config/openai.json | Model parameters, temperature for ticket classification |
| config/guardrails.json | PII masking, escalation thresholds, auto-close rules |
| config/agents.json | Agent behavior — confidence cutoffs, retry logic |
| config/model-comparison.json | Model selection: GPT-4o vs GPT-4o-mini for cost |

Run `Ctrl+Shift+P` → **FrootAI: Init TuneKit** in VS Code.

## Quick Start

1. Install: `code --install-extension frootai.frootai-vscode`
2. Init DevKit → 19 .github files + infra
3. Init TuneKit → AI configs + evaluation
4. Open Copilot Chat → ask to build this solution
5. Use /review → /deploy → ship

> **FrootAI Solution Play 05** — DevKit builds it. TuneKit ships it.
