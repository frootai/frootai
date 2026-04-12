---
name: "deploy-ai-knowledge-management"
description: "Deploy AI Knowledge Management — auto-capture from conversations/docs/tickets, taxonomy generation, semantic dedup, knowledge graph, expertise finder, freshness scoring, access control."
---

# Deploy AI Knowledge Management

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for extraction + classification)
  - `Microsoft.Search` (AI Search for knowledge base index)
  - `Microsoft.DocumentDB` (Cosmos DB for knowledge graph + expertise profiles)
  - `Microsoft.App` (Container Apps for KM API)
  - `Microsoft.KeyVault` (secret management)
- Source system API access (Microsoft Graph for Teams/SharePoint, ServiceNow, Jira)
- `.env` file with: `AZURE_OPENAI_KEY`, `SEARCH_KEY`, `COSMOS_CONNECTION`, `GRAPH_CLIENT_ID`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-knowledge-mgmt --location eastus2

az deployment group create \
  --resource-group rg-frootai-knowledge-mgmt \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-knowledge-mgmt \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-knowledge-mgmt \
  --name search-key --value "$SEARCH_KEY"
```

## Step 2: Deploy Knowledge Capture Pipeline

```python
# capture_pipeline.py — multi-source knowledge extraction
class KnowledgeCapturePipeline:
    def __init__(self, config):
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.sources = config["sources"]

    async def capture(self, source_type: str, content: str) -> list:
        # 1. Extract knowledge items
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXTRACTION_PROMPT},
                {"role": "user", "content": f"Source type: {source_type}\nContent:\n{content[:4000]}"},
            ],
        )
        items = json.loads(response.choices[0].message.content)["items"]

        # 2. Classify into taxonomy
        for item in items:
            item["taxonomy"] = await self.classify(item)
            item["entities"] = await self.extract_entities(item)
            item["freshness_date"] = datetime.utcnow().isoformat()
            item["source_type"] = source_type

        # 3. Semantic deduplication
        unique = await self.deduplicate(items)

        return unique

    async def deduplicate(self, items: list) -> list:
        """Remove near-duplicates using embedding similarity."""
        unique = []
        for item in items:
            embedding = await self.embed(item["content"])
            existing = await self.search_index.search(
                vector_queries=[VectorizedQuery(vector=embedding, k_nearest_neighbors=3, fields="embedding")],
                select=["id", "content"],
            )
            is_duplicate = any(r["@search.score"] > 0.95 for r in existing)
            if not is_duplicate:
                item["embedding"] = embedding
                unique.append(item)
        return unique
```

Source connectors:
| Source | API | What's Captured |
|--------|-----|-----------------|
| Teams conversations | Microsoft Graph | Resolved Q&A, decisions, action items |
| SharePoint docs | Microsoft Graph | Policies, procedures, how-to guides |
| ServiceNow tickets | ServiceNow API | Resolution steps, workarounds, known issues |
| Jira issues | Jira API | Bug fixes, feature decisions, architecture choices |
| Meeting transcripts | Azure Speech + Graph | Key decisions, action items, expertise signals |
| Confluence pages | Confluence API | Technical docs, runbooks, architecture docs |

## Step 3: Deploy Taxonomy Engine

```python
# taxonomy.py — hierarchical classification
class TaxonomyEngine:
    TAXONOMY = {
        "Engineering": ["Architecture", "DevOps", "Security", "Testing", "Performance"],
        "Product": ["Roadmap", "Requirements", "User Research", "Design"],
        "Operations": ["Processes", "Policies", "Compliance", "HR"],
        "Domain": ["Industry", "Competitive", "Market", "Customer"],
    }

    async def classify(self, item: dict) -> dict:
        response = await self.openai.chat.completions.create(
            model="gpt-4o-mini", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": f"Classify into taxonomy: {json.dumps(self.TAXONOMY)}. Return: {{category, subcategory, confidence}}"},
                {"role": "user", "content": item["content"][:1000]},
            ],
        )
        return json.loads(response.choices[0].message.content)
```

## Step 4: Deploy Expertise Finder

```python
# expertise_finder.py — who knows what
class ExpertiseFinder:
    async def build_profile(self, user_id: str) -> dict:
        """Build expertise profile from knowledge contributions."""
        contributions = await self.get_user_contributions(user_id)

        topics = {}
        for item in contributions:
            for entity in item.get("entities", []):
                topics[entity] = topics.get(entity, 0) + 1

        # Rank by contribution count + quality
        expertise = sorted(topics.items(), key=lambda x: x[1], reverse=True)

        return {
            "user_id": user_id,
            "top_expertise": [{"topic": t, "contributions": c} for t, c in expertise[:10]],
            "total_contributions": len(contributions),
            "expertise_level": "expert" if len(contributions) > 50 else "contributor" if len(contributions) > 10 else "beginner",
        }

    async def find_expert(self, topic: str) -> list:
        """Find people with expertise on a topic."""
        experts = await self.search_profiles(topic)
        return sorted(experts, key=lambda e: e["contributions"], reverse=True)[:5]
```

## Step 5: Deploy Knowledge Graph (Cosmos DB)

```python
# knowledge_graph.py — entity relationships
class KnowledgeGraph:
    async def add_knowledge(self, item: dict):
        """Store knowledge item + create entity relationships."""
        # Store item as vertex
        await self.cosmos.upsert_item(item)

        # Create edges between related entities
        for entity in item.get("entities", []):
            await self.create_or_update_entity(entity)
            await self.create_edge(item["id"], entity["id"], "mentions")

        # Create edges between related knowledge items
        related = await self.find_related(item)
        for rel in related:
            await self.create_edge(item["id"], rel["id"], "related_to")
```

## Step 6: Deploy Freshness Scorer

```python
# freshness.py — track knowledge currency
class FreshnessScorer:
    def score(self, item: dict) -> float:
        age_days = (datetime.utcnow() - datetime.fromisoformat(item["freshness_date"])).days
        ttl = item.get("ttl_days", 180)  # Default 6-month TTL

        if age_days > ttl: return 0  # Stale — needs review
        return max(0, 1 - (age_days / ttl))  # Linear decay
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrKM --image knowledge-mgmt:latest .

az containerapp create \
  --name knowledge-mgmt \
  --resource-group rg-frootai-knowledge-mgmt \
  --environment km-env \
  --image acrKM.azurecr.io/knowledge-mgmt:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3

# Test capture
curl -X POST https://knowledge-mgmt.azurecontainerapps.io/api/capture \
  -d '{"source_type": "conversation", "content": "Q: How do we handle database migrations? A: We use Flyway for schema versioning..."}'

# Find expert
curl https://knowledge-mgmt.azurecontainerapps.io/api/experts?topic=database-migrations
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Knowledge captured | POST capture | Items extracted + classified |
| Taxonomy classified | Check item | Category + subcategory assigned |
| Dedup working | Submit duplicate | Second copy rejected |
| Expertise found | GET experts | Top contributors for topic |
| Freshness scored | Check old item | Score < 1.0 for aged content |
| Access control | Unauthorized query | 403 for restricted knowledge |
| Graph relationships | Check Cosmos DB | Entity edges created |
| Search relevance | Query knowledge base | Relevant items returned |

## Rollback Procedure

```bash
az containerapp revision list --name knowledge-mgmt \
  --resource-group rg-frootai-knowledge-mgmt
az containerapp ingress traffic set --name knowledge-mgmt \
  --resource-group rg-frootai-knowledge-mgmt \
  --revision-weight previousRevision=100
```
