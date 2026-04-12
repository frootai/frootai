---
name: evaluate-knowledge-graph-rag
description: "Evaluate Knowledge Graph RAG — measure entity extraction accuracy, relationship precision, graph traversal quality, hybrid retrieval effectiveness, multi-hop reasoning. Use when: evaluate, benchmark graph RAG."
---

# Evaluate Knowledge Graph RAG

## When to Use
- Evaluate entity extraction accuracy (correct entities found?)
- Measure relationship mapping precision (correct edges?)
- Assess graph traversal retrieval quality for multi-hop queries
- Compare graph RAG vs vector RAG on relationship questions
- Gate deployments with graph quality thresholds

## Graph RAG Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Entity extraction F1 | ≥ 0.85 | Compare extracted vs ground truth entities |
| Relationship precision | ≥ 0.80 | Correct edges / total extracted edges |
| Entity resolution accuracy | ≥ 0.90 | Merged duplicates correctly identified |
| Multi-hop retrieval success | ≥ 75% | 2-3 hop queries returning correct path |
| Groundedness (graph context) | ≥ 0.85 | Answers grounded in graph-retrieved content |
| Graph vs vector lift | ≥ 15% | Quality improvement on relationship queries |
| Graph traversal latency | < 500ms | Gremlin query execution time |
| Entity count accuracy | ±10% of expected | Total entities vs document content |

## Step 1: Prepare Graph Test Dataset
```json
{"doc": "Alice (CTO) reports to Bob (CEO) at Acme Corp. They launched Widget Pro in Q4.",
 "expected_entities": [{"name":"Alice","type":"Person"},{"name":"Bob","type":"Person"},{"name":"Acme Corp","type":"Organization"},{"name":"Widget Pro","type":"Product"}],
 "expected_relationships": [{"from":"Alice","to":"Bob","type":"reports_to"},{"from":"Alice","to":"Acme Corp","type":"works_at"}]}
```
Minimum: 50 documents with labeled entities and relationships.

## Step 2: Evaluate Entity Extraction
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics entity_extraction
```
- Precision: extracted entities that are correct
- Recall: ground truth entities that were extracted
- Per-type breakdown (Person, Org, Product — which types are weakest?)

## Step 3: Evaluate Relationship Mapping
- Are extracted relationships correct? (Alice reports_to Bob, not Bob reports_to Alice)
- Direction matters for hierarchical relationships
- Track: false relationships (hallucinated connections)
- Track: missed relationships (stated but not extracted)

## Step 4: Evaluate Multi-Hop Queries
Test queries requiring 2-3 relationship hops:
```json
{"query": "Who does Alice's manager work for?", "expected_path": ["Alice → Bob → Acme Corp"], "hops": 2}
{"query": "What products were launched by Alice's company?", "expected_path": ["Alice → Acme Corp → Widget Pro"], "hops": 2}
```

## Step 5: Compare Graph RAG vs Vector RAG
| Query Type | Vector RAG Score | Graph RAG Score | Winner |
|-----------|-----------------|----------------|--------|
| Factual lookup | Measure | Measure | Usually vector |
| Relationship query | Measure | Measure | Usually graph |
| Multi-hop reasoning | Measure | Measure | Always graph |
| Similarity search | Measure | Measure | Always vector |
| Hybrid query | Measure | Measure | Hybrid best |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/graph-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy graph RAG to production |
| Entity F1 < 0.75 | Improve extraction prompt, add entity type examples |
| Relationships < 0.70 | Add relationship type constraints to prompt |
| Multi-hop < 60% | Increase max traversal depth, improve graph density |
| Graph vs vector no lift | Graph not adding value — use vector RAG instead |

## Evaluation Cadence
- **Pre-deployment**: Full entity + relationship evaluation
- **Weekly**: Spot-check entity extraction on new documents
- **Monthly**: Full multi-hop query evaluation
- **On extraction prompt change**: Re-evaluate entity/relationship accuracy

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Too many entities extracted | No entity type constraints | Limit to "Person, Org, Product, Event" |
| Wrong relationship direction | Prompt doesn't specify direction | Add "from → to" examples |
| Duplicate entities in graph | No entity resolution | Add fuzzy + alias matching |
| Multi-hop returns noise | Too many hops (4+) | Limit to 2-3 hops max |
| Graph too sparse | Only extracting from some docs | Process all documents |
| Vector outperforms graph | Domain has few relationships | Consider vector-only (Play 01) |

## CI/CD Quality Gates
```yaml
- name: Entity Extraction Gate
  run: python evaluation/eval.py --metrics entity_extraction --ci-gate --f1-threshold 0.85
- name: Relationship Gate
  run: python evaluation/eval.py --metrics relationships --ci-gate --precision-threshold 0.80
- name: Multi-Hop Gate
  run: python evaluation/eval.py --metrics multi_hop --ci-gate --success-threshold 0.75
```
