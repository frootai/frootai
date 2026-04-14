---
name: "evaluation-pipeline-create"
description: "Create an evaluation pipeline with Azure AI Evaluation SDK and CI gate logic"
---

# Evaluation Pipeline Create

Build an end-to-end AI evaluation pipeline using Azure AI Foundry Evaluation SDK, with automated CI gates, MLflow tracking, regression detection, and human eval integration.

## Core Metrics

The five standard LLM quality metrics scored 1–5:

| Metric | Measures | Threshold |
|--------|----------|-----------|
| **Groundedness** | Is the response grounded in the provided context? | ≥ 4.0 |
| **Relevance** | Does the response address the query? | ≥ 4.0 |
| **Fluency** | Is the language natural and readable? | ≥ 4.0 |
| **Coherence** | Is the response logically consistent? | ≥ 4.0 |
| **Similarity** | Does the response match the expected answer? | ≥ 3.5 |

## Step 1: Threshold Configuration

Create `config/evaluation.json` — the single source of truth for pass/fail gates:

```json
{
  "metrics": {
    "groundedness": { "threshold": 4.0, "weight": 0.25 },
    "relevance":    { "threshold": 4.0, "weight": 0.25 },
    "fluency":      { "threshold": 4.0, "weight": 0.15 },
    "coherence":    { "threshold": 4.0, "weight": 0.20 },
    "similarity":   { "threshold": 3.5, "weight": 0.15 }
  },
  "regression": {
    "max_score_drop": 0.3,
    "baseline_experiment": "prod-baseline-v1"
  },
  "dataset": "evaluation/test-dataset.jsonl",
  "min_samples": 50,
  "mlflow_experiment": "fai-eval"
}
```

## Step 2: Test Dataset Format

Each line in `evaluation/test-dataset.jsonl` is one test case:

```jsonl
{"query": "What is the refund policy?", "expected": "Refunds are available within 30 days of purchase.", "context": "Our refund policy allows returns within 30 days. Items must be unused and in original packaging."}
{"query": "How do I reset my password?", "expected": "Go to Settings > Security > Reset Password.", "context": "To reset your password, navigate to Settings, then Security, and click Reset Password. You will receive a confirmation email."}
```

Fields: `query` (user input), `expected` (ground truth answer), `context` (retrieved documents the model was given). Optional: `metadata` for slicing results by category.

## Step 3: Evaluation Script

```python
# evaluation/run_eval.py
import json, sys
from pathlib import Path
from azure.ai.evaluation import (
    GroundednessEvaluator,
    RelevanceEvaluator,
    FluencyEvaluator,
    CoherenceEvaluator,
    SimilarityEvaluator,
    evaluate,
)
from azure.identity import DefaultAzureCredential
import mlflow

def load_config(path: str = "config/evaluation.json") -> dict:
    return json.loads(Path(path).read_text())

def run_evaluation(endpoint: str, deployment: str, dataset_path: str, config: dict):
    credential = DefaultAzureCredential()
    model_config = {
        "azure_endpoint": endpoint,
        "azure_deployment": deployment,
        "api_version": "2024-06-01",
    }

    evaluators = {
        "groundedness": GroundednessEvaluator(model_config),
        "relevance":    RelevanceEvaluator(model_config),
        "fluency":      FluencyEvaluator(model_config),
        "coherence":    CoherenceEvaluator(model_config),
        "similarity":   SimilarityEvaluator(model_config),
    }

    results = evaluate(
        data=dataset_path,
        evaluators=evaluators,
        evaluator_config={
            "default": {
                "query":    "${data.query}",
                "response": "${target.response}",
                "context":  "${data.context}",
                "ground_truth": "${data.expected}",
            }
        },
    )
    return results

def check_thresholds(results: dict, config: dict) -> tuple[bool, dict]:
    """Returns (passed, metric_scores). Fails if any metric < threshold."""
    metrics_cfg = config["metrics"]
    scores = {}
    failed = []
    for metric, cfg in metrics_cfg.items():
        score = results["metrics"].get(f"{metric}.mean", 0.0)
        scores[metric] = round(score, 3)
        if score < cfg["threshold"]:
            failed.append(f"{metric}: {score:.3f} < {cfg['threshold']}")
    return len(failed) == 0, scores, failed

def check_regression(scores: dict, config: dict) -> list[str]:
    """Compare against baseline MLflow experiment. Returns list of regressions."""
    baseline_name = config["regression"]["baseline_experiment"]
    max_drop = config["regression"]["max_score_drop"]
    client = mlflow.tracking.MlflowClient()
    baseline_exp = client.get_experiment_by_name(baseline_name)
    if not baseline_exp:
        return []  # No baseline yet — skip regression check
    runs = client.search_runs(baseline_exp.experiment_id, order_by=["start_time DESC"], max_results=1)
    if not runs:
        return []
    baseline_metrics = runs[0].data.metrics
    regressions = []
    for metric, score in scores.items():
        baseline_val = baseline_metrics.get(metric, 0)
        if baseline_val - score > max_drop:
            regressions.append(f"{metric}: {score:.3f} vs baseline {baseline_val:.3f} (drop {baseline_val - score:.3f} > {max_drop})")
    return regressions

def main():
    config = load_config()
    endpoint = sys.argv[1]  # Azure OpenAI endpoint
    deployment = sys.argv[2]  # Judge model deployment name

    mlflow.set_experiment(config["mlflow_experiment"])
    with mlflow.start_run(run_name=f"eval-{deployment}"):
        results = run_evaluation(endpoint, deployment, config["dataset"], config)
        passed, scores, failures = check_thresholds(results, config)
        regressions = check_regression(scores, config)

        # Log to MLflow
        for metric, score in scores.items():
            mlflow.log_metric(metric, score)
        mlflow.log_dict(config, "eval_config.json")
        mlflow.log_param("dataset", config["dataset"])
        mlflow.log_param("passed", passed and not regressions)

        # Generate report
        generate_report(scores, failures, regressions, config)

        if regressions:
            print(f"REGRESSION DETECTED: {'; '.join(regressions)}")
            sys.exit(2)
        if not passed:
            print(f"THRESHOLD FAILURE: {'; '.join(failures)}")
            sys.exit(1)
        print(f"ALL METRICS PASSED: {scores}")

def generate_report(scores, failures, regressions, config):
    """Write markdown eval report for PR comments / artifacts."""
    lines = ["# Evaluation Report\n", "| Metric | Score | Threshold | Status |", "|--------|-------|-----------|--------|"]
    for metric, cfg in config["metrics"].items():
        score = scores.get(metric, 0)
        status = "PASS" if score >= cfg["threshold"] else "FAIL"
        lines.append(f"| {metric} | {score:.3f} | {cfg['threshold']} | {status} |")
    if regressions:
        lines.append("\n## Regressions Detected")
        for r in regressions:
            lines.append(f"- {r}")
    Path("evaluation/report.md").write_text("\n".join(lines))

if __name__ == "__main__":
    main()
```

## Step 4: A/B Model Comparison

```python
# evaluation/compare_models.py
import mlflow

def compare_experiments(exp_a: str, exp_b: str, metrics: list[str]) -> dict:
    """Compare latest runs from two MLflow experiments."""
    client = mlflow.tracking.MlflowClient()
    results = {}
    for exp_name in [exp_a, exp_b]:
        exp = client.get_experiment_by_name(exp_name)
        runs = client.search_runs(exp.experiment_id, order_by=["start_time DESC"], max_results=1)
        results[exp_name] = {m: runs[0].data.metrics.get(m, 0) for m in metrics}

    print(f"{'Metric':<15} {exp_a:<20} {exp_b:<20} {'Delta':<10}")
    for m in metrics:
        a, b = results[exp_a][m], results[exp_b][m]
        print(f"{m:<15} {a:<20.3f} {b:<20.3f} {b - a:<+10.3f}")
    return results
```

## Step 5: CI Gate (GitHub Actions)

```yaml
# .github/workflows/eval-gate.yml
name: AI Evaluation Gate
on:
  pull_request:
    paths: ["app/**", "config/evaluation.json", "prompts/**"]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # OIDC for Azure login
      contents: read
      pull-requests: write  # Post eval report as PR comment
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }

      - name: Install dependencies
        run: pip install azure-ai-evaluation mlflow azure-identity

      - name: Run evaluation
        env:
          AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
        run: python evaluation/run_eval.py "$AZURE_OPENAI_ENDPOINT" "gpt-4o"

      - name: Post eval report to PR
        if: always()
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: evaluation/report.md

      - name: Upload eval artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: evaluation/report.md
```

## Step 6: Human Evaluation Integration

For subjective quality (tone, helpfulness), add human-in-the-loop scoring:

```python
# evaluation/human_eval.py
import json, csv
from pathlib import Path

def export_for_human_review(dataset: str, model_responses: list[dict], output: str):
    """Export CSV for human annotators with query, response, and scoring columns."""
    rows = []
    for item in model_responses:
        rows.append({
            "query": item["query"],
            "response": item["response"],
            "context": item.get("context", ""),
            "helpfulness": "",   # Human fills 1-5
            "accuracy": "",      # Human fills 1-5
            "tone": "",          # Human fills 1-5
            "comments": "",
        })
    Path(output).write_text("")
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

def merge_human_scores(auto_scores: dict, human_csv: str) -> dict:
    """Merge automated + human scores into final weighted result."""
    with open(human_csv) as f:
        human = list(csv.DictReader(f))
    human_avg = {
        "helpfulness": sum(float(r["helpfulness"]) for r in human) / len(human),
        "accuracy": sum(float(r["accuracy"]) for r in human) / len(human),
        "tone": sum(float(r["tone"]) for r in human) / len(human),
    }
    return {**auto_scores, **human_avg}
```

## Checklist

- [ ] `config/evaluation.json` has thresholds for all five metrics
- [ ] Test dataset has ≥50 samples with query/expected/context
- [ ] `run_eval.py` invoked in CI with OIDC Azure authentication
- [ ] MLflow experiment tracks every eval run with metrics + config
- [ ] Regression check compares against production baseline
- [ ] Eval report posted as PR comment on every pull request
- [ ] Human eval CSV exported for subjective quality review
