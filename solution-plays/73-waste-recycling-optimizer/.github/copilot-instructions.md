---
description: "Waste Recycling Optimizer domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Waste Recycling Optimizer — Domain Knowledge

This workspace implements AI for waste management — material classification (computer vision), contamination detection, route optimization for collection, recycling rate prediction, and circular economy analytics.

## Waste AI Architecture (What the Model Gets Wrong)

### Material Classification Pipeline
```python
async def classify_waste(image: bytes) -> WasteClassification:
    # 1. Computer vision classification
    result = await vision_model.classify(
        image=image,
        categories=["recyclable_plastic", "recyclable_metal", "recyclable_paper",
                     "recyclable_glass", "organic", "electronic_waste", "hazardous",
                     "non_recyclable", "contaminated_recyclable"],
    )
    
    # 2. Contamination check
    if result.category.startswith("recyclable") and result.contamination_score > 0.3:
        result.action = "manual_sort"  # Too contaminated for auto-sort
        result.reason = f"Contamination detected: {result.contamination_type}"
    
    return result
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Binary classification (recyclable/not) | Misses material type for sorting | Multi-class: plastic types (PET, HDPE), metals, paper grades |
| Ignore contamination | Contaminated recyclables ruin batches | Contamination scoring per item |
| No route optimization | Trucks drive inefficient routes | AI-optimized collection routes (TSP with time windows) |
| Static collection schedules | Over/under collection | Fill-level sensors + predicted fill rate → dynamic scheduling |
| No circular economy tracking | Can't measure material recovery rates | Track: collected → sorted → recycled → reused |
| LLM for image classification | Too slow, expensive per image | Lightweight vision model (ONNX) for classification |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for analytics, reporting |
| `config/guardrails.json` | Classification confidence threshold, contamination limits |
| `config/agents.json` | Material categories, route constraints, collection zones |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement classification, route optimization, analytics |
| `@reviewer` | Audit classification accuracy, contamination detection |
| `@tuner` | Optimize model accuracy, route efficiency, collection frequency |

## Slash Commands
`/deploy` — Deploy waste AI | `/test` — Test classification | `/review` — Audit accuracy | `/evaluate` — Measure recycling rate
