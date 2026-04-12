---
name: deploy-knowledge-graph-rag
description: "Deploy Knowledge Graph RAG — configure entity extraction, relationship mapping, Cosmos DB Gremlin graph, graph traversal retrieval, hybrid graph+vector search. Use when: deploy, provision graph RAG."
---

# Deploy Knowledge Graph RAG

## When to Use
- Deploy RAG that uses graph traversal instead of vector similarity
- Configure entity extraction pipeline (people, orgs, concepts, events)
- Build relationship graph in Cosmos DB (Gremlin API)
- Set up graph-based retrieval for multi-hop queries
- Combine graph retrieval with vector search (hybrid)

## How Knowledge Graph RAG Differs from Other RAG Plays
| Aspect | Play 01 (Vector RAG) | Play 21 (Agentic RAG) | Play 28 (Graph RAG) |
|--------|---------------------|----------------------|---------------------|
| Retrieval | Vector similarity | Agent-controlled multi-source | Graph traversal |
| Best for | Similar content | Multi-source queries | Relationship queries |
| Strengths | Fast, simple | Flexible, iterative | Multi-hop reasoning |
| Data model | Flat chunks | Flat chunks + sources | Entities + relationships |
| Query type | "Find similar" | "Search and iterate" | "Who/what is connected to X?" |

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Cosmos DB with Gremlin API enabled
3. Azure OpenAI (gpt-4o for entity extraction, embeddings for hybrid)
4. Azure AI Search (for vector component of hybrid retrieval)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Entity Extraction Pipeline
```python
# Extract entities and relationships from documents
async def extract_entities(document):
    prompt = """Extract entities and relationships from this text.
    Entity types: Person, Organization, Product, Event, Concept, Location
    Output JSON: {"entities": [...], "relationships": [...]}"""
    result = await openai.chat(model="gpt-4o", messages=[
        {"role": "system", "content": prompt},
        {"role": "user", "content": document.text}
    ])
    return parse_entities(result)
```

## Step 3: Build Knowledge Graph
```python
# Gremlin queries to build graph
g.addV('Person').property('name', 'Alice').property('role', 'CTO')
g.addV('Organization').property('name', 'Acme Corp')
g.addE('works_at').from_('Alice').to('Acme Corp').property('since', '2023')
g.addE('reports_to').from_('Alice').to('Bob')
```

| Vertex Type | Properties | Example |
|------------|-----------|---------|
| Person | name, role, department | Alice, CTO |
| Organization | name, type, industry | Acme Corp, Tech |
| Product | name, version, status | Widget Pro, v2.0 |
| Concept | name, definition | "Zero Trust", security model |
| Event | name, date, location | Q4 Launch, 2026-01-15 |

## Step 4: Configure Graph Retrieval
```python
# Graph traversal for multi-hop queries
async def graph_retrieve(query, max_hops=2):
    entities = extract_query_entities(query)
    # Start from query entities, traverse relationships
    context = []
    for entity in entities:
        neighbors = g.V().has('name', entity).bothE().bothV().path().limit(max_hops)
        context.extend(format_subgraph(neighbors))
    return context
```

## Step 5: Configure Hybrid Graph+Vector Retrieval
- Graph retrieval: finds connected entities (relationship context)
- Vector retrieval: finds similar content chunks (semantic context)
- Merge: combine both, deduplicate, rank by relevance + graph distance

## Step 6: Post-Deployment Verification
- [ ] Entity extraction producing correct entities from test docs
- [ ] Graph constructed with expected vertices and edges
- [ ] Graph traversal returning connected entities
- [ ] Hybrid retrieval combining graph + vector results
- [ ] Multi-hop queries resolving correctly (2-3 hops)
- [ ] Groundedness ≥ 0.85 on graph-retrieved answers
- [ ] Entity resolution merging duplicates ("AWS" = "Amazon Web Services")

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Missing relationships | Extraction prompt too narrow | Add relationship type examples |
| Duplicate entities | No entity resolution | Add name normalization + dedup |
| Graph traversal too slow | Too many hops | Limit max_hops to 2-3 |
| Wrong entities extracted | Hallucinated entities | Add "extract only explicitly mentioned" |
| Graph too sparse | Few documents indexed | Process more documents |
| Hybrid ranking wrong | Graph vs vector weight imbalanced | Tune weights (start 50/50) |
