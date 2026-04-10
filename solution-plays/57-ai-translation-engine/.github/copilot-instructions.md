---
description: "AI Translation Engine domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Translation Engine — Domain Knowledge

This workspace implements an AI translation engine — neural machine translation with custom glossaries, domain-specific terminology, quality scoring, and post-editing workflows using Azure Translator + LLM enhancement.

## Translation Architecture (What the Model Gets Wrong)

### Azure Translator + LLM Enhancement
```python
from azure.ai.translation.text import TextTranslationClient

# Layer 1: Azure Translator (fast, cheap, good for standard text)
translator = TextTranslationClient(credential=DefaultAzureCredential(), endpoint=endpoint)
basic_translation = translator.translate(
    body=[{"text": source_text}],
    from_parameter="en", to=["de", "fr", "ja"],
    glossary=custom_glossary_url,  # Enforce domain terminology
)

# Layer 2: LLM post-editing (for nuanced/creative content)
if content_type in ("marketing", "legal", "medical"):
    enhanced = await llm.refine(
        source=source_text, translation=basic_translation,
        instructions="Maintain brand voice. Preserve legal precision. Use formal register.",
    )
```

### Custom Glossary (Non-Negotiable for Enterprise)
```
# glossary.tsv — enforce terminology consistency
en	de	fr
Azure OpenAI	Azure OpenAI	Azure OpenAI  # Never translate product names
compliance	Compliance	conformité
data residency	Datenresidenz	résidence des données
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM-only translation | Expensive, slow, inconsistent for bulk text | Azure Translator for bulk + LLM for refinement |
| No glossary | Product names, technical terms translated wrong | Custom glossary enforces terminology |
| Translate HTML/markdown as text | Tags broken: `<strong>Hallo</strong>` | Use `textType: "html"` to preserve markup |
| No quality scoring | Ship bad translations silently | BLEU/COMET score + human review for low scores |
| Ignore locale variants | "en" vs "en-US" vs "en-GB" matters | Specify full locale for region-specific content |
| No context for ambiguous terms | "bank" = financial or river? | Provide domain context in system prompt |
| Batch without progress tracking | 10K documents with no visibility | Progress callbacks + resume from checkpoint |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for post-editing, temperature=0.3 |
| `config/guardrails.json` | Quality score thresholds, human review triggers |
| `config/agents.json` | Glossary URL, target languages, content type rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement translation pipeline, glossary, post-editing |
| `@reviewer` | Audit translation quality, glossary completeness, locale handling |
| `@tuner` | Optimize LLM refinement ratio, quality thresholds, cost |

## Slash Commands
`/deploy` — Deploy translation engine | `/test` — Test translations | `/review` — Quality audit | `/evaluate` — Measure BLEU/COMET scores
