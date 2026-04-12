---
name: "deploy-research-paper-ai"
description: "Deploy Research Paper AI — multi-source paper search, structured extraction, thematic literature review, citation network analysis, research gap identification."
---

# Deploy Research Paper AI

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Semantic Scholar API key (free tier: 100 req/sec)
- Python 3.11+ with `azure-openai`, `semanticscholar`, `networkx`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-research-ai \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Paper extraction + synthesis + gap analysis (gpt-4o) | S0 |
| Azure AI Search | Paper index with semantic search | Standard S1 |
| Cosmos DB | Paper metadata, extraction cache, review history | Serverless |
| Azure Storage | Full-text PDFs, extracted sections | Standard LRS |
| Container Apps | Research AI API | Consumption |
| Azure Key Vault | API keys for paper databases | Standard |

## Step 2: Configure Paper Search Sources

```python
PAPER_SOURCES = {
    "semantic_scholar": {
        "api": "https://api.semanticscholar.org/graph/v1",
        "fields": "title,abstract,authors,year,citationCount,references,externalIds",
        "rate_limit": "100/sec (with API key)",
        "coverage": "200M+ papers across all fields"
    },
    "arxiv": {
        "api": "http://export.arxiv.org/api/query",
        "fields": "title,summary,authors,published,categories",
        "rate_limit": "1 req/3 sec",
        "coverage": "CS, Physics, Math, Biology preprints"
    },
    "pubmed": {
        "api": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "fields": "title,abstract,authors,journal,pubdate,pmid,doi",
        "rate_limit": "10 req/sec (with API key)",
        "coverage": "36M+ biomedical papers"
    },
    "crossref": {
        "api": "https://api.crossref.org/works",
        "fields": "DOI, title, author, published, reference",
        "rate_limit": "50 req/sec (polite pool)",
        "coverage": "150M+ DOIs, cross-publisher"
    }
}

async def search_papers(query: str, sources: list[str], top_k: int = 50) -> list[Paper]:
    """Multi-source paper search with deduplication."""
    all_papers = []
    for source in sources:
        papers = await search_source(source, query, limit=top_k)
        all_papers.extend(papers)
    
    # Deduplicate by DOI (primary) or title similarity (fallback)
    deduplicated = deduplicate_papers(all_papers, method="doi_then_title")
    
    # Rank by relevance + citation count
    ranked = rank_papers(deduplicated, query, weights={"relevance": 0.6, "citations": 0.3, "recency": 0.1})
    return ranked[:top_k]
```

## Step 3: Deploy Structured Extraction Engine

```python
EXTRACTION_SCHEMA = {
    "objective": "What research question or hypothesis is addressed?",
    "methodology": "What methods, datasets, models were used?",
    "key_findings": "What are the main results? Include numbers.",
    "limitations": "What limitations do the authors acknowledge?",
    "future_work": "What do the authors suggest for future research?",
    "contributions": "What is novel about this work compared to prior art?"
}

async def extract_structured(paper: Paper) -> PaperSummary:
    """Extract structured information from a paper."""
    # Prefer full text over abstract when available
    content = paper.full_text if paper.full_text else paper.abstract
    
    response = await openai.chat.completions.create(
        model="gpt-4o",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[{
            "role": "system",
            "content": f"""Extract structured information from this academic paper.
Fields: {json.dumps(EXTRACTION_SCHEMA)}
Rules:
1. Include specific numbers, metrics, datasets mentioned
2. If information is not available, say "Not reported"
3. For methodology: include model names, dataset sizes, evaluation metrics
4. For key_findings: include quantitative results (accuracy, F1, etc.)
5. Never invent information not in the paper"""
        }, {
            "role": "user",
            "content": content
        }]
    )
    return PaperSummary(**json.loads(response.choices[0].message.content))
```

## Step 4: Deploy Literature Synthesis Engine

```python
async def synthesize_review(summaries: list[PaperSummary], topic: str) -> str:
    """Generate thematic literature review from extracted summaries."""
    prompt = f"""Synthesize a literature review on: {topic}

Papers: {json.dumps([s.dict() for s in summaries])}

Rules:
1. Group by THEME, not chronologically
2. Compare and contrast findings across papers
3. Identify points of agreement and disagreement
4. Note methodological trends (what methods are most common?)
5. Every claim must cite the specific paper(s) [Author, Year]
6. End with research gaps — what hasn't been studied yet?
7. Never cite papers not in the provided list
8. Use academic tone but clear language"""

    return await generate_with_citations(prompt, summaries)
```

## Step 5: Deploy Citation Network Analysis

```python
import networkx as nx

async def build_citation_network(papers: list[Paper]) -> CitationGraph:
    """Build and analyze citation graph."""
    G = nx.DiGraph()
    
    for paper in papers:
        G.add_node(paper.id, title=paper.title, year=paper.year, citations=paper.citation_count)
        for ref in paper.references:
            if ref.id in {p.id for p in papers}:
                G.add_edge(paper.id, ref.id)
    
    # Key metrics
    metrics = {
        "most_cited": sorted(G.nodes, key=lambda n: G.in_degree(n), reverse=True)[:10],
        "bridges": list(nx.bridges(G.to_undirected())),
        "clusters": list(nx.community.greedy_modularity_communities(G.to_undirected())),
        "influential": nx.pagerank(G)
    }
    return CitationGraph(graph=G, metrics=metrics)
```

## Step 6: Deploy Research Gap Identifier

```python
async def identify_gaps(summaries: list[PaperSummary], topic: str) -> list[ResearchGap]:
    """Identify research gaps from literature analysis."""
    prompt = f"""Analyze these {len(summaries)} papers on "{topic}" and identify research gaps.

A research gap is:
1. A question no paper has addressed
2. A methodology no one has tried
3. A dataset/domain that's understudied
4. A limitation multiple papers share but none solve
5. A contradiction between papers that needs resolution

For each gap, provide:
- description: What's missing
- evidence: Which papers suggest this gap exists
- impact: Why filling this gap matters (high/medium/low)
- suggested_approach: How future research could address it

Return 3-5 highest-impact gaps."""

    return await extract_gaps(prompt, summaries)
```

## Step 7: Smoke Test

```bash
# Search for papers
curl -s https://api-research.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "retrieval augmented generation", "sources": ["semantic_scholar", "arxiv"], "top_k": 20}' | jq '.papers[:3] | .[].title'

# Generate literature review
curl -s https://api-research.azurewebsites.net/api/review \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic": "retrieval augmented generation", "num_papers": 30}' | jq '.synthesis | .[0:500]'

# Identify research gaps
curl -s https://api-research.azurewebsites.net/api/gaps \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic": "retrieval augmented generation"}' | jq '.gaps[:2]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hallucinated citations | LLM citing from training data | Force RAG: only cite papers in search results |
| Missing papers from search | Single-source query | Enable multi-source (Semantic Scholar + arXiv + PubMed) |
| DOI doesn't resolve | Preprint or retracted paper | Verify DOI via Crossref, mark if unresolvable |
| Extraction misses methodology | Abstract-only extraction | Use full text when available (PDF → text extraction) |
| Review reads as list, not synthesis | Chronological, not thematic | Enforce thematic grouping in prompt |
