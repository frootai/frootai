---
name: frootai-documentation-writer
description: 'Generates documentation aligned with the FROOT knowledge framework — module-style docs with duration, audience, table of contents, mermaid diagrams, code examples, and key takeaways sections.'
---

# FrootAI Documentation Writer

Generate documentation following the FrootAI FROOT module style.

## Parameters

- **Topic**: ${TOPIC="The subject to document"}
- **Audience**: ${AUDIENCE="Cloud Architects|Platform Engineers|Developers|All"}
- **Duration**: ${DURATION="30 min|60 min|90 min"}
- **FROOT Layer**: ${LAYER="Foundations|Reasoning|Orchestration|Operations|Transformation"}

## Document Template

```markdown
# Module N: [Title] — [Subtitle]

> **Duration:** {DURATION} | **Level:** {Level}
> **Audience:** {AUDIENCE}
> **Part of:** {LAYER_EMOJI} FROOT {LAYER} Layer

---

## N.1 [First Section]
[Content with explanation, context, WHY it matters]

### Subsection
[Deeper detail with code examples]

| Concept | Definition | Example |
|---------|-----------|---------|
| ... | ... | ... |

```mermaid
[Diagram illustrating the concept]
```

## Key Takeaways
1. [Actionable insight]
2. [Actionable insight]
3. [Actionable insight]

---

> **Next:** [Link to next module]
```

## Style Rules

- Write for architects, not academics — practical, opinionated, experience-driven
- Every section answers "why does this matter for MY infrastructure?"
- Code examples must be runnable — no pseudocode, no placeholders
- Mermaid diagrams for architecture, sequence flows, decision trees
- Tables for comparisons (always include a recommendation column)
- Key takeaways start with action verbs

## Advanced Templates

### Architecture Decision Record (ADR)
Use ADR format for documenting key technical decisions:
- Status: Proposed / Accepted / Deprecated / Superseded
- Context: what problem are we solving?
- Decision: what did we choose and why?
- Consequences: positive impacts, negative tradeoffs, risks with mitigations

### API Reference Template
Include for each endpoint: method, path, parameters table, response example, error codes table.

## Diagram Best Practices

### Mermaid Syntax Rules
- Use `graph TD` for top-down architecture (most common)
- Use `sequenceDiagram` for API call flows and agent interactions
- Use `stateDiagram-v2` for lifecycle and workflow states
- Use `C4Context` for system context diagrams
- Keep diagrams under 15 nodes — split complex diagrams into multiple

### Code Example Rules
- All code must compile/run without modification
- Include imports and setup in first example of each language
- Use realistic values (not `foo`, `bar`, `example.com`)
- Show error handling in at least one example per section
- Pin dependency versions in all package references

## Quality Checklist
- [ ] Every section has at least one code example or diagram
- [ ] Tables have a recommendation column where applicable
- [ ] Key takeaways are actionable (start with verb)
- [ ] Duration estimate is realistic for the content depth
- [ ] Cross-references link to actual FrootAI pages or modules
- [ ] No placeholder text (`TODO`, `TBD`, `coming soon`)
- [ ] Glossary terms match F3-AI-Glossary-AZ definitions
- [ ] WAF pillar alignment noted where applicable
