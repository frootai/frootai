---
description: "FAI Meta-Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# FAI Meta-Agent — Domain Knowledge

This workspace implements the FAI Meta-Agent — the self-orchestrating agent that manages all 101 FrootAI solution plays, routes users to the right play, configures DevKit/TuneKit/SpecKit, and provides cross-play intelligence.

## Meta-Agent Architecture (What the Model Gets Wrong)

### Play Selection and Routing
```python
async def route_to_play(user_query: str) -> PlayRecommendation:
    # 1. Classify the user's intent
    intent = await classify_intent(user_query)
    # {"domain": "rag", "complexity": "enterprise", "industry": "healthcare", "modality": "text"}
    
    # 2. Match against play catalog (101 plays)
    candidates = play_catalog.search(
        domain=intent.domain,
        tags=intent.tags,
        industry=intent.industry,
    )
    
    # 3. Rank by fit
    ranked = rank_plays(candidates, user_context={
        "existing_infra": user.azure_services,
        "team_size": user.team_size,
        "compliance": user.regulatory_requirements,
    })
    
    # 4. Recommend top 3 with rationale
    return PlayRecommendation(
        primary=ranked[0],
        alternatives=ranked[1:3],
        rationale=f"Play {ranked[0].id} is best because: {ranked[0].match_reason}",
    )
```

### Cross-Play Intelligence
```python
# Meta-agent knows how plays combine
PLAY_COMBINATIONS = {
    "enterprise_rag_with_governance": ["01-enterprise-rag", "99-enterprise-ai-governance-hub"],
    "secure_voice_ai": ["04-call-center-voice-ai", "30-ai-security-hardening"],
    "compliant_healthcare": ["46-healthcare-clinical-ai", "35-ai-compliance-engine"],
}
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Recommend single play always | Miss multi-play combinations | Suggest primary + complementary plays |
| LLM guesses play details | Hallucinate capabilities not in the play | Ground in play catalog (knowledge.json) |
| No user context | Same recommendation for startup vs enterprise | Factor in: team size, existing infra, compliance needs |
| Static routing rules | Miss new plays, evolving capabilities | ML-based routing updated with play catalog changes |
| No feedback on recommendations | Don't know if recommendation was useful | Track: recommended → initialized → used → satisfaction |
| Ignore existing DevKit | Recommend play user already has | Check workspace for existing .github/ files |

### FAI Protocol Integration
The Meta-Agent is the FAI Protocol's entry point:
- **DevKit**: Initializes `.github/` (copilot-instructions, agents, skills, hooks, workflows)
- **TuneKit**: Deploys `config/` (model params, guardrails, evaluation thresholds)
- **SpecKit**: Deploys `spec/` (fai-manifest, plugin.json, play-spec, docs)
- **Infra**: Deploys `infra/` (AVM Bicep templates — Azure plays only)

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Routing model, play matching temperature |
| `config/guardrails.json` | Play compatibility rules, recommendation limits |
| `config/agents.json` | Play catalog location, combination rules, feedback tracking |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement play routing, DevKit initialization, cross-play wiring |
| `@reviewer` | Audit recommendation quality, play compatibility, coverage |
| `@tuner` | Optimize routing accuracy, recommendation relevance, feedback loop |

## Slash Commands
`/deploy` — Deploy meta-agent | `/test` — Test play routing | `/review` — Audit recommendations | `/evaluate` — Measure routing accuracy
