---
name: "deploy-policy-impact-analyzer"
description: "Deploy Policy Impact Analyzer — provision extraction, stakeholder impact scoring, cost-benefit modeling, public comment analysis, evidence-based recommendation."
---

# Deploy Policy Impact Analyzer

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Regulatory knowledge base (existing policies, economic data, demographic data)
- Python 3.11+ with `azure-openai`, `azure-ai-search`, `pandas`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-policy-impact \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Policy analysis + evidence synthesis (gpt-4o) | S0 |
| Azure AI Search | Regulatory knowledge base + precedent retrieval | Standard S1 |
| Azure Document Intelligence | Extract provisions from policy PDFs | S0 |
| Cosmos DB | Impact assessments, stakeholder data, comment history | Serverless |
| Azure Storage | Policy documents, public comments, evidence base | Standard LRS |
| Container Apps | Analysis API + dashboard | Consumption |
| Azure Key Vault | API keys | Standard |

## Step 2: Index Regulatory Knowledge Base

```python
# Regulatory data sources
KNOWLEDGE_BASE = {
    "existing_regulations": {
        "description": "Current laws and regulations that may be affected",
        "source": "Federal Register + State Codes",
        "index": "regulations"
    },
    "economic_data": {
        "description": "Census data, BLS statistics, industry data",
        "source": "data.gov, BLS, Census Bureau",
        "index": "economic-data"
    },
    "precedent_analyses": {
        "description": "Previous impact assessments for similar policies",
        "source": "CBO reports, OMB analyses, GAO studies",
        "index": "precedent-analyses"
    },
    "stakeholder_registry": {
        "description": "Known stakeholder groups and their characteristics",
        "source": "Industry associations, advocacy groups, demographic data",
        "index": "stakeholders"
    }
}

# Index into AI Search
for source_name, source in KNOWLEDGE_BASE.items():
    await index_documents(source["source"], index_name=source["index"])
```

## Step 3: Deploy Provision Extraction Engine

```python
async def extract_provisions(policy: PolicyDocument) -> list[Provision]:
    """Extract structured provisions from a policy document."""
    # Use Document Intelligence to extract text preserving structure
    text = await doc_intelligence.extract(policy.file_path)
    
    PROVISION_SCHEMA = {
        "provision_id": "Unique identifier",
        "section": "Policy section reference",
        "action": "What the provision does (require, prohibit, authorize, fund)",
        "who_affected": "Groups/entities this applies to",
        "what_changes": "Specific change from current state",
        "when_effective": "Implementation date or phasing",
        "enforcement": "How compliance is enforced",
        "exceptions": "Any exemptions or carve-outs"
    }
    
    provisions = await openai.chat.completions.create(
        model="gpt-4o", temperature=0,
        response_format={"type": "json_object"},
        messages=[{
            "role": "system",
            "content": f"""Extract all provisions from this policy document.
For each provision, extract: {json.dumps(PROVISION_SCHEMA)}
Rules:
1. Extract EVERY actionable provision (not preamble or definitions-only)
2. Use exact quotes from the document for "what_changes"
3. If a field is not specified, say "Not specified"
4. Include ALL affected groups — don't miss small/vulnerable populations"""
        }, {"role": "user", "content": text}]
    )
    return parse_provisions(provisions)
```

## Step 4: Deploy Stakeholder Impact Scoring

```python
STAKEHOLDER_TAXONOMY = {
    "citizens": {
        "subgroups": ["general_public", "low_income", "elderly", "disabled", "rural", "minority"],
        "impact_dimensions": ["cost_of_living", "access_to_services", "rights", "health"]
    },
    "businesses": {
        "subgroups": ["small_business", "mid_market", "enterprise", "startups"],
        "impact_dimensions": ["compliance_cost", "revenue_impact", "competitive_position"]
    },
    "government": {
        "subgroups": ["federal", "state", "local", "agencies"],
        "impact_dimensions": ["implementation_cost", "staffing", "enforcement_burden"]
    },
    "specific_industries": {
        "subgroups": [],  # Auto-detected from provisions
        "impact_dimensions": ["regulatory_burden", "market_access", "innovation"]
    }
}

async def score_stakeholder_impact(provisions: list[Provision], stakeholder: Stakeholder) -> Impact:
    """Estimate costs and benefits for a stakeholder group."""
    # Search for economic evidence
    evidence = await search_evidence(provisions, stakeholder.name)
    
    # Search for precedent (similar policies' measured impact)
    precedents = await search_precedents(provisions, stakeholder.category)
    
    costs = await estimate_costs(provisions, stakeholder, evidence, precedents)
    benefits = await estimate_benefits(provisions, stakeholder, evidence, precedents)
    
    return Impact(
        stakeholder=stakeholder.name,
        costs=costs,  # {"compliance": range(1M, 5M), "operational": range(0.5M, 2M)}
        benefits=benefits,  # {"efficiency": range(2M, 8M), "safety": "qualitative - reduced injuries"}
        net_impact=net_impact_range(costs, benefits),
        confidence="medium",  # low/medium/high based on evidence quality
        evidence_sources=evidence.sources,
        distributional_effect=assess_distributional(costs, benefits, stakeholder.subgroups)
    )
```

## Step 5: Deploy Public Comment Analyzer

```python
async def analyze_public_comments(comments: list[Comment]) -> CommentAnalysis:
    """Analyze public comments with deduplication and theme extraction."""
    # 1. Deduplicate (detect form letter campaigns)
    unique, campaigns = detect_campaigns(comments, similarity_threshold=0.85)
    
    # 2. Sentiment analysis per provision
    sentiments = {}
    for comment in unique:
        provisions_mentioned = await identify_provisions(comment.text)
        for prov in provisions_mentioned:
            sentiments.setdefault(prov, []).append(await classify_sentiment(comment, prov))
    
    # 3. Theme extraction (what are people concerned about?)
    themes = await extract_themes(unique, max_themes=10)
    
    # 4. Stakeholder representation analysis
    representation = analyze_representation(unique)
    # Are all affected groups represented? Missing voices?
    
    return CommentAnalysis(
        total_comments=len(comments),
        unique_comments=len(unique),
        campaigns_detected=len(campaigns),
        sentiments=sentiments,
        themes=themes,
        underrepresented_groups=representation.missing
    )
```

## Step 6: Deploy Evidence-Based Recommendation Engine

```python
async def generate_recommendation(assessment: ImpactAssessment) -> Recommendation:
    """Generate balanced, evidence-based policy recommendation."""
    prompt = f"""Based on this evidence-based impact assessment, generate a balanced policy recommendation.

Provisions: {json.dumps([p.dict() for p in assessment.provisions])}
Stakeholder impacts: {json.dumps([s.dict() for s in assessment.stakeholders])}
Public comment themes: {json.dumps(assessment.comment_analysis.themes)}

Rules:
1. Present arguments FOR and AGAINST the policy with evidence
2. Quantify impacts as RANGES (not point estimates) with confidence levels
3. Identify distributional effects — who bears costs vs who receives benefits
4. Note uncertainty and evidence gaps explicitly
5. Provide 2-3 alternative approaches with trade-off comparison
6. Cite specific data sources for every quantitative claim
7. Use non-partisan, evidence-based language throughout
8. Never recommend "approve" or "reject" — present trade-offs for decision-makers"""
    
    return await generate_with_evidence(prompt, assessment)
```

## Step 7: Smoke Test

```bash
# Analyze a policy document
curl -s https://api-policy.azurewebsites.net/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "policy=@evaluation/data/sample_policy.pdf" | jq '.provisions[:2]'

# Get stakeholder impact
curl -s https://api-policy.azurewebsites.net/api/impact \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"policy_id": "...", "stakeholder": "small_business"}' | jq '.costs, .benefits'

# Analyze public comments
curl -s https://api-policy.azurewebsites.net/api/comments/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"policy_id": "..."}' | jq '.themes[:3], .campaigns_detected'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Provisions missed | Complex legal language | Improve extraction prompt with legal domain examples |
| Cost estimates too wide | Insufficient evidence | Search for more precedent analyses, narrow evidence base |
| Comment campaigns undetected | Paraphrased form letters | Lower similarity threshold to 0.75 |
| Partisan framing detected | Temperature too high | Lower to 0, add bias detection post-filter |
| Stakeholder group missing | Auto-detection incomplete | Add to stakeholder registry manually |
