---
description: "Content Moderation domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Content Moderation — Domain Knowledge

This workspace implements AI-powered content moderation — detecting and filtering hate speech, violence, self-harm, sexual content, and custom categories using Azure Content Safety.

## Content Safety Architecture (What the Model Gets Wrong)

### Azure Content Safety Client
```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions, TextCategory
from azure.identity import DefaultAzureCredential

client = ContentSafetyClient(
    endpoint=config["endpoint"],
    credential=DefaultAzureCredential(),
)

# Analyze text for safety violations
result = client.analyze_text(AnalyzeTextOptions(
    text=user_input,
    categories=[TextCategory.HATE, TextCategory.VIOLENCE, TextCategory.SELF_HARM, TextCategory.SEXUAL],
))

# Check severity (0=safe, 2=low, 4=medium, 6=high)
for category in result.categories_analysis:
    if category.severity >= 4:  # Block medium and above
        return {"blocked": True, "category": category.category, "severity": category.severity}
```

### Moderation Pipeline
```
User Input → Content Safety (text) → LLM Processing → Content Safety (output) → Response
                 ↓ Block if severe                        ↓ Block if severe
              Log + Alert                              Log + Alert
```

### MUST Moderate BOTH Input AND Output
```python
# WRONG — only checking input
safety_check = analyze_text(user_input)
response = llm.generate(user_input)  # Output not checked!

# CORRECT — check both input AND output
input_check = analyze_text(user_input)
if input_check.blocked: return reject(input_check)
response = llm.generate(user_input)
output_check = analyze_text(response.content)
if output_check.blocked: return reject(output_check)  # Catch LLM-generated violations
return response
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Check input only | LLM can generate harmful content | Check BOTH input AND output |
| severity >= 6 only | Misses medium-severity violations | Block at severity >= 4 (medium) |
| No custom categories | Miss domain-specific violations | Add custom blocklists for your domain |
| Sync moderation | Blocks main thread | Async: `await client.analyze_text_async()` |
| No logging | Can't audit moderation decisions | Log every decision with category + severity |
| No human review queue | False positives can't be appealed | Route borderline cases (severity 2-4) to human |
| Image moderation skipped | Only text checked | Use `analyze_image` for uploaded images |
| No rate limiting | Users flood with harmful content | Rate limit per user: 10 req/min |

### Custom Blocklist
```python
# Add domain-specific terms to block
blocklist = client.create_or_update_text_blocklist(
    blocklist_name="custom-terms",
    options={"description": "Domain-specific blocked terms"},
)
client.add_blocklist_items(
    blocklist_name="custom-terms",
    options={"blocklistItems": [
        {"description": "Competitor name", "text": "competitor-product-name"},
        {"description": "Internal codename", "text": "project-secret"},
    ]},
)

# Use in analysis
result = client.analyze_text(AnalyzeTextOptions(
    text=user_input,
    blocklist_names=["custom-terms"],
    halt_on_blocklist_hit=True,
))
```

### Severity Levels and Actions
| Severity | Level | Action | Example |
|----------|-------|--------|---------|
| 0 | Safe | Allow | Normal conversation |
| 2 | Low | Log + Allow | Mild language |
| 4 | Medium | Block + Log | Targeted insults |
| 6 | High | Block + Alert + Ban review | Extreme content |

## Evaluation Targets
| Metric | Target |
|--------|--------|
| True positive rate (catch harmful) | >= 99% |
| False positive rate (block safe) | < 2% |
| Moderation latency | < 200ms |
| Custom category detection | >= 95% |
| Human review queue volume | < 5% of total |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/guardrails.json` | severity thresholds per category, blocklist names |
| `config/openai.json` | LLM for borderline case analysis |
| `config/agents.json` | moderation pipeline rules, escalation |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement moderation pipeline, custom blocklists, image moderation |
| `@reviewer` | Audit false positive/negative rates, threshold calibration |
| `@tuner` | Optimize thresholds per category, reduce false positives, latency |

## Slash Commands
`/deploy` — Deploy moderation service | `/test` — Run moderation tests | `/review` — Audit accuracy | `/evaluate` — Evaluate moderation metrics
