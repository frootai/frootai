---
description: "Legal Document AI domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Legal Document AI — Domain Knowledge

This workspace implements AI for legal documents — contract review, clause extraction, risk scoring, compliance checking, redlining suggestions, and privilege-aware document handling.

## Legal AI Architecture (What the Model Gets Wrong)

### Contract Review Pipeline
```python
async def review_contract(document: bytes) -> ContractReview:
    # 1. Extract structured content (layout-aware)
    content = await extract_with_layout(document)
    
    # 2. Classify contract type
    contract_type = await classify(content)  # NDA, MSA, SLA, employment, lease
    
    # 3. Extract key clauses
    clauses = await extract_clauses(content, contract_type)
    # Returns: indemnification, liability_cap, termination, IP_assignment, non_compete, confidentiality
    
    # 4. Risk scoring per clause
    risks = []
    for clause in clauses:
        risk = await score_risk(clause, benchmark=industry_standards[contract_type])
        risks.append(RiskItem(clause=clause.name, score=risk.score, explanation=risk.explanation, suggestion=risk.fix))
    
    # 5. Generate redline suggestions
    redlines = await suggest_redlines(clauses, risks, favorable_to="our_company")
    
    return ContractReview(type=contract_type, clauses=clauses, risks=risks, redlines=redlines)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM makes legal conclusions | Unauthorized practice of law (UPL) risk | "Suggestion for attorney review" — never "legal advice" |
| No privilege markers | Attorney-client privilege may be waived | Mark all AI outputs as "Draft — Attorney Work Product" |
| Generic risk scoring | Different standards per contract type | Benchmark against industry-specific clause libraries |
| Full contract in LLM context | Token overflow on 50-page contracts | Process clause-by-clause, not entire document |
| No version comparison | Can't track changes between drafts | Structured diff between contract versions |
| Ignore jurisdiction | Law varies by state/country | Include jurisdiction context in analysis |
| No human review | AI misses nuanced legal implications | AI suggests → attorney reviews → client decides |
| PII in contracts | Names, SSN, financial data exposed | De-identify before AI processing, re-identify in output |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Model (GPT-4o for legal reasoning), temperature=0 |
| `config/guardrails.json` | Clause libraries, risk thresholds, privilege markers |
| `config/agents.json` | Contract type definitions, jurisdiction rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement clause extraction, risk scoring, redlining |
| `@reviewer` | Audit UPL compliance, privilege handling, accuracy |
| `@tuner` | Optimize clause detection, risk calibration, throughput |

## Slash Commands
`/deploy` — Deploy legal AI | `/test` — Test with sample contracts | `/review` — Audit compliance | `/evaluate` — Measure extraction accuracy
