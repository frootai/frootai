---
sidebar_position: 1
title: How to Contribute
description: Contribute to FrootAI — add agents, skills, solution plays, documentation, and platform features. Fork, branch, PR workflow.
---

# How to Contribute

FrootAI is open source under the MIT License and grows with every contribution. Whether you're adding a new agent, creating a solution play, or fixing a typo — we welcome it all.

## Ways to Contribute

### 1. New Solution Play

Create a complete, deployable AI solution with the full DevKit + TuneKit + SpecKit structure:

```
solution-plays/XX-your-solution/
├── .github/                              # DevKit: Agentic OS
│   ├── copilot-instructions.md           # Always-on solution context
│   ├── agents/                           # builder, reviewer, tuner
│   ├── instructions/                     # Coding standards
│   ├── prompts/                          # Slash commands
│   ├── skills/                           # Step-by-step procedures
│   └── hooks/                            # Security guardrails
├── config/                               # TuneKit
│   ├── openai.json                       # Model parameters
│   └── guardrails.json                   # Quality thresholds
├── spec/                                 # SpecKit
├── infra/                                # Azure Bicep
├── evaluation/                           # Quality pipeline
├── fai-manifest.json                     # FAI Protocol wiring
└── README.md                             # Documentation
```

### 2. Standalone Primitives

Add individual agents, skills, instructions, or hooks to the shared repository:

```bash
# Scaffold a new primitive interactively
node scripts/scaffold-primitive.js agent
node scripts/scaffold-primitive.js skill
node scripts/scaffold-primitive.js instruction
node scripts/scaffold-primitive.js hook

# Validate after creation
npm run validate:primitives
```

### 3. Improve Existing Plays

- Deepen `agent.md` content with more few-shot examples and error handling
- Tune `config/*.json` parameters with real-world production values
- Enhance evaluation pipelines with additional metrics
- Fix or improve `infra/main.bicep` templates with real Azure resource definitions

### 4. Documentation & Knowledge

- Fix errors in existing knowledge modules (`docs/*.md`)
- Add glossary terms to `F3-AI-Glossary-AZ.md`
- Improve cookbook recipes in `cookbook/`
- Propose new modules via GitHub Issue

### 5. Platform Features

- MCP server tools (`mcp-server/`)
- VS Code extension features (`vscode-extension/`)
- CLI commands
- Website improvements

## PR Workflow

1. **Fork** the repository on GitHub
2. **Clone** your fork locally

```bash
git clone https://github.com/YOUR_USERNAME/frootai.git
cd frootai
npm install
```

3. **Create a feature branch**

```bash
git checkout -b feat/XX-your-solution-play
```

4. **Make your changes** following [naming conventions](./naming-conventions) and the [PR checklist](./pr-checklist)

5. **Validate** before committing

```bash
npm run validate:primitives  # Must pass with 0 errors
```

6. **Commit** using conventional commits

```bash
git commit -m "feat: add Play XX - Your Solution Play"
```

7. **Push** and open a Pull Request targeting `main`

```bash
git push origin feat/XX-your-solution-play
```

:::info
CI validation runs automatically on every PR:
- `validate-primitives.yml` — schema, naming, frontmatter, secrets scan
- `validate-plays.yml` — solution play structure validation
- `auto-generate.yml` — marketplace.json regenerated on merge
:::

## Branching Strategy

| Branch | Purpose | Who Pushes |
|--------|---------|-----------|
| `main` | Production — always stable, all CI passes | Merge from PRs only |
| `feat/*` | New primitives, plays, or features | Contributors |
| `fix/*` | Bug fixes | Contributors |
| `docs/*` | Documentation updates | Contributors |

**Rules:**
- Never push directly to `main` — always via PR
- All PRs require `validate-primitives` to pass (0 errors)
- Squash merge preferred for clean history
- Delete feature branches after merge

## Quality Standards

Before submitting, verify your contribution:

- [ ] All **JSON files** parse without errors
- [ ] **Frontmatter** has required fields per primitive type
- [ ] Uses **Managed Identity** (no API keys) for Azure services
- [ ] **UTF-8 encoding** (no BOM) on all files
- [ ] `npm run validate:primitives` passes with **0 errors**
- [ ] File naming follows **lowercase-hyphen** convention

## Code of Conduct

- Be respectful and constructive
- Focus on the infra/platform audience
- Quality over quantity — one deeply customized play beats ten skeletons
- MIT License — all contributions are MIT-licensed

## Contribution License

By submitting a pull request, you agree that your contribution is licensed under the [MIT License](https://github.com/frootai/frootai/blob/main/LICENSE) and may be incorporated into FrootAI. You retain credit for your work.

## Next Steps

- **[Naming Conventions](./naming-conventions)** — file naming rules for all primitives
- **[PR Checklist](./pr-checklist)** — what CI validates on every PR
- **[Your First Solution Play](../getting-started/first-play)** — build a play to contribute
