# Deep Wiki — Templates & Section Outlines

Reference templates for `fai-deep-wiki-generator`. Load the section the current phase needs.

## Index hub

`wiki/index.md` — landing page with project summary and a guide selector table.

```markdown
# {Project Name}

{One-paragraph summary: what it does, who it's for, key technologies. Dense and informative.}

| Guide | Audience | Reading time |
|-------|----------|--------------|
| [Contributor Guide](./onboarding/contributor-guide.md) | New contributors | 20 min |
| [Staff Engineer Guide](./onboarding/staff-engineer-guide.md) | Senior/staff engineers | 35 min |
| [Executive Guide](./onboarding/executive-guide.md) | Eng leaders | 10 min |
| [Product Manager Guide](./onboarding/product-manager-guide.md) | PMs | 15 min |

## Architecture
- [Overview](./architecture/overview.md) — system design & deployment topology
- [Data Model](./architecture/data-model.md) — entities, relationships, invariants
- [API Reference](./architecture/api-reference.md) — endpoints, auth, wire format
```

## Audience guides

### Contributor guide (assumes Python or JS background)
1. **Big picture** — one-sentence summary, core entities table, architecture `graph TB`.
2. **Development environment setup** — prerequisites table (Tool, Version, Install command), steps, common mistakes.
3. **Your first task** — end-to-end walkthrough of adding a simple feature.
4. **Development workflow** — branch strategy, commit conventions, PR process (`flowchart`).
5. **Running tests** — all tests, single file, single test, coverage commands.
6. **Debugging guide** — common issues table: Symptom, Cause, Fix.
7. **Common pitfalls** — mistakes every new contributor makes and how to avoid them.

### Staff engineer guide
1. **Architecture deep-dive** — boundaries, deployment topology, design decisions & trade-offs.
2. **Domain model & data flow** — `erDiagram`, data invariants, `sequenceDiagram` for the primary request lifecycle.
3. **Component types** — categories of components and when to use each.
4. **Failure modes** — how the system fails, blast radius, and recovery.
5. **Key patterns** — "If you want to add X, follow this pattern" with real code.

### Executive guide
Capability overview, risk assessment, technology investment, and scaling model. No code.

### Product manager guide
User journeys, capabilities, limitations, data/privacy. Feature-focused, not code-focused.

## Architecture page

```markdown
# Architecture Overview

​```mermaid
graph TB
  A[Client] --> B[API]
  B --> C[(Database)]
​```
<!-- Sources: src/app.ts:1, src/server.ts:1 -->

## Key Files
| File | Purpose | Source |
|------|---------|--------|
| `src/main.ts` | Entry point | [src/main.ts:1](REPO_URL/blob/BRANCH/src/main.ts#L1) |

## Tech Stack
| Technology | Purpose |
|-----------|---------|
| TypeScript | Primary language |
```

## llms.txt

```markdown
# {Project Name}
> {One-paragraph summary: what it does, who it's for, key technologies. Dense.}

{2-3 paragraphs of context: architectural philosophy, key constraints, what makes this project
different. What an LLM needs to give accurate answers about this project.}

## Onboarding
- [Contributor Guide](./onboarding/contributor-guide.md): env setup, first task, testing, conventions
- [Staff Engineer Guide](./onboarding/staff-engineer-guide.md): design decisions, domain model, failure modes

## Architecture
- [Overview](./architecture/overview.md): system architecture & deployment topology
- [Data Model](./architecture/data-model.md): core entities, relationships, invariants

## Getting Started
- [Setup](./01-getting-started/setup.md): prerequisites, installation, first run
- [Configuration](./01-getting-started/configuration.md): env vars, feature flags

## Optional
- [Changelog](./changelog.md): recent changes
- [Contributing](./contributing.md): how to contribute
```

## AGENTS.md generation report

```markdown
## AGENTS.md Generation Report
### Created
- `./AGENTS.md` — root project instructions
- `tests/AGENTS.md` — test harness instructions
### Skipped (already exist)
- `src/AGENTS.md`
### Not applicable
- `dist/` — generated output
```
