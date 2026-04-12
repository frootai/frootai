---
name: "deploy-fai-meta-agent"
description: "Deploy FAI Meta-Agent — play routing engine, DevKit/TuneKit/SpecKit initialization, cross-play intelligence, play combination recommendations."
---

# Deploy FAI Meta-Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- FrootAI play catalog (knowledge.json with all 101 plays)
- Python 3.11+ with `azure-openai`, `azure-search-documents`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-meta-agent \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Play routing + recommendation reasoning (gpt-4o) | S0 |
| Azure AI Search | Play catalog semantic search (101 plays indexed) | Basic |
| Cosmos DB | User context, recommendation history, feedback | Serverless |
| Container Apps | Meta-Agent API + configurator dashboard | Consumption |
| Azure Key Vault | API keys | Standard |

## Step 2: Index Play Catalog

```python
# Play catalog schema (101 entries)
PLAY_CATALOG = {
    "id": str,           # "01" to "101"
    "name": str,          # "Enterprise RAG Q&A"
    "slug": str,          # "01-enterprise-rag"
    "domain": str,        # "rag", "agent", "voice", "security", "infra", etc.
    "industry": [str],    # ["healthcare", "finance", "general"]
    "complexity": str,     # "Low", "Medium", "High", "Very High"
    "services": [str],     # ["Azure OpenAI", "Azure AI Search", ...]
    "tags": [str],         # ["retrieval", "grounding", "hybrid-search"]
    "description": str,
    "prerequisites": [str],
    "compatible_plays": [str],  # Plays that combine well
    "embedding": [float]        # Semantic embedding of description
}

# Index all 101 plays for semantic routing
async def index_play_catalog():
    for play in load_plays_from_knowledge_json():
        embedding = await embed(f"{play.name} {play.description} {' '.join(play.tags)}")
        play.embedding = embedding
        await search_client.upload_documents([play.dict()])
```

## Step 3: Deploy Play Routing Engine

```python
async def route_to_play(user_query: str, user_context: UserContext = None) -> PlayRecommendation:
    """Match user's need to the best solution play(s)."""
    
    # 1. Classify user intent
    intent = await classify_intent(user_query)
    # Returns: {"domain": "rag", "industry": "healthcare", "complexity": "high",
    #           "modality": "text", "regulation": "hipaa"}
    
    # 2. Semantic search over play catalog
    query_embedding = await embed(user_query)
    candidates = await search_client.search(
        vector=query_embedding, top=10,
        filter=build_filter(intent)
    )
    
    # 3. Re-rank by user context
    if user_context:
        candidates = rerank_by_context(candidates, user_context)
        # Factors: existing Azure services, team size, budget, compliance needs
    
    # 4. Check play combinations
    primary = candidates[0]
    complementary = find_complementary_plays(primary, intent)
    
    # 5. Generate recommendation rationale
    rationale = await generate_rationale(primary, complementary, intent, user_context)
    
    return PlayRecommendation(
        primary=primary,
        alternatives=candidates[1:3],
        complementary=complementary,
        rationale=rationale,
        estimated_cost=primary.cost_dev
    )

INTENT_CLASSIFICATION = {
    "domain_keywords": {
        "rag": ["search", "retrieval", "knowledge base", "Q&A", "document"],
        "agent": ["agent", "autonomous", "multi-agent", "orchestrator"],
        "voice": ["voice", "call center", "speech", "TTS", "STT"],
        "security": ["security", "compliance", "OWASP", "hardening"],
        "vision": ["image", "visual", "camera", "detection", "OCR"],
        "data": ["data pipeline", "ETL", "analytics", "marketplace"]
    },
    "industry_keywords": {
        "healthcare": ["hospital", "clinical", "HIPAA", "patient"],
        "finance": ["bank", "trading", "fraud", "compliance", "PCI"],
        "government": ["citizen", "policy", "public", "municipal"],
        "education": ["student", "tutor", "exam", "curriculum"],
        "telecom": ["network", "5G", "churn", "CDR", "tower"]
    }
}
```

## Step 4: Deploy DevKit Initializer

```python
async def initialize_devkit(play_id: str, workspace_path: str) -> InitResult:
    """Initialize a solution play's DevKit in a workspace."""
    play = await get_play(play_id)
    
    # Create DevKit structure
    DEVKIT_FILES = {
        ".github/copilot-instructions.md": play.copilot_instructions,
        ".github/agents/builder.agent.md": play.builder_agent,
        ".github/agents/reviewer.agent.md": play.reviewer_agent,
        ".github/agents/tuner.agent.md": play.tuner_agent,
        ".github/prompts/deploy.prompt.md": play.deploy_prompt,
        ".github/prompts/test.prompt.md": play.test_prompt,
        ".github/prompts/review.prompt.md": play.review_prompt,
        ".github/prompts/evaluate.prompt.md": play.evaluate_prompt,
        ".github/skills/deploy-*/SKILL.md": play.deploy_skill,
        ".github/skills/evaluate-*/SKILL.md": play.evaluate_skill,
        ".github/skills/tune-*/SKILL.md": play.tune_skill,
        ".github/hooks/guardrails.json": play.hooks,
        ".vscode/mcp.json": play.mcp_config,
        ".vscode/settings.json": play.vscode_settings,
        "agent.md": play.root_agent,
    }
    
    # Create TuneKit
    TUNEKIT_FILES = {
        "config/openai.json": play.openai_config,
        "config/guardrails.json": play.guardrails_config,
        "config/agents.json": play.agents_config,
    }
    
    # Create SpecKit
    SPECKIT_FILES = {
        "spec/fai-manifest.json": play.fai_manifest,
        "spec/play-spec.json": play.play_spec,
        "spec/README.md": play.spec_readme,
    }
    
    created = []
    for path, content in {**DEVKIT_FILES, **TUNEKIT_FILES, **SPECKIT_FILES}.items():
        full_path = os.path.join(workspace_path, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as f:
            f.write(content)
        created.append(path)
    
    return InitResult(play=play_id, files_created=len(created), workspace=workspace_path)
```

## Step 5: Deploy Cross-Play Intelligence

```python
PLAY_COMBINATIONS = {
    # RAG + Governance
    "enterprise_rag_governed": {
        "plays": ["01-enterprise-rag", "99-enterprise-ai-governance-hub"],
        "reason": "RAG with AI governance oversight",
        "when": "Enterprise with regulatory requirements"
    },
    # Voice + Security
    "secure_voice": {
        "plays": ["96-realtime-voice-agent-v2", "10-content-moderation"],
        "reason": "Real-time voice with content safety",
        "when": "Customer-facing voice agent"
    },
    # Healthcare + Compliance
    "compliant_healthcare": {
        "plays": ["46-healthcare-clinical-ai", "35-ai-compliance-engine"],
        "reason": "Clinical AI with HIPAA compliance",
        "when": "Healthcare AI deployment"
    },
    # Multi-agent + Evaluation
    "evaluated_agents": {
        "plays": ["07-multi-agent-service", "98-agent-evaluation-platform"],
        "reason": "Multi-agent with quality benchmarking",
        "when": "Complex agent orchestration"
    },
    # Pricing + Inventory
    "retail_intelligence": {
        "plays": ["87-dynamic-pricing-engine", "89-retail-inventory-predictor"],
        "reason": "Price optimization + demand forecasting",
        "when": "Retail with pricing + inventory"
    }
}

async def find_complementary_plays(primary: Play, intent: Intent) -> list[Play]:
    """Find plays that combine well with the primary recommendation."""
    complements = []
    for combo_name, combo in PLAY_COMBINATIONS.items():
        if primary.slug in combo["plays"]:
            other_plays = [p for p in combo["plays"] if p != primary.slug]
            for p in other_plays:
                complements.append({"play": p, "reason": combo["reason"], "when": combo["when"]})
    
    # Also check regulatory needs → suggest compliance plays
    if intent.regulation:
        if "hipaa" in intent.regulation.lower():
            complements.append({"play": "35-ai-compliance-engine", "reason": "HIPAA compliance"})
        if "eu_ai_act" in intent.regulation.lower():
            complements.append({"play": "99-enterprise-ai-governance-hub", "reason": "EU AI Act governance"})
    
    return complements[:3]
```

## Step 6: Deploy Recommendation Feedback Loop

```python
async def track_recommendation(event: RecommendationEvent):
    """Track recommendation → initialization → usage → satisfaction."""
    TRACKING_EVENTS = {
        "recommended": "Play recommended to user",
        "initialized": "User ran 'Init DevKit' for this play",
        "deployed": "User deployed infrastructure",
        "evaluated": "User ran evaluation pipeline",
        "satisfaction": "User rated recommendation (1-5)"
    }
    
    await cosmos.upsert({
        "id": f"{event.user_id}_{event.play_id}",
        "play_id": event.play_id,
        "event": event.type,
        "timestamp": now(),
        "metadata": event.metadata
    })

# Re-train routing model monthly on recommendation feedback
async def retrain_router():
    feedback = await get_all_feedback(months=3)
    # Good recommendations: recommended → initialized → deployed → satisfaction ≥ 4
    # Bad recommendations: recommended → not initialized (or satisfaction < 3)
    positive = [f for f in feedback if f.satisfaction and f.satisfaction >= 4]
    negative = [f for f in feedback if f.not_initialized or (f.satisfaction and f.satisfaction < 3)]
    # Fine-tune routing embeddings
    await retrain_routing_model(positive, negative)
```

## Step 7: Smoke Test

```bash
# Route a user request to the best play
curl -s https://api-meta.azurewebsites.net/api/route \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "I need to build a customer support chatbot with document retrieval for healthcare"}' | jq '.primary, .complementary[:2]'

# Initialize DevKit for a play
curl -s https://api-meta.azurewebsites.net/api/init-devkit \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"play_id": "01", "workspace_path": "/workspace/my-project"}' | jq '.files_created'

# Get play combinations
curl -s https://api-meta.azurewebsites.net/api/combinations \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"primary_play": "01-enterprise-rag"}' | jq '.combinations[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Always recommends Play 01 | Routing too generic | Add domain/industry intent classification |
| Complementary plays irrelevant | Static combination rules | Add dynamic matching based on intent analysis |
| DevKit init creates stale files | Play catalog not updated | Re-index catalog after every play update |
| No feedback tracked | Tracking events not wired | Verify Cosmos connection + event pipeline |
| Routing latency > 2s | Embedding generation slow | Cache embeddings for common queries |
