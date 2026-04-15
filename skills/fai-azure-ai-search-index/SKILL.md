---
name: fai-azure-ai-search-index
description: |
  Design and configure Azure AI Search indexes with semantic ranking, vector search,
  hybrid retrieval, and ingestion pipelines. Use this skill when:
  - Creating a new search index for RAG or knowledge retrieval
  - Configuring hybrid search (keyword + vector + semantic reranking)
  - Tuning index fields, analyzers, and scoring profiles
  - Setting up indexer pipelines with skillsets for document enrichment
---

# Azure AI Search Index Design

Configure Azure AI Search indexes for hybrid retrieval with vector, keyword, and semantic ranking.

## When to Use

- Building RAG pipelines that need grounded retrieval
- Creating knowledge bases with structured and unstructured content
- Migrating from keyword-only search to hybrid or vector search
- Tuning search relevance with custom scoring profiles

---

## Index Schema Design

```json
{
  "name": "docs-index",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true, "filterable": true },
    { "name": "title", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft" },
    { "name": "content", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft" },
    { "name": "contentVector", "type": "Collection(Edm.Single)",
      "searchable": true, "dimensions": 1536,
      "vectorSearchProfile": "vector-profile" },
    { "name": "category", "type": "Edm.String", "filterable": true, "facetable": true },
    { "name": "lastUpdated", "type": "Edm.DateTimeOffset", "filterable": true, "sortable": true }
  ],
  "vectorSearch": {
    "algorithms": [{ "name": "hnsw-algo", "kind": "hnsw",
      "hnswParameters": { "m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine" }}],
    "profiles": [{ "name": "vector-profile", "algorithm": "hnsw-algo",
      "vectorizer": "openai-vectorizer" }],
    "vectorizers": [{ "name": "openai-vectorizer", "kind": "azureOpenAI",
      "azureOpenAIParameters": { "resourceUri": "https://oai.openai.azure.com",
        "deploymentId": "text-embedding-3-small", "modelName": "text-embedding-3-small" }}]
  },
  "semantic": {
    "configurations": [{ "name": "semantic-config",
      "prioritizedFields": {
        "titleField": { "fieldName": "title" },
        "contentFields": [{ "fieldName": "content" }]
      }}]
  }
}
```

## Hybrid Search Query

```python
from azure.search.documents import SearchClient
from azure.identity import DefaultAzureCredential

client = SearchClient(
    endpoint="https://search-prod.search.windows.net",
    index_name="docs-index",
    credential=DefaultAzureCredential()
)

results = client.search(
    search_text="How to configure retry policies",
    vector_queries=[{
        "kind": "text",
        "text": "How to configure retry policies",
        "fields": "contentVector",
        "k": 5,
    }],
    query_type="semantic",
    semantic_configuration_name="semantic-config",
    top=10,
    select=["id", "title", "content", "category"],
)

for r in results:
    print(f"[{r['@search.score']:.2f}] {r['title']}")
```

## Bicep Deployment

```bicep
resource searchService 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: searchName
  location: location
  sku: { name: 'standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    publicNetworkAccess: 'disabled'
    semanticSearch: 'standard'
  }
}
```

## Indexer with Skillset

```json
{
  "name": "blob-indexer",
  "dataSourceName": "blob-datasource",
  "targetIndexName": "docs-index",
  "skillsetName": "enrichment-skillset",
  "parameters": {
    "configuration": {
      "dataToExtract": "contentAndMetadata",
      "parsingMode": "default"
    }
  },
  "fieldMappings": [
    { "sourceFieldName": "metadata_storage_path", "targetFieldName": "id",
      "mappingFunction": { "name": "base64Encode" } }
  ],
  "schedule": { "interval": "PT2H" }
}
```

## Tuning Checklist

| Setting | Default | Recommendation |
|---------|---------|---------------|
| HNSW m | 4 | 4 for <1M docs, 16 for >1M |
| efConstruction | 400 | Higher = better recall, slower indexing |
| efSearch | 500 | Higher = better recall, slower queries |
| Replicas | 1 | 2+ for HA, 3+ for high-concurrency reads |
| Partitions | 1 | Scale based on index size (1 partition ≈ 25GB) |
| Semantic config | Standard | Free tier caps at 1000 queries/month |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low relevance scores | Wrong analyzer or missing semantic config | Switch to en.microsoft analyzer, enable semantic ranking |
| Vector search returns irrelevant results | Embedding model mismatch | Ensure query and index use same embedding model and dimensions |
| Indexer fails with 403 | Missing RBAC on data source | Grant search service MI "Storage Blob Data Reader" on source |
| High latency on queries | Too many results or missing filters | Add filters, reduce top, use select to limit fields |
