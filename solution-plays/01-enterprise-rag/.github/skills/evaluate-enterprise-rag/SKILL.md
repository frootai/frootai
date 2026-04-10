---
name: evaluate-enterprise-rag
description: "Evaluate Enterprise RAG quality — measure groundedness, relevance, coherence, fluency, content safety. Run evaluation pipeline, analyze gaps, set quality gates. Use when: evaluate, quality, groundedness, relevance, metrics, test, audit."
---

# Evaluate Enterprise RAG Quality

## When to Use
- User asks to evaluate RAG quality or run the evaluation pipeline
- User asks about groundedness, relevance, or coherence scores
- User asks to set quality gates or CI/CD evaluation checks
- User mentions hallucination, grounding, or answer quality

## Quality Metrics and Targets

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| Groundedness | ≥ 0.8 | Is the answer based on retrieved context? (vs hallucinated) |
| Relevance | ≥ 0.7 | Does the answer address the user's question? |
| Coherence | ≥ 0.8 | Is the answer logically structured and readable? |
| Fluency | ≥ 0.8 | Is the language natural and grammatically correct? |
| Content Safety | Pass | Does the output pass content safety filters? |

## Step 1: Prepare Test Set

Create `evaluation/test-set.jsonl` with diverse scenarios:
```json
{"query": "What is the return policy?", "ground_truth": "Products can be returned within 30 days.", "category": "policy"}
{"query": "How do I reset my password?", "ground_truth": "Go to Settings > Security > Reset Password.", "category": "support"}
{"query": "What are the Q3 revenue numbers?", "ground_truth": "Q3 revenue was $12.5M, up 15% YoY.", "category": "financial"}
```

Minimum 10 test cases. Cover: factual, procedural, numerical, multi-hop, adversarial (questions not in context).

## Step 2: Run Evaluation Pipeline

```python
from azure.ai.evaluation import (
    GroundednessEvaluator,
    RelevanceEvaluator,
    CoherenceEvaluator,
    FluencyEvaluator,
)
import json

def run_evaluation(test_set_path: str, config: dict) -> dict:
    model_config = {
        "azure_endpoint": config["endpoint"],
        "azure_deployment": config["model"],
        "api_version": config["api_version"],
    }
    
    evaluators = {
        "groundedness": GroundednessEvaluator(model_config),
        "relevance": RelevanceEvaluator(model_config),
        "coherence": CoherenceEvaluator(model_config),
        "fluency": FluencyEvaluator(model_config),
    }
    
    results = {}
    with open(test_set_path) as f:
        test_cases = [json.loads(line) for line in f]
    
    for case in test_cases:
        # Get RAG response
        chunks = hybrid_search(case["query"])
        response = generate_response(case["query"], chunks)
        context = "\n".join(c["content"] for c in chunks)
        
        for name, evaluator in evaluators.items():
            score = evaluator(
                query=case["query"],
                response=response["answer"],
                context=context,
            )
            results.setdefault(name, []).append(score)
    
    # Average scores
    return {name: sum(scores)/len(scores) for name, scores in results.items()}
```

## Step 3: Analyze Quality Gaps

### Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Low groundedness (<0.6) | Chunks too large, irrelevant context | Reduce chunk_size to 512, enable semantic reranking |
| Low groundedness (<0.6) | No grounding instruction in system prompt | Add "Answer ONLY from context" to system prompt |
| Low relevance (<0.5) | Vector-only search | Enable hybrid search (BM25 + vector) |
| Low relevance (<0.5) | Wrong top_k value | Increase top_k from 3 to 5, or decrease if too noisy |
| Low coherence (<0.7) | Temperature too high | Reduce temperature to 0.1 for factual responses |
| Adversarial questions answered | No refusal instruction | Add "If context doesn't contain answer, say so" |
| Hallucinated citations | No citation format enforced | Add "[Source: {doc}]" template to system prompt |

## Step 4: Quality Gate Configuration

```python
# config/guardrails.json
{
    "evaluation": {
        "groundedness_min": 0.8,
        "relevance_min": 0.7,
        "coherence_min": 0.8,
        "fluency_min": 0.8,
        "min_test_cases": 10
    }
}

def check_quality_gates(results: dict, config: dict) -> bool:
    gates = config["evaluation"]
    passed = True
    for metric, threshold_key in [
        ("groundedness", "groundedness_min"),
        ("relevance", "relevance_min"),
        ("coherence", "coherence_min"),
        ("fluency", "fluency_min"),
    ]:
        score = results.get(metric, 0)
        threshold = gates.get(threshold_key, 0.7)
        status = "PASS" if score >= threshold else "FAIL"
        print(f"{metric}: {score:.2f} (target: ≥{threshold}) {status}")
        if score < threshold:
            passed = False
    return passed
```

## Step 5: CI/CD Integration

Add evaluation as a pipeline gate:
```yaml
- name: RAG Evaluation
  run: |
    python evaluation/eval.py --config config/guardrails.json
    if [ $? -ne 0 ]; then
      echo "Quality gates failed. Blocking deployment."
      exit 1
    fi
```

## Output: Quality Report

```
## RAG Quality Evaluation Report
| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| Groundedness | 0.85 | ≥ 0.8 | ✅ PASS |
| Relevance | 0.78 | ≥ 0.7 | ✅ PASS |
| Coherence | 0.82 | ≥ 0.8 | ✅ PASS |
| Fluency | 0.88 | ≥ 0.8 | ✅ PASS |

Test cases: 15 | Overall: PASS
```
