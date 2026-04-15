---
name: fai-vector-index-create
description: "Create and populate a vector search index in Azure AI Search or Cosmos DB"
---

# Vector Index Create — Azure AI Search

Create production vector search indexes with proper schema design, algorithm selection, integrated vectorization, and zero-downtime updates.

## Index Schema Design

Every vector index needs three field categories: key/metadata, searchable text, and vector fields.

```python
from azure.search.documents.indexes.models import (
    SearchIndex, SearchField, SearchFieldDataType,
    VectorSearch, HnswAlgorithmConfiguration, VectorSearchProfile,
    SemanticConfiguration, SemanticSearch, SemanticPrioritizedFields, SemanticField,
    ScoringProfile, TextWeights,
)

fields = [
    SearchField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
    SearchField(name="title", type=SearchFieldDataType.String, searchable=True, analyzer_name="en.microsoft"),
    SearchField(name="chunk", type=SearchFieldDataType.String, searchable=True, analyzer_name="en.microsoft"),
    SearchField(name="category", type=SearchFieldDataType.String, filterable=True, facetable=True),
    SearchField(name="source_url", type=SearchFieldDataType.String, filterable=True),
    SearchField(name="chunk_sequence", type=SearchFieldDataType.Int32, sortable=True),
    # Vector field — dimension must match embedding model output
    SearchField(
        name="content_vector",
        type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
        searchable=True,
        vector_search_dimensions=3072,        # text-embedding-3-large
        vector_search_profile_name="hnsw-profile",
    ),
]
```

### Dimension Selection by Model

| Model | Dimensions | Use Case |
|-------|-----------|----------|
| `text-embedding-3-small` | 1536 (native), 256-512 (truncated) | Cost-sensitive, high-volume |
| `text-embedding-3-large` | 3072 (native), 1024 (truncated) | Max recall, enterprise RAG |
| `text-embedding-ada-002` | 1536 (fixed) | Legacy — migrate away |

Use `dimensions` parameter in the embedding API call to truncate: `client.embeddings.create(model="text-embedding-3-large", input=text, dimensions=1024)`. Lower dimensions = smaller index, faster search, slightly lower recall.

## Vector Algorithm Configuration

```python
vector_search = VectorSearch(
    algorithms=[
        # HNSW: default choice — fast approximate search, good recall
        HnswAlgorithmConfiguration(
            name="hnsw-default",
            parameters={"m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine"},
        ),
        # Exhaustive KNN: exact search — use for small indexes (<50K docs) or reranking
        ExhaustiveKnnAlgorithmConfiguration(
            name="eknn-exact",
            parameters={"metric": "cosine"},
        ),
    ],
    profiles=[
        VectorSearchProfile(name="hnsw-profile", algorithm_configuration_name="hnsw-default"),
        VectorSearchProfile(name="eknn-profile", algorithm_configuration_name="eknn-exact"),
    ],
)
```

**HNSW tuning rules:** `m=4` is default (edges per node). Higher `m` = better recall, more memory. `efConstruction=400` controls build quality — never go below 100. `efSearch=500` controls query quality — raise to 1000 for high-recall needs. Cosine is standard for OpenAI embeddings; use dotProduct only with pre-normalized vectors.

## Semantic Ranker Configuration

Semantic ranker reranks the top 50 results using a cross-encoder. Always enable for RAG.

```python
semantic_config = SemanticConfiguration(
    name="default-semantic",
    prioritized_fields=SemanticPrioritizedFields(
        title_field=SemanticField(field_name="title"),
        content_fields=[SemanticField(field_name="chunk")],
        keywords_fields=[SemanticField(field_name="category")],
    ),
)
semantic_search = SemanticSearch(configurations=[semantic_config], default_configuration_name="default-semantic")
```

## Scoring Profiles

Boost recent or high-priority documents without changing vector logic.

```python
scoring = ScoringProfile(
    name="recency-boost",
    text_weights=TextWeights(weights={"title": 3.0, "chunk": 1.0}),
    functions=[{
        "type": "freshness",
        "fieldName": "last_updated",
        "boost": 2.0,
        "parameters": {"boostingDuration": "P30D"},
        "interpolation": "linear",
    }],
)
```

## Create the Index (Python SDK)

```python
from azure.identity import DefaultAzureCredential
from azure.search.documents.indexes import SearchIndexClient

credential = DefaultAzureCredential()
client = SearchIndexClient(endpoint="https://<search-service>.search.windows.net", credential=credential)

index = SearchIndex(
    name="rag-chunks-v1",
    fields=fields,
    vector_search=vector_search,
    semantic_search=semantic_search,
    scoring_profiles=[scoring],
)
client.create_or_update_index(index)
```

## Bicep Deployment

```bicep
param searchServiceName string
param location string = resourceGroup().location
param sku string = 'standard'  // basic lacks semantic ranker

resource search 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: searchServiceName
  location: location
  sku: { name: sku }
  properties: {
    hostingMode: 'default'
    semanticSearch: 'standard'          // enables semantic ranker
    partitionCount: 1
    replicaCount: 2                     // ≥2 for 99.9% SLA on queries
    publicNetworkAccess: 'disabled'     // private endpoint in production
  }
  identity: { type: 'SystemAssigned' }  // for integrated vectorization
}

// Grant Search Service access to Azure OpenAI for integrated vectorization
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(search.id, 'cognitive-services-openai-user')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalId: search.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Integrated Vectorization (Skillset Pipeline)

Let Azure AI Search embed documents at indexing time — no client-side embedding code needed.

```python
from azure.search.documents.indexes.models import (
    SearchIndexerSkillset, AzureOpenAIEmbeddingSkill,
    SearchIndexerDataSourceConnection, SearchIndexer,
    FieldMapping, IndexingParameters,
)

embedding_skill = AzureOpenAIEmbeddingSkill(
    name="embedding",
    description="Generate embeddings via Azure OpenAI",
    resource_url="https://<aoai-resource>.openai.azure.com",
    deployment_name="text-embedding-3-large",
    model_name="text-embedding-3-large",
    dimensions=3072,
    inputs=[{"name": "text", "source": "/document/chunk"}],
    outputs=[{"name": "embedding", "targetName": "content_vector"}],
)

skillset = SearchIndexerSkillset(name="vectorize-skillset", skills=[embedding_skill])
client.create_or_update_skillset(skillset)
```

## Hybrid Search (Keyword + Vector)

Always use hybrid. Pure vector search misses exact matches; pure keyword misses semantic matches.

```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery

search_client = SearchClient(endpoint=endpoint, index_name="rag-chunks-v1", credential=credential)

results = search_client.search(
    search_text="how to configure RBAC",               # keyword component
    vector_queries=[
        VectorizableTextQuery(
            text="how to configure RBAC",               # vector component (integrated vectorization)
            k_nearest_neighbors=50,
            fields="content_vector",
        ),
    ],
    query_type="semantic",
    semantic_configuration_name="default-semantic",     # reranks merged results
    select=["id", "title", "chunk", "source_url"],
    top=5,
)
for r in results:
    print(f"[{r['@search.reranker_score']:.2f}] {r['title']}: {r['chunk'][:120]}")
```

## Index Aliases for Zero-Downtime Updates

Never reindex in-place. Build a new index, swap the alias.

```python
from azure.search.documents.indexes.models import SearchAlias

# 1. Create new index with updated schema
client.create_or_update_index(SearchIndex(name="rag-chunks-v2", fields=fields_v2, ...))

# 2. Populate new index (run indexer or push documents)
# 3. Swap alias atomically
client.create_or_update_alias(SearchAlias(name="rag-chunks", indexes=["rag-chunks-v2"]))

# 4. Delete old index after validation
client.delete_index("rag-chunks-v1")
```

Applications always query the alias name `rag-chunks`, never the versioned index name.

## Monitoring Index Performance

```python
# Check index stats
stats = client.get_index_statistics("rag-chunks-v1")
print(f"Documents: {stats.document_count}, Size: {stats.storage_size / 1024**2:.1f} MB")

# Key Azure Monitor metrics to alert on (via Bicep/portal):
# - SearchLatency > 500ms (P95)
# - ThrottledSearchQueriesPercentage > 5%
# - DocumentsProcessedCount stalls (indexer health)
# - StorageUsedPercentage > 80% (scale partition)
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 400 on index creation | Dimension mismatch with profile | Ensure `vector_search_dimensions` matches embedding model output |
| Low recall | `efSearch` too low | Raise to 500-1000, or switch to exhaustive KNN for small indexes |
| Slow indexing | Large documents, no chunking | Split to 512-token chunks before indexing |
| Semantic ranker 403 | Basic SKU | Upgrade to Standard — basic lacks semantic ranker |
| Stale results after reindex | Querying old index name | Use aliases — query alias, not versioned index name |
