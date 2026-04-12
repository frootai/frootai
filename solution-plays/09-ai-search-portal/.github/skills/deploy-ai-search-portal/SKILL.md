---
name: deploy-ai-search-portal
description: "Deploy AI Search Portal — configure index schema, hybrid search, semantic ranking, facets, autocomplete, scoring profiles, indexers. Use when: deploy, provision."
---

# Deploy AI Search Portal

## When to Use
- Deploy Azure AI Search index with hybrid search capabilities
- Configure semantic ranking, facets, and autocomplete
- Set up indexers for data ingestion from multiple sources
- Configure scoring profiles for relevance tuning
- Deploy search portal frontend

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Azure AI Search resource (Standard tier for semantic ranking)
4. Data sources prepared (Blob Storage, SQL, Cosmos DB)
5. Embedding model deployed (text-embedding-3-large)

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure AI Search (Standard S1+ for semantic ranking)
- Azure OpenAI (embedding model deployment)
- Azure Storage (document source, skillset cache)
- Azure App Service / Static Web Apps (portal frontend)
- Azure Monitor (search analytics, query logs)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Create Index Schema
Define index fields with appropriate types and attributes:

| Field | Type | Searchable | Filterable | Facetable | Sortable |
|-------|------|-----------|-----------|----------|---------|
| id | Edm.String | — | — | — | — |
| title | Edm.String | ✅ | — | — | ✅ |
| content | Edm.String | ✅ | — | — | — |
| category | Edm.String | — | ✅ | ✅ | — |
| date | Edm.DateTimeOffset | — | ✅ | — | ✅ |
| author | Edm.String | ✅ | ✅ | ✅ | — |
| contentVector | Collection(Edm.Single) | — | — | — | — |

**Vector configuration**: HNSW algorithm, cosine metric, dimensions matching embedding model (3072 for text-embedding-3-large).

## Step 4: Configure Hybrid Search
```json
{
  "search": {
    "queryType": "semantic",
    "semanticConfiguration": "default-semantic",
    "vectorQueries": [{ "kind": "vector", "fields": "contentVector", "k": 5 }],
    "searchFields": "title,content",
    "select": "id,title,content,category,date"
  }
}
```
Enable all three search modes: BM25 keyword + vector similarity + semantic reranking.

## Step 5: Configure Indexers
| Source | Indexer Type | Schedule | Delta Detection |
|--------|-------------|----------|----------------|
| Blob Storage | blob | Every 5 min | Change detection |
| SQL Database | sql | Every 15 min | High watermark |
| Cosmos DB | cosmosdb | Real-time | Change feed |
| SharePoint | sharepoint | Every 1 hour | Last modified |

**Skillset**: Add cognitive skills for OCR, language detection, entity extraction, and vectorization.

## Step 6: Configure Autocomplete & Suggestions
- Enable suggester on `title` and `category` fields
- Configure autocomplete mode: `twoTerms` (best balance)
- Set minimum prefix length: 2 characters
- Add fuzzy matching for typo tolerance

## Step 7: Deploy Portal Frontend
```bash
# Build and deploy static web app
cd portal/
npm run build
az staticwebapp deploy --app-name $APP_NAME --output-location build/
```

## Step 8: Smoke Test
```bash
# Test keyword search
curl "$SEARCH_ENDPOINT/indexes/portal-index/docs?search=azure+pricing&api-version=2024-07-01"

# Test vector search
python scripts/test_vector_search.py --query "How to deploy containers"

# Test hybrid search
python scripts/test_hybrid_search.py --query "kubernetes scaling" --top 5

# Test autocomplete
curl "$SEARCH_ENDPOINT/indexes/portal-index/docs/autocomplete?search=kub&suggesterName=sg&api-version=2024-07-01"
```

## Post-Deployment Verification
- [ ] Hybrid search returning relevant results
- [ ] Semantic ranking enabled and working
- [ ] Facets populating correctly
- [ ] Autocomplete responding within 100ms
- [ ] Indexer running on schedule without errors
- [ ] Portal frontend loading and querying successfully
- [ ] Search analytics logging queries

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Zero results | Index empty | Check indexer status, verify data source |
| Vector search returns irrelevant | Wrong embedding model | Match query embedding to index embedding model |
| Semantic ranking not working | SKU too low | Requires Standard S1 or higher |
| Slow autocomplete | Too many suggestable fields | Limit suggester to 2-3 fields |
| Indexer fails | Schema mismatch | Compare source schema to index fields |
| Facet counts wrong | Filter not applied | Verify filterable attribute on facet fields |
