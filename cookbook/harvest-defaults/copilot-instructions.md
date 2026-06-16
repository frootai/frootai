---
description: "{play_name} — workspace-level Copilot context (skeleton; see also the play's domain-patterns instruction file)"
applyTo: "**"
---

# {play_name} — Workspace Context

This workspace was scaffolded by the FAI harvest pipeline. The following rules
supplement Copilot's defaults with project conventions. Domain-specific
guidance lives in `.github/instructions/<domain>-patterns.instructions.md`;
cloud-specific guidance in `.github/instructions/<cloud>-coding.instructions.md`;
security guardrails in `.github/instructions/security.instructions.md`.

## Project Posture

- **Primary cloud:** `{primary_cloud}`
- **Play slug:** `{play_slug}`
- **Specialist agents available:** {agents_line}

## File Naming Conventions

- Python: `snake_case.py`
- TypeScript / JavaScript: `camelCase.ts`
- API routes: `kebab-case` (`/api/v1/chat-completion`)
- Config: `kebab-case.json`
- Tests: `test_<module>.py` (Python) or `<module>.test.ts` (TS)
- Bicep: `kebab-case.bicep`
- Terraform: `snake_case.tf`

## Spec & Manifest

Every change must keep `spec/fai-manifest.json` and `spec/play-spec.json`
internally consistent. When adding a new dependency, run the FAI MCP
`validate_config` tool before committing.

## Tests & Evaluation

- Unit tests live in `tests/`
- LLM evaluation lives in `evaluation/`; run `evaluation/eval.py` after
  changes that affect retrieval, prompts, or model selection
- Coverage gate and quality thresholds are defined in
  `config/guardrails.json`

## Slash Commands

| Command     | Action                                              |
|-------------|-----------------------------------------------------|
| `/deploy`   | Deploy infrastructure and configure the app          |
| `/test`     | Run the unit-test suite                              |
| `/review`   | Security + quality review                            |
| `/evaluate` | Run the evaluation pipeline                          |

## Default Agent Roster

| Agent       | Use for                                                  |
|-------------|----------------------------------------------------------|
| `@builder`  | Implement features end-to-end                            |
| `@reviewer` | Security, quality, and policy audit                      |
| `@tuner`    | Configuration, model routing, and evaluation tuning      |

Replace `{tokens}` above with values from `RepoFacts` when emitting a play;
remove this notice afterwards.
