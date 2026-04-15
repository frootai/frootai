# Contributing to FrootAI

> **From the Roots to the Fruits.**
> The open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem.

Thank you for contributing! FrootAI grows with every contribution.

---

## Ways to Contribute

### 1. New Solution Play

Create a new solution play following the DevKit + TuneKit model with full .github Agentic OS:

```
solution-plays/XX-your-solution/
├── .github/                              # DevKit: Agentic OS (7 primitives)
│   ├── copilot-instructions.md           # L1: Always-on solution context
│   ├── instructions/
│   │   ├── azure-coding.instructions.md  # L1: Azure coding standards
│   │   ├── <play>-patterns.instructions.md  # L1: Play-specific patterns
│   │   └── security.instructions.md      # L1: Security guidelines
│   ├── prompts/                          # L2: 4 slash commands
│   │   ├── deploy.prompt.md
│   │   ├── test.prompt.md
│   │   ├── review.prompt.md
│   │   └── evaluate.prompt.md
│   ├── agents/                           # L2: 3 chained specialists
│   │   ├── builder.agent.md
│   │   ├── reviewer.agent.md
│   │   └── tuner.agent.md
│   ├── skills/                           # L3: Self-contained logic
│   │   ├── deploy-azure/SKILL.md + deploy.sh
│   │   ├── evaluate/SKILL.md
│   │   └── tune/SKILL.md + tune-config.sh
│   ├── hooks/guardrails.json             # L4: Lifecycle enforcement
│   └── workflows/                        # L4: Agentic CI/CD
│       ├── ai-review.md
│       └── ai-deploy.md
├── .vscode/mcp.json + settings.json      # IDE config
├── infra/main.bicep + parameters.json    # DevKit: Azure infrastructure
├── config/openai.json                    # TuneKit: Model parameters
├── config/guardrails.json                # TuneKit: Safety rules
├── config/agents.json                    # TuneKit: Agent behavior tuning
├── config/model-comparison.json          # TuneKit: Model selection guide
├── evaluation/test-set.jsonl + eval.py   # TuneKit: Quality scoring
├── agent.md                              # Agent personality (1500+ bytes)
├── instructions.md                       # System prompts
├── plugin.json                           # Marketplace manifest
├── CHANGELOG.md + README.md              # Documentation
├── mcp/index.js + plugins/README.md      # Legacy compatibility
```

### 2. Improve Existing Plays

- Deepen `agent.md` content (more few-shot examples, better error handling)
- Tune `config/*.json` parameters with real-world production values
- Enhance `evaluation/eval.py` with additional metrics
- Fix or improve `infra/main.bicep` templates with real Azure resource definitions

### 3. Knowledge Modules

- Fix errors in existing modules (`docs/*.md`)
- Add glossary terms to `F3-AI-Glossary-AZ.md`
- Propose new modules via GitHub Issue

### 4. Platform Features

- MCP server tools (`npm-mcp/index.js`)
- VS Code extension features (`vscode-extension/src/extension.js`)
- Website improvements (`website/src/pages/*.tsx`)

---

## Quality Standards

Before submitting, verify your contribution:

- [ ] **agent.md** is 1500+ bytes with: Identity, Rules, Azure Services, Architecture, Tools, Output Format, Error Handling, Few-Shot Examples
- [ ] **.github Agentic OS** has all 19 files (7 primitives, 4 layers)
- [ ] All **config/*.json** files include `_comments` explaining each parameter
- [ ] All **JSON files** parse without errors (`python3 -c "import json; json.load(open('file'))"`)
- [ ] **plugin.json** is valid and has play metadata
- [ ] **README.md** includes architecture diagram, DevKit section, TuneKit section
- [ ] Uses **Managed Identity** (no API keys) for Azure services
- [ ] **UTF-8 encoding** (no BOM) on all files

---

## PR Process

1. **Fork** the repository
2. Create a **feature branch** (`feat/XX-your-solution-play`)
3. Follow the file structure above — CI will validate all files
4. Submit a **Pull Request** targeting the `main` branch
5. CI validation runs automatically:
   - `validate-primitives.yml` — schema, naming, frontmatter, secrets scan
   - `validate-plays.yml` — solution play structure (23 plays)
   - `auto-generate.yml` — marketplace.json regenerated on merge
6. Address review feedback → merge

---

## Branching Strategy

| Branch | Purpose | Who Pushes |
|--------|---------|-----------|
| `main` | Production — always stable, all CI passes | Merge from PRs only |
| `feat/*` | Feature branches for new primitives, plays, or features | Contributors |
| `fix/*` | Bug fixes | Contributors |
| `docs/*` | Documentation updates | Contributors |

**Rules:**
- Never push directly to `main` — always via PR
- All PRs require `validate-primitives` to pass (0 errors)
- Squash merge preferred for clean history
- Delete feature branches after merge

**Future consideration:** As the community grows, we may adopt a **staged→main** model where:
- `staged` is the development branch (PRs target here)
- `main` is the published artifact (force-pushed from staged after CI build)
- This ensures `main` always has regenerated marketplace.json, docs, and validated state
- Currently not needed — direct-to-main with CI gates is sufficient for our scale

---

## Contributing Standalone Primitives

Beyond solution plays, you can contribute individual primitives:

### Agents (`agents/`)

```bash
node scripts/scaffold-primitive.js agent
# Follow prompts → creates .agent.md + fai-context.json
npm run validate:primitives     # Verify
```

Requirements: `description` (10+ chars), kebab-case filename, WAF alignment recommended.

### Instructions (`instructions/`)

```bash
node scripts/scaffold-primitive.js instruction
# Follow prompts → creates .instructions.md with applyTo
npm run validate:primitives
```

Requirements: `description` + `applyTo` glob pattern in frontmatter.

### Skills (`skills/`)

```bash
node scripts/scaffold-primitive.js skill
# Follow prompts → creates folder/SKILL.md
npm run validate:primitives
```

Requirements: `name` matches folder, `description` 10-1024 chars.

### Hooks (`hooks/`)

```bash
node scripts/scaffold-primitive.js hook
# Follow prompts → creates folder/hooks.json + script
npm run validate:primitives
```

Requirements: `version: 1`, valid events, bash script exists.

---

## Naming Conventions

| Term | Meaning |
|------|---------|
| **DevKit** | Build + Deploy ecosystem (.github Agentic OS + infra) |
| **TuneKit** | AI Fine-Tuning ecosystem (config/ + evaluation/) |
| **FROOT** | Foundations · Reasoning · Orchestration · Operations · Transformation |
| **.github Agentic OS** | 7 primitives: instructions, prompts, agents, skills, hooks, workflows, plugins |

---

## Code of Conduct

- Be respectful and constructive
- Focus on the infra/platform audience
- Quality over quantity — one deeply customized play beats ten skeletons
- MIT License — all contributions are MIT-licensed

---

## Contribution License

By submitting a pull request, you agree that your contribution is licensed under the [MIT License](./LICENSE) and may be incorporated into FrootAI. You retain credit for your work — we celebrate contributors! 🎉
