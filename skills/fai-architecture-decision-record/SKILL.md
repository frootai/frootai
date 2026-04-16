---
name: fai-architecture-decision-record
description: Generate Architecture Decision Records capturing context, forces, decision rationale, rejected alternatives, and consequences — preventing knowledge rot when teams diverge from original design intent.
---

# FAI Architecture Decision Record

Produces MADR (Markdown Architectural Decision Record) format ADRs that capture the full decision context, considered options, and trade-offs. Prevents knowledge rot — the silent killer where teams six months later cannot explain why the architecture looks the way it does.

## When to Invoke

| Signal | Example |
|--------|---------|
| Choosing between two viable approaches | Vector DB vs AI Search for RAG |
| Making a breaking infrastructure decision | Move from PAYG to PTU |
| Selecting a framework or library | LangChain vs Semantic Kernel |
| Any decision that would be hard to reverse | Data storage format, API versioning strategy |

## MADR Template

```markdown
# ADR-{NUMBER}: {Title}

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-{N}
**Date:** {YYYY-MM-DD}
**Deciders:** {names or team}
**Tags:** infrastructure, ai, security, cost, performance

## Context and Problem Statement

{One paragraph: what situation forced this decision? What constraint or requirement is in tension?}

## Decision Drivers

- {Primary constraint or goal}
- {Secondary constraint or goal}
- {Quality attribute being optimised: latency, cost, security}

## Considered Options

| Option | Description |
|--------|-------------|
| A | {Name} -- {one-line description} |
| B | {Name} -- {one-line description} |
| C | {Name} -- {one-line description} |

## Decision Outcome

**Chosen option: {A/B/C}**, because {rationale -- which decision drivers it satisfies best}.

### Positive Consequences
- {What improves or becomes possible}

### Negative Consequences
- {What gets harder, more expensive, or more risky}

## Pros and Cons of the Options

### Option A -- {Name}
- Pro: {advantage}
- Con: {disadvantage}

### Option B -- {Name}
- Pro: {advantage}
- Con: {disadvantage}

## Links
- Supersedes: ADR-{N} (if applicable)
- Related: ADR-{N} (if applicable)
- Implementation: {PR or commit link}
```

## Example: Choosing a Vector Search Service

```markdown
# ADR-007: Vector Search -- Azure AI Search vs Dedicated Vector DB

**Status:** Accepted
**Date:** 2025-04-10
**Deciders:** Platform Team
**Tags:** infrastructure, ai, cost

## Context and Problem Statement

Play 01 (Enterprise RAG) requires a vector store that supports hybrid search,
semantic ranking, and RBAC -- integrated with the existing Azure landing zone.
Latency budget: <200ms at P99 for top-5 retrieval.

## Decision Drivers

- Managed Identity integration with Azure (no secrets)
- Hybrid BM25 + vector recall >= pure vector
- Single Azure bill (no additional vendor)

## Considered Options

| Option | Description |
|--------|-------------|
| A | Azure AI Search -- Azure-native, hybrid, semantic ranker |
| B | Pinecone -- Managed vector DB, REST API |
| C | pgvector -- Self-hosted in PostgreSQL Flexible Server |

## Decision Outcome

**Chosen option: A**, because it satisfies Managed Identity, hybrid search,
and billing consolidation with no additional infrastructure.

### Positive Consequences
- Zero credential management -- Managed Identity to AI Search
- Semantic ranker reduces chunk hallucination

### Negative Consequences
- Vendor lock-in to Azure ecosystem
- Semantic ranker adds ~30ms median latency
```

## ADR File Naming and Storage

```bash
# Convention: docs/adr/NNNN-kebab-title.md
docs/adr/
  0001-use-azure-ai-search-for-rag.md
  0002-managed-identity-over-api-keys.md
  0007-vector-search-azure-ai-search-vs-pinecone.md

# Status lifecycle transitions:
# Proposed -> Accepted (after team review)
# Accepted -> Deprecated (feature retired)
# Accepted -> Superseded by ADR-0012 (replaced decision)
```

## Multi-ADR Consistency Check

```python
import re
from pathlib import Path

def check_adr_consistency(adr_dir: str = "docs/adr") -> list[str]:
    """Flag ADRs that reference non-existent superseding ADRs."""
    issues = []
    adrs = {p.stem: p.read_text() for p in Path(adr_dir).glob("*.md")}
    for name, content in adrs.items():
        refs = re.findall(r"Superseded by ADR-(\d+)", content)
        for ref_num in refs:
            target = next((k for k in adrs if k.startswith(ref_num.zfill(4))), None)
            if target is None:
                issues.append(f"{name}: references non-existent ADR-{ref_num}")
    return issues

if __name__ == "__main__":
    problems = check_adr_consistency()
    for p in problems:
        print(f"  WARN: {p}")
    print(f"ADR consistency: {len(problems)} issue(s) found")
```

## ADR Review Workflow

```bash
# Propose a new ADR
cp docs/adr/TEMPLATE.md docs/adr/0008-choose-orchestration-framework.md
# Edit, set Status: Proposed, open PR

# Accept after team review
sed -i 's/Status: Proposed/Status: Accepted/' docs/adr/0008-*.md
git commit -m "docs: accept ADR-0008 -- LangChain for RAG orchestration"

# Supersede when a decision changes
sed -i 's/Status: Accepted/Status: Superseded by ADR-0015/' docs/adr/0008-*.md
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Operational Excellence | Committed ADRs create an audit trail enabling confident refactors without institutional knowledge loss |
| Security | Security-tagged ADRs prevent accidental reversion to insecure patterns during refactoring |
| Cost Optimization | Cost-tagged ADRs make FinOps reviews grounded in documented rationale, not guesswork |

## Compatible Solution Plays

- **Play 02** — AI Landing Zone (infrastructure decisions)
- **Play 01** — Enterprise RAG (retrieval strategy decisions)
- All plays — applicable as a cross-cutting documentation pattern

## Notes

- Start numbering at 0001 and zero-pad to 4 digits for sort-friendly file names
- Update the `Status` field in-place; do not create amendment ADRs
- ADRs are immutable records -- never delete; use Superseded status instead
- The `check_adr_consistency` script can run in CI to catch broken references
