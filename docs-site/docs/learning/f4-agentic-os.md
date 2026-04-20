---
sidebar_position: 4
title: "F4: GitHub Agentic OS"
description: "The .github folder as an agentic operating system — 7 primitives across 4 layers that transform Copilot from an autocompleter into a domain-aware AI teammate."
---

# F4: GitHub Agentic OS

The `.github` folder has evolved from a CI/CD config directory into a full **agentic operating system** for AI coding assistants. This module explains the 7 primitives, 4-layer architecture, and how FrootAI solution plays leverage them. For terminology, see the [AI Glossary](./f3-glossary.md).

## Evolution

What started as a single `copilot-instructions.md` file in 2021 is now a composable OS with 7 primitives across 4 layers — instructions, prompt files, agents, skills, hooks, workflows, and plugins.

## The 4-Layer Architecture

| Layer | Role | Primitives | Always Loaded? |
|-------|------|-----------|----------------|
| **1. Always-On Context** | Background knowledge injected into every request | Instructions (`.instructions.md`) | ✅ Yes |
| **2. On-Demand Capabilities** | Activated when the user or agent invokes them | Prompt Files (`.prompt.md`), Agents (`.agent.md`), Skills (`SKILL.md`) | ❌ On demand |
| **3. Enforcement** | Guardrails and automation that fire on events | Hooks (`hooks.json`) | ✅ On trigger |
| **4. Distribution** | Packaging and sharing of primitives | Plugins (`plugin.json`), Workflows (`.yml`) | ❌ On install |

:::info Mental Model
Think of it like an operating system:

| Traditional OS | .github Agentic OS |
|----------------|-------------------|
| Environment variables | `copilot-instructions.md` |
| Shell scripts | `.prompt.md` files |
| Applications | `.agent.md` agents |
| System calls / APIs | `SKILL.md` skills |
| Kernel hooks / drivers | `hooks.json` |
| Package manager | `plugin.json` |
| Cron jobs / services | Agentic workflows (`.yml`) |
:::

## The 7 Primitives

### 1. Instructions (`.instructions.md`) — Always-On Context

Markdown files with YAML frontmatter that inject domain knowledge into every Copilot interaction matching an `applyTo` glob pattern.

```yaml
---
description: "Python best practices for this project"
applyTo: "**/*.py"
---
# Python Guidelines
- Use type hints on all function signatures
- Prefer `pathlib.Path` over `os.path`
- Use `httpx` instead of `requests` for async HTTP
```

**Key rules:**
- `copilot-instructions.md` is the most expensive file — loaded on every request. Keep it **under 150 lines**.
- Use `applyTo` globs to scope instructions to relevant files only
- Knowledge-only — describe *what*, not *how to behave*

### 2. Prompt Files (`.prompt.md`) — Reusable Prompts

Pre-authored prompts that users invoke explicitly. Support `#variables` for dynamic inputs.

```markdown
---
description: "Generate unit tests for a module"
---
Write comprehensive unit tests for #selection using pytest.
Include edge cases, error conditions, and mock external dependencies.
Target 90% branch coverage.
```

### 3. Custom Agents (`.agent.md`) — Specialized AI Teammates

Agents are personas with specific expertise, tool access, and model preferences.

```yaml
---
description: "Security reviewer for OWASP LLM Top 10"
tools: ["codebase", "terminal", "githubRepo"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ["security"]
plays: ["01-enterprise-rag", "10-content-moderation"]
---
# FAI Security Reviewer
You are a security expert specializing in AI application security...
```

**FrootAI pattern:** Every solution play has a **builder → reviewer → tuner** agent triad.

### 4. Skills (`SKILL.md`) — Multi-Step Procedures

Skills teach agents how to perform complex, multi-step tasks. Each skill lives in its own folder.

```
skills/
└── deploy-to-azure/
    └── SKILL.md       # 150+ lines of step-by-step instructions
```

**Key rules:**
- Skill name (folder) must be lowercase-hyphen
- SKILL.md must be **150+ lines** with detailed steps
- Folder name must match the `name` field in frontmatter

### 5. Hooks (`hooks.json`) — Event-Driven Enforcement

Hooks fire scripts on specific Copilot events. They enforce guardrails automatically.

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "SessionStart",
      "script": "node .github/hooks/validate-env.js",
      "description": "Verify required environment variables on session start"
    }
  ]
}
```

**Available events:** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`

:::warning Never Use PreToolUse Hooks
`PreToolUse` hooks spawn a process on **every single tool call** — adding ~5 seconds of latency each time. A typical Copilot session makes 50+ tool calls. That's 4+ minutes of pure overhead. Use `SessionStart` for validation and `PostToolUse` for auditing instead.
:::

### 6. Agentic Workflows (`.yml`)

GitHub Actions workflows that run AI agents in CI/CD — e.g., automated code review on pull requests using `.agent.md` agents.

### 7. Plugins (`plugin.json`)

Bundles of primitives (agents + skills + instructions) packaged for sharing across projects. Include `name`, `version` (semver), `author`, `license`, and a `primitives` manifest.

## File Naming Convention

All primitives follow **lowercase-hyphen** naming:

| Primitive | Pattern | Example |
|-----------|---------|---------|
| Agent | `kebab-case.agent.md` | `fai-rag-architect.agent.md` |
| Instruction | `kebab-case.instructions.md` | `python-waf.instructions.md` |
| Skill | `kebab-case/SKILL.md` | `deploy-to-azure/SKILL.md` |
| Hook | `kebab-case/hooks.json` | `secrets-scanner/hooks.json` |
| Plugin | `kebab-case/plugin.json` | `enterprise-rag/plugin.json` |

## Play 101 Golden Template Structure

Every FrootAI solution play follows this canonical layout:

```
solution-play-NN/
├── agent.md                           # DevKit: root orchestrator
├── .github/
│   ├── copilot-instructions.md        # under 150 lines, knowledge ONLY
│   ├── agents/                        # builder / reviewer / tuner triad
│   ├── instructions/                  # Domain-specific context
│   ├── prompts/                       # test / review / deploy / evaluate
│   ├── skills/                        # 150+ line multi-step procedures
│   ├── hooks/                         # SessionStart guardrails only
│   └── workflows/                     # CI/CD pipelines
├── config/                            # TuneKit: openai.json, guardrails.json
├── infra/                             # AVM Bicep (Azure plays only)
├── evaluation/                        # Eval pipeline (AI plays)
└── spec/                              # SpecKit: fai-manifest.json + README
```

## FrootAI's FAI Protocol Integration

FrootAI extends the Agentic OS with the **FAI Protocol** — a wiring layer connecting primitives across plays. `fai-manifest.json` declares which agents, skills, and hooks a play uses. `fai-context.json` provides lightweight context blocks (WAF alignment, compatible plays). Shared primitives at the repo root can be wired into multiple plays — one `fai-rag-architect.agent.md` serves Play 01, 21, and 28.

## Key Takeaways

1. **7 primitives, 4 layers** — each primitive has one job; compose them for complex behavior
2. **Instructions are expensive** — `copilot-instructions.md` loads on every request; keep it lean
3. **Agents are cheap** — they only load when invoked; create specialized agents freely
4. **Hooks are dangerous** — `PreToolUse` adds ~5s per tool call; stick to `SessionStart`
5. **Plugins enable sharing** — package your primitives for reuse across projects

**← [F3: AI Glossary](./f3-glossary.md)** | **Next: Explore [Solution Plays](https://frootai.dev/solution-plays) →**
