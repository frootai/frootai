---
name: "deploy-semantic-code-search"
description: "Deploy Semantic Code Search — AST-aware code parsing, function-level embedding, docstring/comment indexing, hybrid keyword+vector search, incremental re-indexing, access control."
---

# Deploy Semantic Code Search

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for embeddings)
  - `Microsoft.Search` (AI Search for code index)
  - `Microsoft.App` (Container Apps for search API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `tree-sitter`, `azure-search-documents` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `SEARCH_ENDPOINT`, `SEARCH_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-code-search --location eastus2

az deployment group create \
  --resource-group rg-frootai-code-search \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-code-search \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-code-search \
  --name search-key --value "$SEARCH_KEY"
```

## Step 2: Deploy Embedding Model

```bash
# Deploy text-embedding-3-large for code embeddings
az cognitiveservices account deployment create \
  --name openai-code-search \
  --resource-group rg-frootai-code-search \
  --deployment-name text-embedding-3-large \
  --model-name text-embedding-3-large \
  --model-version "1" \
  --model-format OpenAI \
  --sku-capacity 120 --sku-name Standard
```

Embedding model comparison for code:
| Model | Dimensions | Cost/1M tokens | Best For |
|-------|-----------|---------------|----------|
| text-embedding-3-small | 1536 | $0.02 | Budget-conscious, smaller codebases |
| text-embedding-3-large | 3072 | $0.13 | Production code search (recommended) |
| CodeBERT | 768 | Free (local) | Open-source, code-specific |

## Step 3: Deploy AST-Aware Code Parser

```python
# code_parser.py — language-aware function extraction
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser

class CodeParser:
    PARSERS = {
        ".py": (tspython.language(), ["function_definition", "class_definition"]),
        ".ts": (tsjs.language(), ["function_declaration", "class_declaration", "arrow_function"]),
        ".js": (tsjs.language(), ["function_declaration", "class_declaration", "arrow_function"]),
    }

    def parse_file(self, filepath: str, content: str) -> list:
        """Extract functions/classes with signature, docstring, body."""
        ext = os.path.splitext(filepath)[1]
        if ext not in self.PARSERS:
            return [{"type": "file", "content": content[:2000], "path": filepath}]

        lang, node_types = self.PARSERS[ext]
        parser = Parser(lang)
        tree = parser.parse(content.encode())

        chunks = []
        for node in self._walk_tree(tree.root_node, node_types):
            chunk = {
                "type": node.type,
                "name": self._extract_name(node),
                "signature": self._extract_signature(node, content),
                "docstring": self._extract_docstring(node, content),
                "body": content[node.start_byte:node.end_byte][:1000],
                "path": filepath,
                "start_line": node.start_point[0] + 1,
                "end_line": node.end_point[0] + 1,
                "language": ext.lstrip("."),
            }
            chunks.append(chunk)
        return chunks
```

## Step 4: Deploy Embedding Pipeline

```python
# embedder.py — multi-field code embedding
class CodeEmbedder:
    def __init__(self, config):
        self.client = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.model = config.get("embedding_model", "text-embedding-3-large")
        self.batch_size = config.get("batch_size", 100)

    async def embed_chunks(self, chunks: list) -> list:
        """Embed code chunks with separate fields for search."""
        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i:i+self.batch_size]

            # Combined embedding: signature + docstring + body preview
            texts = [f"{c.get('docstring', '')}\n{c.get('signature', '')}\n{c.get('body', '')[:500]}" for c in batch]

            response = await self.client.embeddings.create(
                model=self.model, input=texts
            )

            for j, embedding in enumerate(response.data):
                batch[j]["embedding"] = embedding.embedding

        return chunks
```

## Step 5: Deploy AI Search Index

```python
# indexer.py — Azure AI Search code index
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex, SearchField, SearchFieldDataType,
    VectorSearch, HnswAlgorithmConfiguration, VectorSearchProfile,
    SemanticConfiguration, SemanticSearch, SemanticPrioritizedFields, SemanticField,
)

def create_code_index(client: SearchIndexClient, index_name: str):
    fields = [
        SearchField(name="id", type=SearchFieldDataType.String, key=True),
        SearchField(name="path", type=SearchFieldDataType.String, filterable=True),
        SearchField(name="name", type=SearchFieldDataType.String, searchable=True),
        SearchField(name="signature", type=SearchFieldDataType.String, searchable=True),
        SearchField(name="docstring", type=SearchFieldDataType.String, searchable=True),
        SearchField(name="body", type=SearchFieldDataType.String, searchable=True),
        SearchField(name="language", type=SearchFieldDataType.String, filterable=True, facetable=True),
        SearchField(name="type", type=SearchFieldDataType.String, filterable=True),  # function, class
        SearchField(name="start_line", type=SearchFieldDataType.Int32),
        SearchField(name="repo", type=SearchFieldDataType.String, filterable=True),
        SearchField(name="embedding", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                     searchable=True, vector_search_dimensions=3072, vector_search_profile_name="code-vector"),
    ]

    vector_search = VectorSearch(
        algorithms=[HnswAlgorithmConfiguration(name="hnsw")],
        profiles=[VectorSearchProfile(name="code-vector", algorithm_configuration_name="hnsw")],
    )

    semantic = SemanticSearch(configurations=[
        SemanticConfiguration(name="code-semantic", prioritized_fields=SemanticPrioritizedFields(
            title_field=SemanticField(field_name="name"),
            content_fields=[SemanticField(field_name="docstring"), SemanticField(field_name="body")],
        ))
    ])

    index = SearchIndex(name=index_name, fields=fields, vector_search=vector_search, semantic_search=semantic)
    client.create_or_update_index(index)
```

## Step 6: Deploy Search API

```python
# search_api.py — hybrid keyword + vector search
class CodeSearchAPI:
    async def search(self, query: str, filters: dict = None) -> list:
        # 1. Embed the natural language query
        query_embedding = await self.embed(query)

        # 2. Hybrid search: keyword (function names) + vector (meaning)
        results = self.search_client.search(
            search_text=query,  # Keyword component
            vector_queries=[VectorizedQuery(
                vector=query_embedding, k_nearest_neighbors=10,
                fields="embedding", exhaustive=True,
            )],
            query_type="semantic",
            semantic_configuration_name="code-semantic",
            select=["path", "name", "signature", "docstring", "body", "language", "start_line", "repo"],
            filter=self._build_filter(filters),  # repo, language
            top=10,
        )

        return [self._format_result(r) for r in results]
```

## Step 7: Deploy Incremental Indexer (Webhook)

```python
# webhook.py — re-index on git push (changed files only)
async def handle_push_webhook(payload):
    commits = payload["commits"]
    changed_files = set()
    for commit in commits:
        changed_files.update(commit.get("added", []))
        changed_files.update(commit.get("modified", []))

    # Re-index only changed files
    for filepath in changed_files:
        if any(filepath.endswith(ext) for ext in [".py", ".ts", ".js", ".tsx", ".jsx"]):
            content = await fetch_file_content(payload["repository"], filepath, payload["after"])
            chunks = parser.parse_file(filepath, content)
            embedded = await embedder.embed_chunks(chunks)
            await indexer.upload_documents(embedded)
```

## Step 8: Verify Deployment

```bash
curl https://code-search.azurecontainerapps.io/health

# Test search
curl "https://code-search.azurecontainerapps.io/api/search?q=authentication+error+handling&language=python"

# Test NL query
curl "https://code-search.azurecontainerapps.io/api/search?q=how+to+retry+failed+API+calls"
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Index created | AI Search portal | Code index active |
| Functions indexed | Query by name | Function chunks with signatures |
| Docstrings indexed | Query by description | Docstring-based results |
| Vector search | NL query | Semantically similar code |
| Keyword search | Function name query | Exact name matches |
| Hybrid ranking | Combined query | Both vector + keyword results |
| Language filter | `language=python` | Only Python results |
| Repo filter | `repo=myrepo` | Scoped to repo |
| Incremental index | Push code change | New code searchable in <30s |
| Access control | Unauthorized user | 403 for private repos |

## Rollback Procedure

```bash
az containerapp revision list --name code-search \
  --resource-group rg-frootai-code-search
az containerapp ingress traffic set --name code-search \
  --resource-group rg-frootai-code-search \
  --revision-weight previousRevision=100
```
