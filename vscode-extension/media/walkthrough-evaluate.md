## Run Your First Evaluation

Validate AI quality with FrootAI's built-in evaluation framework — five metrics, threshold-based pass/fail.

### Quality Metrics

| Metric | Measures | Threshold |
|--------|----------|-----------|
| **Groundedness** | Are claims supported by retrieved sources? | ≥ 4.0 |
| **Relevance** | Does the response address the question? | ≥ 4.0 |
| **Coherence** | Is the response logically structured? | ≥ 4.0 |
| **Fluency** | Is the language natural and clear? | ≥ 4.0 |
| **Safety** | Is content safe and appropriate? | ≥ 4.0 |

### Dashboard Features

- **Trend sparklines** — track quality over last 5 runs
- **Delta badges** — see improvement or regression (▲/▼)
- **Pass rate** — quick summary of metrics meeting thresholds
- **Export** — copy results as JSON or CSV

### How to Run

1. **Ctrl+Shift+P** → "FrootAI: Run Evaluation"
2. Or open the **Evaluation Dashboard** panel
3. View results with color-coded pass/fail indicators

> **Tip**: Run evaluations after every prompt or model change to catch regressions.
