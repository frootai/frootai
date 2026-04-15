---
name: fai-architecture-decision-record
description: |
  Create Architecture Decision Records (ADRs) with decision context, alternatives analysis,
  tradeoffs, and measurable acceptance criteria. Use when making significant technical
  decisions that should be documented for future reference.
---

# Architecture Decision Record (ADR) Generator

Create structured ADRs that capture the context, alternatives, and rationale behind technical decisions.

## When to Use

- Choosing between competing technologies or approaches
- Changing established patterns or conventions
- Making decisions with long-term consequences
- Any decision where "why did we do this?" will be asked later

---

## ADR Template

```markdown
# ADR-{NUMBER}: {TITLE}

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-{N}
**Date:** YYYY-MM-DD
**Decision Makers:** {names}
**Tags:** {architecture, security, infrastructure, ...}

## Context

{What is the issue? What forces are at play? What constraints exist?}

## Decision

{What is the change being proposed or decided?}

## Alternatives Considered

### Option A: {Name}
- **Pros:** {list}
- **Cons:** {list}
- **Cost:** {estimate}
- **Risk:** {assessment}

### Option B: {Name}
- **Pros:** {list}
- **Cons:** {list}
- **Cost:** {estimate}
- **Risk:** {assessment}

## Tradeoffs

| Dimension | Option A | Option B | Chosen |
|-----------|----------|----------|--------|
| Latency | Lower | Higher | A |
| Cost | Higher | Lower | B |
| Complexity | Higher | Lower | B |

## Consequences

- **Positive:** {what improves}
- **Negative:** {what gets harder}
- **Risks:** {what could go wrong}

## Acceptance Criteria

- [ ] {Measurable criterion 1}
- [ ] {Measurable criterion 2}
- [ ] {Measurable criterion 3}

## Review Date

{When should this decision be revisited? 6 months? 1 year?}
```

## Automation: Generate ADR from Code

```python
from pathlib import Path
from datetime import date

def create_adr(number: int, title: str, context: str,
               decision: str, alternatives: list[dict],
               output_dir: str = "docs/adr") -> str:
    """Generate an ADR markdown file."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    filename = f"adr-{number:04d}-{title.lower().replace(' ', '-')}.md"
    filepath = Path(output_dir) / filename

    alt_sections = []
    for alt in alternatives:
        alt_sections.append(f"""### Option: {alt['name']}
- **Pros:** {', '.join(alt.get('pros', []))}
- **Cons:** {', '.join(alt.get('cons', []))}
- **Risk:** {alt.get('risk', 'Unknown')}""")

    content = f"""# ADR-{number:04d}: {title}

**Status:** Proposed
**Date:** {date.today().isoformat()}

## Context

{context}

## Decision

{decision}

## Alternatives Considered

{chr(10).join(alt_sections)}

## Acceptance Criteria

- [ ] Decision validated in dev environment
- [ ] Performance impact measured
- [ ] Security review completed

## Review Date

{date.today().year + 1}-{date.today().month:02d}-01
"""
    filepath.write_text(content)
    return str(filepath)
```

## ADR Index Generator

```bash
# Generate ADR index from existing files
echo "# Architecture Decision Records" > docs/adr/README.md
echo "" >> docs/adr/README.md
echo "| # | Title | Status | Date |" >> docs/adr/README.md
echo "|---|-------|--------|------|" >> docs/adr/README.md
for f in docs/adr/adr-*.md; do
  num=$(head -1 "$f" | grep -oP 'ADR-\d+')
  title=$(head -1 "$f" | sed 's/# ADR-[0-9]*: //')
  status=$(grep -oP '(?<=\*\*Status:\*\* )\w+' "$f")
  dt=$(grep -oP '(?<=\*\*Date:\*\* )\S+' "$f")
  echo "| $num | [$title]($f) | $status | $dt |" >> docs/adr/README.md
done
```

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Always list alternatives | Forces honest comparison, prevents confirmation bias |
| Include measurable criteria | Makes it clear when to revisit the decision |
| Set review dates | Prevents stale decisions from persisting forever |
| Link to evidence | Reference benchmarks, spikes, or prototypes |
| Keep ADRs immutable | Supersede, don't edit — maintain decision history |
