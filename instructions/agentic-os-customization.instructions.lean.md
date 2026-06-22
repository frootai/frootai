---
description: "Agentic OS standards — .github folder structure, 7 primitives, 4 layers, plugin packaging."
applyTo: "**/.github/**"
waf:
  - "operational-excellence"
---

# Agentic OS & Copilot Customization — FAI Standards

> Rules for structuring the `.github/` folder as an AI agent operating system using the 7-primitive model.

## .github Folder Structure

```
.github/
├── copilot-instructions.md              # Always-on workspace context (<150 lines)
├── agents/
│   ├── builder.agent.md                 # Build/implement agent
│   ├── reviewer.agent.md                # Security + quality review agent
│   └── tuner.agent.md                   # Config validation + eval agent
├── instructions/
│   ├── python-waf.instructions.md       # File-scoped rules (applyTo globs)
│   └── bicep-standards.instructions.md
├── prompts/
│   ├── test.prompt.md                   # One-shot task templates
│   └── deploy.prompt.md
├── skills/
│   └── provision-infra/
│       ├── SKILL.md                     # Multi-step workflow
│       └── templates/main.bicep         # Bundled assets
├── hooks/
│   └── guardrails.json                  # Lifecycle event handlers
└── workflows/
    └── evaluate.yml                     # CI/CD automation
```

## The 4-Layer Architecture

| Layer | Scope | Files | Loaded When |
|-------|-------|-------|-------------|
| **Always-on** | Every conversation | `copilot-instructions.md` | Automatically — every request |
| **File-based** | Matching glob | `instructions/*.instructions.md` | File matches `applyTo` pattern |
| **Agent-scoped** | Agent invoked | `agents/*.agent.md` | User invokes `@agent-name` |
| **Skill-invoked** | On demand | `skills/*/SKILL.md` | Agent decides via `description` match |

**Cost rule**: Always-on is the most expensive layer (burns tokens every turn). Keep `copilot-instructions.md` under 150 lines. Push domain rules to file-based instructions.

## 7 Primitive Types — Frontmatter Reference

### 1. Workspace Instructions (`copilot-instructions.md`)
No frontmatter. Plain markdown. Knowledge-only — never behavioral overrides. If removing a line doesn't change output quality, delete it.

### 2. Agents (`*.agent.md`)
```yaml
---
description: "Enterprise RAG pipeline builder — chunking, indexing, retrieval"
tools: ["codebase", "terminal", "mcp_frootai_agent_build"]
model: ["gpt-4o", "gpt-4o-mini"]           # Fallback array
waf: ["security", "reliability"]
plays: ["01-enterprise-rag"]
---
```
Agents get context isolation. Use for builder→reviewer→tuner triads with `#<agent-name>` handoffs.

### 3. Instructions (`*.instructions.md`)
```yaml
---
description: "Python WAF coding standards for Azure AI services"
applyTo: "**/*.py"
waf: ["security", "operational-excellence"]
---
```
`applyTo` controls when loaded. Use specific globs — `**/*.py`, `src/api/**`. Never `**` unless truly global.

### 4. Prompts (`*.prompt.md`)
```yaml
---
description: "Generate unit tests for the selected function"
mode: "ask"
tools: ["codebase"]
---
```
Single focused task with `${input:variable}` placeholders. Appears as `/prompt-name` in chat.

### 5. Skills (`SKILL.md` inside named folder)
```yaml
---
name: "provision-infra"
description: "Provision Azure infrastructure using AVM Bicep modules. Use when: deploying, setting up cloud resources, creating landing zones."
---
```
`name` MUST match parent folder name. `description` is the discovery surface — include "Use when:" trigger phrases. Can bundle scripts, templates, and config files as assets.

### 6. Hooks (`*.json`)
```json
{
  "version": 1,
  "hooks": {
    "SessionStart": [{
      "command": "node scripts/inject-context.js",
      "description": "Load play context at session start"
    }]
  }
}
```
Available events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`. **Never use `PreToolUse`** — it spawns a process per tool call (~5s delay each).

### 7. Workflows (`*.yml`)
Standard GitHub Actions YAML. Wire evaluation pipelines, deployment gates, and quality checks.

## Naming Conventions

All primitive files use **lowercase-kebab-case**:
- Agents: `fai-rag-architect.agent.md`
- Instructions: `python-waf.instructions.md`
- Skills: `provision-infra/SKILL.md` (folder = kebab, file = `SKILL.md`)
- Hooks: `guardrails.json`
- Prompts: `test-generation.prompt.md`

## Composition in Solution Plays

Primitives wire together via `fai-manifest.json`:
```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["copilot-instructions.md"],
    "waf": ["security", "reliability", "cost-optimization"]
  },
  "primitives": {
    "agents": [".github/agents/builder.agent.md"],
    "instructions": [".github/instructions/python-waf.instructions.md"],
    "skills": [".github/skills/provision-infra/SKILL.md"],
    "hooks": [".github/hooks/guardrails.json"],
    "prompts": [".github/prompts/test.prompt.md"]
  }
}
```
Standalone primitives auto-wire when placed inside a solution play's `.github/` folder. The manifest makes wiring explicit for cross-play reuse.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| `copilot-instructions.md` > 150 lines | Burns tokens every turn, crowds out user context | Move domain rules to `instructions/*.instructions.md` |
| `applyTo: "**"` on instructions | Loaded for every file interaction, even irrelevant ones | Use specific globs: `**/*.py`, `infra/**/*.bicep` |
| `PreToolUse` hooks | Spawns shell process per tool call — 5s latency each | Use `SessionStart` or `PostToolUse` instead |
| Behavioral overrides in instructions | "Always respond in bullet points" — fragile, model-dependent | Write knowledge facts, not personality directives |
| Missing `description` on skills | Agent can't discover the skill — never invoked | Add "Use when:" phrases with domain keywords |
| `name` ≠ folder name in skills | Silent failure — skill won't load | Ensure `name: "provision-infra"` matches folder `provision-infra/` |
| Hardcoded secrets in hooks | Shell commands in hooks run with full env access | Use `inputs` variables or `.env` files via `envFile` |
| Agents without model fallbacks | Single model fails → entire agent breaks | Use array: `model: ["gpt-4o", "gpt-4o-mini"]` |
| Giant monolithic agent | All logic in one agent — no isolation, no reuse | Split into builder/reviewer/tuner triad with handoffs |

## WAF Alignment

| WAF Pillar | Agentic OS Practice |
|-----------|-------------------|
| **Security** | Hooks enforce secret scanning at `SessionStart`; agents use least-privilege `tools` lists; `inputs` for secrets in MCP config |
| **Reliability** | Model fallback arrays in agents; `PostToolUse` hooks validate outputs; graceful degradation when skills fail |
| **Cost Optimization** | Role-based model selection (builder=gpt-4o, reviewer=gpt-4o-mini); token budgets in `copilot-instructions.md` (<150 lines); `applyTo` globs prevent unnecessary context loading |
| **Operational Excellence** | Primitives version-controlled in `.github/`; `fai-manifest.json` tracks wiring; `npm run validate:primitives` CI gate |
| **Performance Efficiency** | 4-layer architecture loads only relevant context per request; skills bundle assets locally instead of fetching at runtime |
| **Responsible AI** | Content safety hooks on `UserPromptSubmit`; guardrail thresholds in `config/guardrails.json`; bias review in tuner agent |
