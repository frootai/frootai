## Initialize Your First Play

Scaffold a complete AI solution in your workspace with one click.

### What Gets Created

**DevKit** — the .github Copilot brain:
- `agent.md` — root orchestrator
- `copilot-instructions.md` — domain knowledge (<150 lines)
- `builder/reviewer/tuner.agent.md` — agent triad
- `skills/` — 150+ line action skills
- `.vscode/mcp.json` — auto-connects MCP server

**TuneKit** — AI configuration:
- `config/openai.json` — model, temperature, max_tokens
- `config/guardrails.json` — content safety thresholds

**SpecKit** — metadata and docs:
- `spec/fai-manifest.json` — FAI Protocol wiring

### How to Initialize

1. Open a play detail → click **Init DevKit**
2. Or: **Ctrl+Shift+P** → "FrootAI: Init DevKit"
3. Choose your play → files are scaffolded instantly

> **Tip**: Init each kit independently — DevKit, TuneKit, and SpecKit are modular.
