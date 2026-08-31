## Description

<!-- What does this PR do? Which solution play does it add/modify? -->

## Type of Change

- [ ] New Solution Play (`solution-plays/XX-name/`)
- [ ] Improvement to existing play
- [ ] Knowledge module (docs/)
- [ ] Protocol, schema, or conformance change
- [ ] Public primitive or community plugin
- [ ] Public registry or integration contract
- [ ] Bug fix
- [ ] Documentation update

## Repository Boundary

- [ ] I read the [public repository scope](https://github.com/frootai/frootai/blob/main/REPOSITORY_SCOPE.md).
- [ ] This PR does not add VS Code, CLI, hosted-service, Engine, Factory, private plugin-runtime, or release-system implementation.
- [ ] This PR contains no credentials, customer data, production configuration, or private repository material.
- [ ] Any generated public artifact identifies its canonical source and can be reproduced by the controlled release system.

## Solution Play Checklist (if applicable)

### DevKit (.github Agentic OS)
- [ ] `copilot-instructions.md` — L1 always-on context
- [ ] `instructions/*.instructions.md` — 3 modular instruction files
- [ ] `prompts/*.prompt.md` — 4 slash commands (deploy, test, review, evaluate)
- [ ] `agents/*.agent.md` — 3 chained agents (builder, reviewer, tuner)
- [ ] `skills/*/SKILL.md` — 3 skill folders (deploy-azure, evaluate, tune)
- [ ] `hooks/guardrails.json` — L4 lifecycle enforcement
- [ ] `workflows/*.md` — 2 agentic workflows (ai-review, ai-deploy)
- [ ] `.vscode/mcp.json` + `settings.json`
- [ ] `infra/main.bicep` + `parameters.json`
- [ ] `agent.md` — 1500+ bytes, real content (not skeleton)
- [ ] `plugin.json` — marketplace manifest

### TuneKit
- [ ] `config/openai.json` with `_comments`
- [ ] `config/guardrails.json` with `_comments`
- [ ] `config/agents.json` with `_comments`
- [ ] `config/model-comparison.json` with `_comments`
- [ ] `evaluation/test-set.jsonl` — ground truth tests
- [ ] `evaluation/eval.py` — quality scoring script

### Quality
- [ ] All JSON files parse without errors
- [ ] Uses Managed Identity (no API keys)
- [ ] UTF-8 encoding (no BOM)
- [ ] No hardcoded secrets or credentials

## Testing

<!-- How did you verify this works? -->

## Screenshots (if applicable)

<!-- For public documentation, catalog, or community-facing presentation changes -->
