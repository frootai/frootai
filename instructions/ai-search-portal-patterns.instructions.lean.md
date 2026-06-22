---
description: "Play 09 patterns — Search portal patterns — faceted search, semantic ranker, result rendering, analytics, personalization."
applyTo: "**/*.py, **/*.ts, **/*.bicep"
waf:
  - "reliability"
  - "security"
---

# Play 09 — AI Search Portal Patterns — FAI Standards

## Index Schema Design

- Define `SearchableField` with analyzer per language — `en.microsoft` for English, `standard.lucene` as fallback
- Use `SimpleField(filterable=True, facetable=True)` for category/status fields — never mark filterable fields as searchable unless needed
- Scoring profiles: boost `title` 5x, `summary` 2x, `content` 1x — add freshness function on `lastModified` with `magnitude` interpolation
- `ComplexField` for nested metadata (author, tags, permissions) — avoid flattening into top-level fields

```python
from azure.search.documents.indexes.models import (
    SearchIndex, SearchableField, SimpleField, SearchField, SearchFieldDataType,
    VectorSearch, HnswAlgorithmConfiguration, VectorSearchProfile,
    SemanticConfiguration, SemanticSearch, SemanticPrioritizedFields, SemanticField,
    ScoringProfile, TextWeights, FreshnessScoringFunction, FreshnessScoringParameters,
)

fields = [
    SimpleField(name="id", type=SearchFieldDataType.String, key=True),
    SearchableField(name="title", type=SearchFieldDataType.String,
                    analyzer_name="en.microsoft"),
    SearchableField(name="content", type=SearchFieldDataType.String,
                    analyzer_name="en.microsoft"),
    SimpleField(name="category", type=SearchFieldDataType.String,
                filterable=True, facetable=True),
    SimpleField(name="lastModified", type=SearchFieldDataType.DateTimeOffset,
                filterable=True, sortable=True),
    SimpleField(name="allowedGroups", type="Collection(Edm.String)",
                filterable=True),  # security trimming ACL
    SearchField(name="contentVector", type="Collection(Edm.Single)",
                searchable=True, vector_search_dimensions=1536,
                vector_search_profile_name="hnsw-profile"),
]

scoring = ScoringProfile(
    name="default-scoring",
    text_weights=TextWeights(weights={"title": 5.0, "content": 1.0}),
    functions=[FreshnessScoringFunction(
        field_name="lastModified", boost=2.0, interpolation="magnitude",
        parameters=FreshnessScoringParameters(boosting_duration="P30D"),
    )],
)
```

## Vector Search Configuration

- HNSW for online queries (`m=4`, `efConstruction=400`, `efSearch=500`, metric `cosine`) — best latency/recall tradeoff
- Exhaustive KNN only for offline evaluation or small indexes (<50K docs) — prohibitive at scale
- Store vectors as `Collection(Edm.Single)` with dimensionality matching the embedding model (1536 for `text-embedding-3-small`, 3072 for `text-embedding-3-large`)

```python
vector_search = VectorSearch(
    algorithms=[
        HnswAlgorithmConfiguration(name="hnsw-algo", parameters={
            "m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine",
        }),
    ],
    profiles=[VectorSearchProfile(name="hnsw-profile", algorithm_configuration_name="hnsw-algo")],
)
```

## Semantic Ranker + Hybrid Search

- Enable semantic ranker on the index — set `title_field`, `content_fields`, `keyword_fields` in `SemanticConfiguration`
- Hybrid search: keyword BM25 + vector similarity + semantic reranking = best recall + precision
- Always pass `query_type="semantic"` and `semantic_configuration_name` in search calls

```python
semantic_config = SemanticConfiguration(
    name="default-semantic",
    prioritized_fields=SemanticPrioritizedFields(
        title_field=SemanticField(field_name="title"),
        content_fields=[SemanticField(field_name="content")],
    ),
)

# Hybrid search call
results = search_client.search(
    search_text=user_query,
    vector_queries=[VectorizedQuery(
        vector=query_embedding, k_nearest_neighbors=50,
        fields="contentVector",
    )],
    query_type="semantic",
    semantic_configuration_name="default-semantic",
    select=["id", "title", "content", "category"],
    filter=f"allowedGroups/any(g: g eq '{user_group}')",  # security trimming
    facets=["category,count:10"],
    top=20,
)
```

## Integrated Vectorization (Skillset Pipeline)

- Use built-in `AzureOpenAIEmbeddingSkill` in the indexer skillset — avoids custom embedding code
- Chain skills: `SplitSkill` (pages, 2000 chars, 200 overlap) → `AzureOpenAIEmbeddingSkill` → index
- Set `indexProjections` to map chunked output back to a separate chunk index if using parent-child pattern

## Indexer Scheduling & Change Tracking

- `schedule={"interval": "PT5M"}` for near-real-time; `PT1H` for batch sources
- Enable `highWaterMarkChangeDetectionPolicy` on SQL/Cosmos with `_ts` or `lastModified` column
- `softDeleteColumnDeletionDetectionPolicy` — mark deleted rows instead of hard-deleting
- Incremental enrichment: set `cache` on skillset to avoid re-running skills on unchanged docs

## Custom Skills (Azure Functions)

```python
# Azure Function custom skill — entity extraction example
import azure.functions as func
import json

@app.function_name("CustomEntitySkill")
@app.route(route="extract", methods=["POST"])
def extract_entities(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    results = []
    for record in body.get("values", []):
        text = record["data"].get("text", "")
        entities = run_extraction(text)  # your NER logic
        results.append({"recordId": record["recordId"],
                        "data": {"entities": entities}, "errors": [], "warnings": []})
    return func.HttpResponse(json.dumps({"values": results}),
                             mimetype="application/json")
```

- Custom skill contract: accept `{"values": [{"recordId", "data"}]}`, return same shape
- Timeout budget: 230s max per batch — keep individual record processing under 10s
- Managed Identity on the Function App — indexer calls the skill via `resourceId` auth, no API keys

## Facets, Filters, Autocomplete

- Facets: `facets=["category,count:10", "author,count:5"]` — only on `facetable` fields
- Filter syntax: OData — `category eq 'Legal' and lastModified gt 2025-01-01T00:00:00Z`
- Autocomplete: configure `Suggester(name="sg", source_fields=["title"])` — distinct from search
- Suggestions return full field values; autocomplete returns partial term completions

## Security Trimming (Document-Level ACL)

- Index an `allowedGroups` field (`Collection(Edm.String)`) with AAD group Object IDs per document
- At query time: resolve the user's group memberships via Microsoft Graph, inject as OData filter
- NEVER rely on client-side filtering — always server-side `filter` parameter
- For row-level security on SQL sources: use the indexer's connection identity with SQL RLS policies

## Search Analytics

- Log every query: `search_text`, `result_count`, `latency_ms`, `filters_applied`, `user_id` (hashed)
- Track zero-result queries — feed into synonym maps and content gap analysis
- Monitor: `SearchServiceCounters` (document count, storage), `SearchServiceLimits` (throttling)
- KQL: `AzureDiagnostics | where OperationName == "Query.Search" | summarize count() by bin(TimeGenerated, 1h)`

## Managed Identity for Data Sources

```bicep
resource searchService 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: searchName
  location: location
  sku: { name: 'standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    disableLocalAuth: true          // force AAD-only — no API keys
    authOptions: { aadOrApiKey: { aadAuthFailureMode: 'http401WithBearerChallenge' } }
  }
}

// Grant Search Service identity read access to Blob data source
resource blobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(searchService.id, storageAccount.id, 'blob-reader')
  scope: storageAccount
  properties: {
    principalId: searchService.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')  // Storage Blob Data Reader
    principalType: 'ServicePrincipal'
  }
}
```

- `disableLocalAuth: true` — eliminates API key exposure risk entirely
- Data source connections: use `resourceId` format instead of connection strings
- Grant `Search Index Data Contributor` to app identities that push/query documents

## Anti-Patterns

- ❌ Using `simple` query type when semantic ranker is available — loses reranking quality
- ❌ Making all fields `searchable` — inflates index size, slows queries, dilutes relevance
- ❌ Exhaustive KNN on indexes >100K docs — O(n) scan per query kills latency
- ❌ Skipping `allowedGroups` filter and relying on UI to hide unauthorized results
- ❌ Hardcoding API keys in indexer data source connections — use Managed Identity `resourceId`
- ❌ No synonym map — users search "VM" but content says "virtual machine", zero results
- ❌ Polling indexer on a 5-minute schedule for a source that changes once daily — wasted CU
- ❌ Ignoring `@search.rerankerScore` — returning results sorted only by BM25 in hybrid mode

## WAF Alignment

| Pillar | Play 09 Implementation |
|---|---|
| **Security** | `disableLocalAuth`, Managed Identity data sources, document-level ACL filtering, private endpoints for search data plane |
| **Reliability** | Replica count ≥2 for read HA, indexer retry on transient failures, fallback to keyword-only if semantic ranker quota exceeded |
| **Cost** | Semantic ranker on Standard+ only (not free tier), right-size partitions to doc count, use integrated vectorization to avoid separate embedding endpoint costs |
| **Ops Excellence** | Indexer run history monitoring, zero-result query alerts, synonym map versioning in CI/CD, IaC for index schema via Bicep |
| **Performance** | HNSW over exhaustive KNN, `select` to project only needed fields, facet count limits, cache autocomplete suggestions |
| **Responsible AI** | Content Safety on AI-generated answers layered atop search, PII redaction in analytics logs, transparent relevance scoring via `@search.score` |
