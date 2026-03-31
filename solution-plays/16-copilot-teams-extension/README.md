# Solution Play 16: Copilot Teams Extension

> **Complexity:** Medium | **Status:** ✅ Ready
> Build a Microsoft 365 Copilot extension — Teams message extension + Bot Framework + Azure OpenAI.

## Architecture

```mermaid
graph LR
    USER[Teams User] --> EXT[Message<br/>Extension]
    EXT --> BOT[Bot Framework<br/>Service]
    BOT --> LLM[Azure OpenAI<br/>GPT-4o]
    BOT --> GRAPH[Microsoft<br/>Graph API]
    LLM --> CARD[Adaptive Card<br/>Response]
    CARD --> USER
```

## Azure Services

| Service | Purpose |
|---------|---------|
| Azure Bot Service | Bot Framework hosting for Teams integration |
| Azure OpenAI Service | Generate contextual responses and summaries |
| Azure App Service | Host the bot backend API |
| Azure Key Vault | Store bot credentials and API keys securely |
| Microsoft Graph API | Access Teams, mail, and calendar context |

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
| config/openai.json | Response generation model, temperature, length |
| config/guardrails.json | Message filtering, data loss prevention, scoping |
| config/agents.json | Bot personality, action routing, fallback behavior |
| config/model-comparison.json | Model selection for Teams response latency |

Run `Ctrl+Shift+P` → **FrootAI: Init TuneKit** in VS Code.

## Quick Start

1. Install: `code --install-extension frootai.frootai-vscode`
2. Init DevKit → 19 .github files + infra
3. Init TuneKit → AI configs + evaluation
4. Open Copilot Chat → ask to build this solution
5. Use /review → /deploy → ship

> **FrootAI Solution Play 16** — DevKit builds it. TuneKit ships it.
