---
name: "deploy-continual-learning-agent"
description: "Deploy Continual Learning Agent — persistent memory (episodic+semantic+procedural), reflection loops, knowledge distillation, skill acquisition, memory decay."
---

# Deploy Continual Learning Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Python 3.11+ with `azure-openai`, `azure-search-documents`, `networkx`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-continual-learning \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Reasoning + reflection + distillation (gpt-4o) | S0 |
| Azure AI Search | Episodic memory vector store | Standard S1 |
| Cosmos DB | Semantic memory (knowledge graph) + procedural memory | Serverless |
| Azure Storage | Episode artifacts, reflection logs | Standard LRS |
| Container Apps | Agent API | Consumption |
| Azure Key Vault | API keys | Standard |
| App Insights | Learning telemetry, memory usage tracking | Pay-as-you-go |

## Step 2: Deploy Three-Memory Architecture

```python
# Memory Type 1: Episodic Memory (what happened)
class EpisodicMemory:
    """Stores specific experiences with vector embeddings for retrieval."""
    
    def __init__(self, search_client, embed_model):
        self.search = search_client
        self.embed = embed_model
    
    async def store(self, episode: Episode):
        embedding = await self.embed.encode(episode.summary)
        await self.search.upload_documents([{
            "id": episode.id,
            "task_type": episode.task.type,
            "summary": episode.summary,
            "embedding": embedding.tolist(),
            "outcome": episode.outcome.status,  # success/failure/partial
            "efficiency_score": episode.outcome.efficiency,
            "timestamp": episode.timestamp,
            "importance": episode.importance_score,
            "decay_factor": 1.0  # Decays over time
        }])
    
    async def recall(self, query: str, top_k: int = 5) -> list[Episode]:
        embedding = await self.embed.encode(query)
        results = await self.search.search(
            vector=embedding, top=top_k * 2,
            filter="decay_factor gt 0.1"  # Skip highly decayed memories
        )
        # Rank by: similarity × importance × recency × decay
        return rank_by_relevance(results, top_k)

# Memory Type 2: Semantic Memory (what I've learned)
class SemanticMemory:
    """Knowledge graph of distilled patterns from episodes."""
    
    async def distill(self, episodes: list[Episode]) -> list[Knowledge]:
        """Extract generalizable knowledge from similar episodes."""
        prompt = f"""Analyze these {len(episodes)} similar experiences and extract generalizable knowledge.

Episodes: {json.dumps([e.summary for e in episodes])}

Extract:
1. Pattern: What consistent approach worked across these experiences?
2. Anti-pattern: What consistently failed?
3. Conditions: When does this pattern apply?
4. Confidence: How sure (based on episode count and consistency)?"""
        
        knowledge = await openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": prompt}]
        )
        return parse_knowledge(knowledge)

# Memory Type 3: Procedural Memory (how to do things)
class ProceduralMemory:
    """Learned procedures that improve with experience."""
    
    async def update_skill(self, task_type: str, procedure: str, efficiency: float):
        current = await self.get(task_type)
        if current is None or efficiency > current.avg_efficiency:
            await self.store(Skill(
                task_type=task_type,
                procedure=procedure,
                efficiency=efficiency,
                last_updated=now(),
                execution_count=current.count + 1 if current else 1
            ))
```

## Step 3: Deploy Reflection Engine

```python
async def reflect(self, task: Task, response: Response, outcome: Outcome) -> Reflection:
    """Post-task reflection: what went well, what to improve."""
    
    REFLECTION_PROMPT = """Reflect on this task execution:

Task: {task_description}
Approach taken: {response_summary}
Outcome: {outcome_status} (efficiency: {efficiency})
Similar past episodes: {past_episodes}

Analyze:
1. What worked well in this approach?
2. What could be improved?
3. Was past experience helpful? (If yes, which memory?)
4. Should any knowledge be updated based on this experience?
5. Is there a new pattern emerging (seen 3+ times)?

Output structured reflection."""

    reflection = await openai.chat.completions.create(
        model="gpt-4o", temperature=0.2,
        messages=[{"role": "system", "content": REFLECTION_PROMPT.format(
            task_description=task.description,
            response_summary=response.summary,
            outcome_status=outcome.status,
            efficiency=outcome.efficiency,
            past_episodes=past_episodes_summary
        )}]
    )
    
    return parse_reflection(reflection)
```

## Step 4: Deploy Knowledge Distillation Pipeline

```python
async def distillation_cycle(agent: ContinualAgent):
    """Periodic distillation: episodes → semantic knowledge."""
    
    # 1. Group episodes by task type
    task_types = await agent.episodic_memory.get_task_types()
    
    for task_type in task_types:
        episodes = await agent.episodic_memory.get_by_type(task_type, min_count=3)
        
        if len(episodes) >= 3:
            # 2. Distill patterns from similar episodes
            knowledge = await agent.semantic_memory.distill(episodes)
            
            for k in knowledge:
                # 3. Store only if confidence > threshold
                if k.confidence > 0.7:
                    await agent.semantic_memory.store(k)
                    
                    # 4. Compress: replace detailed episodes with knowledge reference
                    for ep in episodes:
                        ep.decay_factor *= 0.5  # Speed up decay of distilled episodes
                        await agent.episodic_memory.update(ep)
```

## Step 5: Deploy Memory Decay & Forgetting

```python
async def memory_maintenance(agent: ContinualAgent):
    """Periodic memory maintenance: decay old, prune irrelevant."""
    
    # 1. Time-based decay (memories lose importance over time)
    all_episodes = await agent.episodic_memory.get_all()
    for episode in all_episodes:
        age_days = (now() - episode.timestamp).days
        episode.decay_factor *= DECAY_RATES[episode.importance]
        
        if episode.decay_factor < 0.1:
            await agent.episodic_memory.archive(episode)  # Move to cold storage
    
    # 2. Importance-based retention
    DECAY_RATES = {
        "critical": 0.999,  # Almost never forget (mistakes that caused harm)
        "high": 0.99,       # Slow decay (successful complex tasks)
        "normal": 0.97,     # Standard decay
        "low": 0.90         # Fast decay (routine tasks, redundant)
    }
    
    # 3. Capacity management
    if await agent.episodic_memory.count() > MAX_EPISODES:
        await agent.episodic_memory.prune(keep_top_n=MAX_EPISODES, sort_by="importance_x_recency")
```

## Step 6: Smoke Test

```bash
# Process a task (creates episode + triggers reflection)
curl -s https://api-agent.azurewebsites.net/api/process \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task": "Analyze customer feedback for product X", "context": "Q1 2026 reviews"}' | jq '.'

# Check memory state
curl -s https://api-agent.azurewebsites.net/api/memory/status \
  -H "Authorization: Bearer $TOKEN" | jq '.episodic_count, .semantic_count, .procedural_count'

# Recall similar past experiences
curl -s https://api-agent.azurewebsites.net/api/memory/recall \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "customer feedback analysis"}' | jq '.episodes[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Agent doesn't improve over time | No reflection loop | Verify reflect() called after every task |
| Memory bloat (100K+ episodes) | No decay/pruning | Enable maintenance cycle, set MAX_EPISODES |
| Wrong memories recalled | Embedding quality poor | Use text-embedding-3-large, add metadata filters |
| Distillation produces weak knowledge | Too few episodes | Wait for 5+ similar episodes, not 3 |
| Agent forgets critical lessons | Decay too aggressive | Set critical importance for error episodes |
