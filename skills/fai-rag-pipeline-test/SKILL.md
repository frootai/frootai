---
name: fai-rag-pipeline-test
description: "Test a RAG pipeline end-to-end with relevance and groundedness metrics"
---

# RAG Pipeline Testing

## Test Dataset Format

Store evaluation datasets as JSONL in `evaluation/datasets/`. Each line contains a query, expected answer, and expected source documents for deterministic regression:

```jsonl
{"query": "What is the refund policy?", "expected_answer": "Full refund within 30 days of purchase.", "expected_sources": ["policies/refund.md"], "metadata": {"category": "policy", "difficulty": "easy"}}
{"query": "How do I configure SSO?", "expected_answer": "Navigate to Settings > Identity > SAML 2.0 and upload the IdP metadata XML.", "expected_sources": ["docs/sso-setup.md", "docs/identity.md"], "metadata": {"category": "technical", "difficulty": "medium"}}
```

Load datasets with a shared fixture:

```python
import json
from pathlib import Path
import pytest

@pytest.fixture(scope="session")
def eval_dataset():
    path = Path("evaluation/datasets/golden.jsonl")
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
```

## Retrieval Evaluation

Measure retrieval quality independently from generation. Compute Recall@K, MRR, and NDCG against the golden dataset:

```python
import numpy as np

def recall_at_k(retrieved_ids: list[str], relevant_ids: list[str], k: int) -> float:
    top_k = set(retrieved_ids[:k])
    return len(top_k & set(relevant_ids)) / len(relevant_ids) if relevant_ids else 0.0

def mean_reciprocal_rank(retrieved_ids: list[str], relevant_ids: list[str]) -> float:
    relevant = set(relevant_ids)
    for i, doc_id in enumerate(retrieved_ids, 1):
        if doc_id in relevant:
            return 1.0 / i
    return 0.0

def ndcg_at_k(retrieved_ids: list[str], relevant_ids: list[str], k: int) -> float:
    relevant = set(relevant_ids)
    dcg = sum(1.0 / np.log2(i + 2) for i, doc in enumerate(retrieved_ids[:k]) if doc in relevant)
    ideal = sum(1.0 / np.log2(i + 2) for i in range(min(len(relevant_ids), k)))
    return dcg / ideal if ideal > 0 else 0.0

def test_retrieval_quality(eval_dataset, search_client):
    recalls, mrrs, ndcgs = [], [], []
    for item in eval_dataset:
        results = search_client.search(item["query"], top=10)
        retrieved = [r["id"] for r in results]
        expected = item["expected_sources"]
        recalls.append(recall_at_k(retrieved, expected, k=5))
        mrrs.append(mean_reciprocal_rank(retrieved, expected))
        ndcgs.append(ndcg_at_k(retrieved, expected, k=10))
    assert np.mean(recalls) >= 0.85, f"Recall@5 {np.mean(recalls):.3f} below 0.85 threshold"
    assert np.mean(mrrs) >= 0.70, f"MRR {np.mean(mrrs):.3f} below 0.70 threshold"
    assert np.mean(ndcgs) >= 0.75, f"NDCG@10 {np.mean(ndcgs):.3f} below 0.75 threshold"
```

## Generation Evaluation

Score LLM outputs for groundedness (does the answer come from retrieved context?), faithfulness (no hallucinated facts), and relevance (does it answer the question?). Use an LLM-as-judge pattern with structured output:

```python
JUDGE_PROMPT = """Score the answer on three dimensions (1-5 each):
- Groundedness: Is every claim supported by the provided context?
- Faithfulness: Does the answer avoid adding facts not in the context?
- Relevance: Does the answer address the user's question?

Context: {context}
Question: {question}
Answer: {answer}

Respond as JSON: {{"groundedness": int, "faithfulness": int, "relevance": int, "reasoning": str}}"""

async def evaluate_generation(openai_client, question, answer, context) -> dict:
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            context=context, question=question, answer=answer
        )}],
        response_format={"type": "json_object"},
        temperature=0, seed=42,
    )
    return json.loads(response.choices[0].message.content)

@pytest.mark.asyncio
async def test_generation_quality(eval_dataset, rag_pipeline, openai_client):
    scores = {"groundedness": [], "faithfulness": [], "relevance": []}
    for item in eval_dataset[:20]:  # sample for cost control
        result = await rag_pipeline.run(item["query"])
        evaluation = await evaluate_generation(
            openai_client, item["query"], result.answer, result.context
        )
        for dim in scores:
            scores[dim].append(evaluation[dim])
    for dim, values in scores.items():
        mean = np.mean(values)
        assert mean >= 4.0, f"{dim} mean {mean:.2f} below 4.0 threshold"
```

## Component Testing

### Chunking Quality

Verify chunk boundaries, overlap, and metadata preservation:

```python
def test_chunk_boundaries(chunker):
    doc = "Section A.\n\n# Heading\nSection B content that should not merge with A."
    chunks = chunker.split(doc, chunk_size=200, overlap=50)
    assert all(len(c.text) <= 200 for c in chunks), "Chunk exceeds max size"
    assert all(c.metadata.get("source") for c in chunks), "Missing source metadata"
    # Verify semantic boundary — heading should start a new chunk
    heading_chunk = next(c for c in chunks if "# Heading" in c.text)
    assert heading_chunk.text.startswith("# Heading"), "Heading split mid-chunk"

def test_overlap_consistency(chunker):
    doc = "word " * 500
    chunks = chunker.split(doc, chunk_size=100, overlap=20)
    for i in range(1, len(chunks)):
        suffix = chunks[i - 1].text[-20:]
        assert chunks[i].text.startswith(suffix), f"Chunk {i} missing expected overlap"
```

### Embedding Accuracy

Test that semantically similar queries produce close vectors and dissimilar ones diverge:

```python
def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def test_embedding_semantic_similarity(embedding_client):
    vecs = embedding_client.embed(["cancel my subscription", "how to unsubscribe", "weather forecast"])
    sim_related = cosine_sim(vecs[0], vecs[1])
    sim_unrelated = cosine_sim(vecs[0], vecs[2])
    assert sim_related > 0.80, f"Related pair similarity {sim_related:.3f} too low"
    assert sim_unrelated < 0.50, f"Unrelated pair similarity {sim_unrelated:.3f} too high"
    assert sim_related - sim_unrelated > 0.30, "Insufficient semantic separation"
```

## Pytest Fixtures and Mock Azure Services

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture
def mock_search_client():
    client = MagicMock()
    client.search.return_value = [
        {"id": "policies/refund.md", "content": "Full refund within 30 days.", "@search.score": 0.95},
        {"id": "policies/returns.md", "content": "Return shipping is free.", "@search.score": 0.82},
    ]
    return client

@pytest.fixture
def mock_openai_client():
    client = AsyncMock()
    client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Full refund within 30 days of purchase."))]
    )
    client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536)]
    )
    return client

@pytest.fixture
def rag_pipeline(mock_search_client, mock_openai_client):
    from app.pipeline import RAGPipeline
    return RAGPipeline(search_client=mock_search_client, llm_client=mock_openai_client)

@pytest.fixture(scope="session")
def live_search_client():
    """For integration tests only — requires AZURE_SEARCH_ENDPOINT env var."""
    from azure.search.documents import SearchClient
    from azure.identity import DefaultAzureCredential
    import os
    endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT")
    if not endpoint:
        pytest.skip("AZURE_SEARCH_ENDPOINT not set")
    return SearchClient(endpoint, "rag-index", DefaultAzureCredential())
```

## Integration Testing

Run the full pipeline against live or emulated services. Mark with `@pytest.mark.integration` so CI can gate separately:

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_pipeline_live(live_search_client, eval_dataset):
    from app.pipeline import RAGPipeline
    pipeline = RAGPipeline(search_client=live_search_client)
    result = await pipeline.run(eval_dataset[0]["query"])
    assert result.answer, "Pipeline returned empty answer"
    assert len(result.sources) >= 1, "No sources retrieved"
    assert any(s in result.source_ids for s in eval_dataset[0]["expected_sources"]), \
        f"Expected source not in results: {result.source_ids}"
```

## Regression Testing

Compare current scores against a stored baseline. Fail if any metric degrades beyond tolerance:

```python
BASELINE_PATH = Path("evaluation/baselines/latest.json")

def test_no_regression(eval_dataset, rag_pipeline):
    if not BASELINE_PATH.exists():
        pytest.skip("No baseline — run `pytest --save-baseline` first")
    baseline = json.loads(BASELINE_PATH.read_text())
    current = compute_all_metrics(eval_dataset, rag_pipeline)  # returns dict of metric: score
    for metric, threshold in baseline.items():
        tolerance = 0.02  # allow 2% degradation
        assert current[metric] >= threshold - tolerance, \
            f"{metric} regressed: {current[metric]:.3f} vs baseline {threshold:.3f}"

def pytest_addoption(parser):
    parser.addoption("--save-baseline", action="store_true", help="Save current scores as baseline")

def pytest_sessionfinish(session, exitstatus):
    if session.config.getoption("--save-baseline", default=False) and exitstatus == 0:
        scores = getattr(session, "_rag_scores", {})
        if scores:
            BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
            BASELINE_PATH.write_text(json.dumps(scores, indent=2))
```

## CI Integration

Add to your GitHub Actions workflow. Run unit tests on every PR, integration tests nightly:

```yaml
# .github/workflows/rag-tests.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-test.txt
      - run: pytest tests/ -m "not integration" --tb=short --junitxml=results.xml
      - uses: actions/upload-artifact@v4
        with: { name: test-results, path: results.xml }

  integration:
    if: github.event_name == 'schedule' || contains(github.event.pull_request.labels.*.name, 'run-integration')
    runs-on: ubuntu-latest
    environment: azure-dev
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with: { client-id: ${{ secrets.AZURE_CLIENT_ID }}, tenant-id: ${{ secrets.AZURE_TENANT_ID }}, subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }} }
      - run: pytest tests/ -m integration --tb=short
        env:
          AZURE_SEARCH_ENDPOINT: ${{ secrets.AZURE_SEARCH_ENDPOINT }}
```

## Test Data Management

- Store golden datasets in `evaluation/datasets/` — version them in git, never auto-generate
- Keep datasets small (50-200 items) — LLM judge calls are expensive
- Tag each item with `category` and `difficulty` for stratified analysis
- Rotate 10% of items quarterly to prevent overfitting to the test set
- Store baselines in `evaluation/baselines/` — update only on intentional improvements via `--save-baseline`
- Use `@pytest.mark.parametrize` over the dataset for per-item failure visibility in CI
