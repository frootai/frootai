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
- VS Code extension features ([`frootai-core/vscode-extension/src/extension.ts`](https://github.com/frootai/frootai-core/tree/main/vscode-extension) — published as `frootai-vscode` on the Marketplace; `frootai/vscode-extension/` here is asset CDN only)
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

## Contributing MCP Specs

MCP attach specs in [`orchard/registry/mcp-specs/`](orchard/registry/mcp-specs/)
are first-class community contributions — they let any FrootAI user
attach an MCP server with one config line. The community-tier flow is
designed so a non-FrootAI publisher can land a spec **without** founder
mediation; promotion to `verified-publisher` is a separate, deliberate
follow-up.

### Where to start

1. **Read the front door**:
   [`frootai-core/docs/contributing-mcp-specs.md`](https://github.com/frootai/frootai-core/blob/main/docs/contributing-mcp-specs.md) ([X5.2])
   — the canonical authoring guide with the community-tier section.
2. **Walk a worked example**:
   [`cookbook/27-submit-mcp-spec.md`](cookbook/27-submit-mcp-spec.md) ([X5.28])
   — 6 numbered steps from `frootai mcp test <slug>` to merged-and-rendering.
3. **Open the PR** using
   [`.github/PULL_REQUEST_TEMPLATE/mcp-spec.md`](.github/PULL_REQUEST_TEMPLATE/mcp-spec.md) ([X5.1])
   — auto-applies labels `mcp-spec`, `community`, `needs-founder-review`
   and assigns `@pavle`.

### What gates your PR

Three sequential workflows run on every push touching `mcp-specs/`:

- **Anti-abuse** ([X5.13]) — ≤3 open PRs per author + sock-puppet check.
- **Tier-escalation guard** ([X5.12]) — no-op for bare community submissions;
  fires only when a PR raises a publisher's trust tier.
- **PR triage** ([X5.8]) — ajv-cli schema validation against
  `mcp-spec-v1.schema.json`, doctrine #2 publisher cross-check against
  the trust manifest, [X5.6] attach-test dry-run. Posts a sticky summary
  comment.

A maintainer reviews within the [X5.9] 14-day SLA.

### Sister flows (separate PRs)

- **Promotion `community → verified-publisher`** → use the dedicated
  [`tier-promotion.md`](.github/PULL_REQUEST_TEMPLATE/tier-promotion.md)
  PR template; walkthrough at
  [`docs/tier-promotion.md`](https://github.com/frootai/frootai-core/blob/main/docs/tier-promotion.md) ([X5.11]).
- **Handing off maintenance** → use
  [`ownership-transfer.md`](.github/PULL_REQUEST_TEMPLATE/ownership-transfer.md);
  walkthrough at
  [`docs/ownership-transfer.md`](https://github.com/frootai/frootai-core/blob/main/docs/ownership-transfer.md) ([X5.24]).
- **Reporting breakage / requesting a snapshot refresh** → open an issue
  with [`mcp-spec-issue.md`](.github/ISSUE_TEMPLATE/mcp-spec-issue.md) ([X5.25]).

### Anti-bundling rule

Each PR does exactly **one thing**: ship a spec, OR promote a tier, OR
transfer ownership. Bundling escalates review complexity disproportionately
and the [X5.12] escalation guard will block the PR until the trust change
is separated out.

### Trust posture

Community-tier specs attach **with a per-call prompt**
(`attachWithoutPrompt: false`) — the user reads a clear elicitation before
the transport spawns. That's the safer-by-default posture and exactly what
the [X5.2] guide promises. Promotion to `verified-publisher` removes the
prompt; see the [§5.4 trust criteria](https://github.com/frootai/frootai-core/blob/main/docs/internal/trust-assignment-criteria.md)
for the substantive-signal bar.

### Spec lifecycle (after merge)

- Nightly attach validation against the upstream server ([X2.12]).
- 14-day flag → 90-day archive cascade for unmaintained servers
  ([X5.18] → [X5.19]); full policy in
  [`docs/spec-deprecation.md`](https://github.com/frootai/frootai-core/blob/main/docs/spec-deprecation.md) ([X5.23]).
- Per-spec shields.io badges for your upstream README ([X5.26]).
- Marketplace listing on `frootai.dev/ecosystem/mcp/marketplace/<slug>`
  with contributor list, freshness stamps, and a "Help improve this spec"
  CTA when inferred.

---

## Naming Conventions

| Term | Meaning |
|------|---------|
| **DevKit** | Build + Deploy ecosystem (.github Agentic OS + infra) |
| **TuneKit** | AI Fine-Tuning ecosystem (config/ + evaluation/) |
| **FROOT** | Foundations · Reasoning · Orchestration · Operations · Transformation |
| **.github Agentic OS** | 7 primitives: instructions, prompts, agents, skills, hooks, workflows, plugins |

---

## Becoming a Champion

Consistent contributors are hand-picked for the **[FrootAI Champions Program](./CHAMPIONS.md)** — a recognised cohort of community members who embody our culture of kindness, quality, and craft. Champions get monthly calls with the founder, early access to new features, co-authorship opportunities, and more. Read the full charter: **[CHAMPIONS.md](./CHAMPIONS.md)**.

---

## Code of Conduct

- Be respectful and constructive — see our full **[Code of Conduct](./CODE_OF_CONDUCT.md)**.
- Focus on the infra/platform audience
- Quality over quantity — one deeply customized play beats ten skeletons
- MIT License — all contributions are MIT-licensed

---

## Contribution License

By submitting a pull request, you agree that your contribution is licensed under the [MIT License](./LICENSE) and may be incorporated into FrootAI. You retain credit for your work — we celebrate contributors! 🎉
