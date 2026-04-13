---
name: fai-play-initializer
description: 'Scaffolds a complete FAI solution play with DevKit, TuneKit, SpecKit, infrastructure templates, and fai-manifest.json — the full FAI Protocol structure ready for development.'
---

# FAI Play Initializer

Initialize a new FAI solution play with the complete FAI Protocol structure. This skill generates all required files and folders for a production-ready solution play.

## Parameters

- **Play Number**: ${PLAY_NUMBER="21|22|23|24|25|26|27|28|29|30"}
- **Play Name**: The kebab-case name for this play (e.g., `agentic-rag`, `multi-agent-swarm`)
- **Primary WAF Pillars**: ${WAF_PILLARS="security,reliability|security,cost-optimization|all-six-pillars"}
- **Infrastructure**: ${INFRA_TARGET="azure-bicep|terraform|docker-only|kubernetes"}
- **Knowledge Modules**: Which FROOT modules this play depends on (e.g., R2-RAG-Architecture, O3-MCP-Tools)

## Generated Structure

Create the following directory structure at `solution-plays/{PLAY_NUMBER}-{PLAY_NAME}/`:

```
{PLAY_NUMBER}-{PLAY_NAME}/
├── .github/                          ← DevKit
│   ├── agents/
│   │   └── {play-name}-agent.agent.md
│   ├── instructions/
│   │   └── {play-name}.instructions.md
│   └── prompts/
│       └── {play-name}-init.prompt.md
├── config/                           ← TuneKit
│   ├── openai.json                   # Model config, temperature, max_tokens
│   ├── guardrails.json               # Quality thresholds
│   └── evaluation/
│       └── metrics.json              # Groundedness, coherence, relevance targets
├── spec/                             ← SpecKit
│   ├── architecture.json             # Component diagram reference
│   └── waf-alignment.json            # WAF pillar compliance matrix
├── infra/                            ← Infrastructure
│   ├── main.bicep                    # Primary Bicep template
│   └── parameters.json               # Environment-specific params
├── fai-manifest.json                 ← THE FAI PROTOCOL GLUE
├── froot.json                        ← Play metadata
├── plugin.json                       ← Plugin packaging
├── README.md                         ← Play documentation
└── CHANGELOG.md                      ← Version history
```

## File Content Guidelines

### fai-manifest.json
Generate with:
- `play`: `"{PLAY_NUMBER}-{PLAY_NAME}"`
- `version`: `"1.0.0"`
- `context.knowledge`: Array of FROOT module references
- `context.waf`: Selected WAF pillars
- `primitives.guardrails`: `{ "groundedness": 0.95, "coherence": 0.90, "safety": 0 }`

### config/guardrails.json
```json
{
  "groundedness": { "threshold": 0.95, "action": "retry" },
  "coherence": { "threshold": 0.90, "action": "retry" },
  "relevance": { "threshold": 0.85, "action": "warn" },
  "safety": { "maxViolations": 0, "action": "block" },
  "cost": { "maxPerQuery": 0.01, "budgetAlert": 0.80 }
}
```

### README.md
Include: play description, architecture diagram placeholder, prerequisites, quick start, WAF alignment table, evaluation metrics, and contributing guide.

## Verification Steps

After scaffolding:
1. Run `node scripts/validate-primitives.js` — all files must pass
2. Verify `fai-manifest.json` parses correctly
3. Verify `plugin.json` follows plugin schema
4. Check all WAF pillars referenced in manifest match spec/waf-alignment.json

## Notes
- Every play MUST have a `fai-manifest.json` — this is what makes it a FAI play, not just a folder
- The `froot.json` contains play-specific metadata (title, description, tags, difficulty level)
- Infrastructure templates use Azure Verified Modules (AVM) from the Bicep registry where available
