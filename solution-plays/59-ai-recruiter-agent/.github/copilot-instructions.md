---
description: "AI Recruiter Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Recruiter Agent — Domain Knowledge

This workspace implements an AI recruiter agent — resume parsing, candidate matching, job description generation, interview scheduling, and bias-aware screening with explainable scoring.

## Recruiter AI Architecture (What the Model Gets Wrong)

### Bias-Aware Candidate Scoring
```python
class CandidateScore(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    skill_match: float           # Skills vs job requirements
    experience_match: float      # Years + relevance
    education_match: float       # Degree + field relevance
    factors: list[ScoringFactor] # Explainable factors
    bias_check: BiasCheck        # Protected attribute analysis

class BiasCheck(BaseModel):
    name_redacted: bool          # Was name hidden during scoring?
    age_indicators_removed: bool # Graduation year, etc.
    gender_neutral: bool         # Language analysis passed
    recommendation: str          # "proceed" or "manual_review_needed"

# CRITICAL: Score on skills/experience ONLY, never on protected attributes
async def score_candidate(resume: str, job_description: str) -> CandidateScore:
    # 1. Redact identifying info before scoring
    redacted_resume = redact_pii(resume, fields=["name", "email", "phone", "photo", "address"])
    
    # 2. Score on objective criteria
    score = await llm.score(
        system="Score this candidate on skills and experience match ONLY. Ignore any personal identifiers.",
        resume=redacted_resume,
        job=job_description,
        temperature=0,  # Deterministic scoring
    )
    return score
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Score with name/photo visible | Name/gender/ethnicity bias | Redact PII before scoring |
| Include graduation year | Age discrimination proxy | Remove or normalize graduation dates |
| "Culture fit" as criteria | Proxy for bias (similarity to current team) | Score on skills, experience, demonstrated competencies only |
| No bias testing | Discriminatory patterns undetected | Regular fairness testing across gender, ethnicity, age |
| Black-box scoring | Can't explain why candidate was rejected | Explainable factors: skill_match, experience_match |
| LLM generates job descriptions with biased language | "Rockstar developer" excludes demographics | Bias-check job descriptions before posting |
| No human oversight | AI makes hiring decisions alone | AI suggests → recruiter reviews → hiring manager decides |
| Score variability | Same resume gets different scores | temperature=0, seed for reproducibility |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Scoring model, temperature=0, structured output |
| `config/guardrails.json` | PII redaction rules, bias detection thresholds |
| `config/agents.json` | Scoring weights, matching criteria, review rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement resume parsing, scoring, job description generation |
| `@reviewer` | Audit bias testing, PII redaction, explainability |
| `@tuner` | Optimize matching accuracy, reduce bias, calibrate scores |

## Slash Commands
`/deploy` — Deploy recruiter AI | `/test` — Test with sample resumes | `/review` — Bias audit | `/evaluate` — Measure fairness + accuracy
