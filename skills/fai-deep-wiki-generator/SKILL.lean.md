---
name: fai-deep-wiki-generator
description: |
  Generate a deep, audience-segmented onboarding wiki for any codebase — repo scan, index hub, contributor/staff-engineer/executive/PM guides, architecture overview with Mermaid diagrams, source-cited key files, and an llms.txt.
  USE FOR: onboarding new contributors, documenting an unfamiliar codebase, generating architecture docs, producing an llms.txt or AGENTS.md, creating audience-specific guides (exec, PM, staff engineer), refreshing stale internal docs.
  DO NOT USE FOR: end-user product documentation, API reference from OpenAPI (use fai-api-docs-generator), single-file code walkthroughs (use fai-comment-tutorial), marketing copy.
  Triggers: "onboarding guide", "deep wiki", "document this repo", "architecture docs", "llms.txt", "AGENTS.md", "contributor guide", "explain the codebase", "wiki".
---

# Deep Wiki Generator

Produce a structured, audience-segmented onboarding wiki from a codebase — grounded
in the actual repo, with Mermaid diagrams and source citations, not generic advice.

## Workflow

### Phase 1 — Scan the repo (ground everything in reality)
Identify language, frameworks, entry points, structure, key technologies, and test setup
in one pass. Record exact file paths — every claim in the wiki must cite a real file.

```bash
find . -maxdepth 3 -type f \( -name "*.md" -o -name "package.json" -o -name "pyproject.toml" \
  -o -name "Cargo.toml" -o -name "*.csproj" -o -name "go.mod" -o -name "Dockerfile" \
  -o -name "*.yml" -o -name "*.yaml" \) | head -50
```

### Phase 2 — Index hub (`wiki/index.md`)
A landing page with a one-paragraph project summary and a **guide selector table** linking to
each audience guide with a description and estimated reading time. See
[references/wiki-templates.md](references/wiki-templates.md#index-hub).

### Phase 3 — Audience guides
Generate only the guides the user needs (default: contributor + staff-engineer):
- **Contributor** — env setup, first task, dev workflow, running tests, common pitfalls.
- **Staff engineer** — architecture deep-dive, domain model, component types, failure modes.
- **Executive** — capability overview, risk, investment, scaling model.
- **Product manager** — user journeys, capabilities, limitations, data/privacy.

Templates + section outlines: [references/wiki-templates.md](references/wiki-templates.md#audience-guides).

### Phase 4 — Architecture (`wiki/architecture/`)
Overview (`graph TB`), data model (`erDiagram`), and primary request lifecycle (`sequenceDiagram`).
Every diagram is followed by a `<!-- Sources: path:line -->` citation. Provide
"If you want to add X, follow this pattern" templates with **real code from the repo**.

### Phase 5 — Machine-readable outputs
- **`llms.txt`** — project name + dense one-paragraph summary + 2-3 paragraphs of architectural
  context + categorized relative links. Structure: [references/wiki-templates.md](references/wiki-templates.md#llms-txt).
- **`AGENTS.md`** (+ optional `CLAUDE.md` pointer) — agent operating instructions for the repo.
  Skip files that already exist; report created/skipped/not-applicable.

### Phase 6 — Validate before finalizing
- Every key-file reference resolves to a real path (`test -f`).
- Every Mermaid block parses (no syntax errors).
- The index links to every generated guide.
Fix and re-check until all pass, then summarize what was created.

## Gotchas
- **Cite real files.** "The user service lives in `src/services/user.py:12`" beats "there is a
  user service." Unverifiable claims erode trust in the whole wiki.
- **Technical over marketing.** The landing page is for engineers — lead with quick-start and
  architecture, not value propositions.
- **Generate selectively.** Don't produce all four audience guides unless asked; extra guides
  dilute attention and go stale.
- **Diagrams need sources.** A `sequenceDiagram` without a `<!-- Sources: -->` line is a guess.
- **Idempotent.** Skip files that already exist unless the user asks to overwrite; report skips.
