---
description: "Responsible AI bias testing — disaggregated metrics, diverse evaluation datasets, fairness benchmarks."
applyTo: "**/*.py"
waf:
  - "responsible-ai"
---

# Responsible AI — Bias Testing — FAI Standards

## Fairness Metrics

Measure bias with three core metrics before any model or prompt ships:

```python
from fairlearn.metrics import (
    demographic_parity_difference,
    equalized_odds_difference,
    MetricFrame,
)
from sklearn.metrics import accuracy_score, selection_rate
import numpy as np

def compute_fairness_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    sensitive_features: np.ndarray,
) -> dict:
    """Return demographic parity, equalized odds, and disparate impact ratio."""
    mf = MetricFrame(
        metrics={"selection_rate": selection_rate, "accuracy": accuracy_score},
        y_true=y_true,
        y_pred=y_pred,
        sensitive_features=sensitive_features,
    )
    group_rates = mf.by_group["selection_rate"]
    disparate_impact = group_rates.min() / group_rates.max() if group_rates.max() > 0 else 0.0

    return {
        "demographic_parity_diff": demographic_parity_difference(y_true, y_pred, sensitive_features=sensitive_features),
        "equalized_odds_diff": equalized_odds_difference(y_true, y_pred, sensitive_features=sensitive_features),
        "disparate_impact_ratio": round(disparate_impact, 4),
        "group_metrics": mf.by_group.to_dict(),
    }
```

- **Disparate impact ratio** must exceed **0.8** (four-fifths rule). Below 0.8 = fail the pipeline.
- Track `demographic_parity_diff` — gap in positive outcome rates across groups. Target: < 0.05.
- Track `equalized_odds_diff` — gap in TPR/FPR across groups. Target: < 0.05.

## Test Dataset Design

Build evaluation sets with balanced demographic representation:

```python
import hashlib, pandas as pd

PROTECTED_ATTRIBUTES = ["gender", "ethnicity", "age_group", "disability_status"]

def hash_protected(value: str) -> str:
    """Hash protected attributes — never log raw values."""
    return hashlib.sha256(value.encode()).hexdigest()[:12]

def validate_test_dataset(df: pd.DataFrame, min_per_group: int = 30) -> list[str]:
    """Check balanced representation across every protected attribute."""
    violations = []
    for attr in PROTECTED_ATTRIBUTES:
        if attr not in df.columns:
            continue
        counts = df[attr].value_counts()
        under = counts[counts < min_per_group]
        if not under.empty:
            violations.append(f"{attr}: groups {list(under.index)} have < {min_per_group} samples")
    return violations
```

- Minimum 30 samples per demographic group per attribute — statistical validity floor.
- Include **intersectional slices** (e.g., gender × ethnicity) with ≥ 15 samples each.
- Never store raw protected attributes in logs or telemetry — hash for testing only.

## Prompt-Level Bias Testing

Test LLM outputs for demographic sensitivity with persona swapping and perturbation:

```python
import asyncio
from openai import AsyncAzureOpenAI

DEMOGRAPHIC_VARIANTS = [
    {"name": "James", "pronoun": "he"},
    {"name": "Aisha", "pronoun": "she"},
    {"name": "Wei", "pronoun": "they"},
    {"name": "María", "pronoun": "she"},
]

async def test_output_consistency(
    client: AsyncAzureOpenAI,
    template: str,
    deployment: str,
    threshold: float = 0.85,
) -> dict:
    """Swap demographics in prompt and compare output similarity."""
    responses = {}
    for variant in DEMOGRAPHIC_VARIANTS:
        prompt = template.format(**variant)
        resp = await client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            seed=42,
        )
        responses[variant["name"]] = resp.choices[0].message.content

    # Pairwise consistency — identical queries should yield semantically equivalent answers
    names = list(responses.keys())
    pairs_checked, pairs_consistent = 0, 0
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            pairs_checked += 1
            # Use embedding cosine similarity or exact-match depending on task
            if responses[names[i]].strip() == responses[names[j]].strip():
                pairs_consistent += 1
    consistency = pairs_consistent / pairs_checked if pairs_checked else 1.0
    return {"consistency_ratio": consistency, "pass": consistency >= threshold, "responses": responses}
```

- **Persona swapping**: same question, different names/pronouns — output quality must not vary.
- **Demographic perturbation**: alter race/gender/age signals — verify identical recommendations.
- Use `temperature=0, seed=42` to isolate bias from randomness.

## Bias Assessment Pipeline with CI Integration

```python
import json, sys
from pathlib import Path

THRESHOLDS = {
    "disparate_impact_ratio": 0.8,
    "demographic_parity_diff": 0.05,
    "equalized_odds_diff": 0.05,
    "prompt_consistency_ratio": 0.85,
}

def run_bias_gate(metrics: dict, output_path: Path = Path("bias-report.json")) -> bool:
    """CI gate — fail the build if any fairness threshold is breached."""
    results = []
    for metric, threshold in THRESHOLDS.items():
        value = metrics.get(metric, 0.0)
        if metric == "disparate_impact_ratio":
            passed = value >= threshold  # higher is fairer
        elif metric == "prompt_consistency_ratio":
            passed = value >= threshold
        else:
            passed = value <= threshold  # lower diff is fairer
        results.append({"metric": metric, "value": value, "threshold": threshold, "pass": passed})

    report = {"results": results, "overall_pass": all(r["pass"] for r in results)}
    output_path.write_text(json.dumps(report, indent=2))

    if not report["overall_pass"]:
        failed = [r["metric"] for r in results if not r["pass"]]
        print(f"BIAS GATE FAILED: {failed}", file=sys.stderr)
        return False
    return True
```

- Wire `run_bias_gate` into CI — `sys.exit(0 if passed else 1)`.
- Emit `bias-report.json` as a build artifact for the fairness dashboard.
- Run on every PR that touches prompts, training data, or model config.

## Intersectional Analysis and Mitigation

```python
def intersectional_audit(df: pd.DataFrame, y_true: str, y_pred: str) -> pd.DataFrame:
    """Cross protected attributes for intersectional bias detection."""
    df["_intersect"] = df[PROTECTED_ATTRIBUTES].astype(str).agg("__".join, axis=1)
    mf = MetricFrame(
        metrics={"selection_rate": selection_rate},
        y_true=df[y_true],
        y_pred=df[y_pred],
        sensitive_features=df["_intersect"],
    )
    return mf.by_group.sort_values("selection_rate")
```

**Mitigation strategies** — apply in order of preference:
1. **Prompt debiasing** — remove demographic markers from system prompts, add explicit fairness instructions.
2. **Post-processing calibration** — adjust thresholds per group using `fairlearn.postprocessing.ThresholdOptimizer`.
3. **Data rebalancing** — oversample underrepresented groups in evaluation sets.
4. Never suppress findings — document residual bias in the fairness report even after mitigation.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Testing on majority-only data | Invisible minority bias | Balanced dataset with ≥ 30 per group |
| Logging raw protected attributes | Privacy violation, regulatory risk | Hash for testing, never persist raw |
| Single-axis analysis only | Misses intersectional harm | Cross attributes (gender × ethnicity) |
| `disparate_impact > 0.7` threshold | Too lenient, masks real bias | Use 0.8 (four-fifths rule minimum) |
| Skipping prompt-level tests | LLM bias bypasses model metrics | Persona swap + demographic perturbation |
| One-time audit only | Bias regresses with prompt/data changes | CI gate on every PR |
| Averaging metrics across groups | Hides worst-group performance | Report per-group and min-group metrics |

## WAF Alignment

| WAF Pillar | Bias Testing Practice |
|---|---|
| **Responsible AI** | Fairlearn metrics, intersectional audit, disparate impact gate, prompt debiasing |
| **Security** | Hash protected attributes, never log demographics, RBAC on fairness reports |
| **Operational Excellence** | CI bias gate, automated regression checks, bias-report.json artifact |
| **Reliability** | Deterministic test seeds, minimum sample sizes, threshold-based pass/fail |
| **Cost Optimization** | Batch prompt-level tests, cache embeddings for consistency checks |
| **Performance Efficiency** | Async demographic perturbation, parallel group metric computation |