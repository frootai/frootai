---
name: "deploy-ai-training-curriculum"
description: "Deploy AI Training Curriculum — adaptive learning paths, skill gap analysis, dependency-ordered modules, content generation per learning style, interactive assessments, progress tracking."
---

# Deploy AI Training Curriculum

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for content generation + assessments)
  - `Microsoft.DocumentDB` (Cosmos DB for learner profiles + progress)
  - `Microsoft.App` (Container Apps for curriculum API)
  - `Microsoft.Web` (Static Web Apps for learner portal)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `networkx` (dependency graph), `azure-cosmos` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `COSMOS_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-training-curriculum --location eastus2

az deployment group create \
  --resource-group rg-frootai-training-curriculum \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-training \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-training \
  --name cosmos-conn --value "$COSMOS_CONNECTION"
```

## Step 2: Deploy Skill Taxonomy and Dependency Graph

```python
# skill_taxonomy.py — role-skill matrix with dependencies
import networkx as nx

class SkillTaxonomy:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self):
        """Build skill dependency graph."""
        # Foundation skills
        self.graph.add_node("python-basics", level=1, hours=10)
        self.graph.add_node("git-fundamentals", level=1, hours=5)
        self.graph.add_node("cloud-basics", level=1, hours=8)

        # Intermediate
        self.graph.add_node("data-structures", level=2, hours=15)
        self.graph.add_node("azure-services", level=2, hours=12)
        self.graph.add_node("ml-fundamentals", level=2, hours=20)

        # Advanced
        self.graph.add_node("deep-learning", level=3, hours=30)
        self.graph.add_node("rag-architecture", level=3, hours=15)
        self.graph.add_node("mlops", level=3, hours=20)

        # Dependencies
        self.graph.add_edges_from([
            ("python-basics", "data-structures"),
            ("python-basics", "ml-fundamentals"),
            ("cloud-basics", "azure-services"),
            ("ml-fundamentals", "deep-learning"),
            ("azure-services", "rag-architecture"),
            ("ml-fundamentals", "rag-architecture"),
            ("deep-learning", "mlops"),
        ])

    ROLE_SKILLS = {
        "ml-engineer": {"python-basics": 0.9, "data-structures": 0.8, "ml-fundamentals": 0.9, "deep-learning": 0.8, "mlops": 0.7},
        "ai-architect": {"cloud-basics": 0.9, "azure-services": 0.9, "rag-architecture": 0.8, "ml-fundamentals": 0.7},
        "data-engineer": {"python-basics": 0.9, "data-structures": 0.9, "cloud-basics": 0.8, "azure-services": 0.8},
    }
```

## Step 3: Deploy Adaptive Path Generator

```python
# path_generator.py — personalized learning path
class AdaptivePathGenerator:
    def __init__(self, taxonomy: SkillTaxonomy, config):
        self.taxonomy = taxonomy
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])

    async def generate_path(self, learner: dict) -> dict:
        # 1. Identify skill gaps
        target = self.taxonomy.ROLE_SKILLS[learner["target_role"]]
        gaps = {}
        for skill, required_level in target.items():
            current = learner["current_skills"].get(skill, 0)
            if current < required_level:
                gaps[skill] = {"current": current, "target": required_level, "gap": required_level - current}

        # 2. Topological sort respecting dependencies
        ordered_skills = list(nx.topological_sort(
            self.taxonomy.graph.subgraph(gaps.keys())
        ))

        # 3. Select content per learning style
        modules = []
        for skill in ordered_skills:
            content = await self.select_content(skill, learner["learning_style"])
            modules.append({
                "skill": skill,
                "content": content,
                "estimated_hours": self.taxonomy.graph.nodes[skill]["hours"],
                "gap_size": gaps[skill]["gap"],
            })

        # 4. Calculate timeline
        total_hours = sum(m["estimated_hours"] for m in modules)
        weeks = total_hours / learner["available_hours_per_week"]

        return {
            "learner_id": learner["id"],
            "target_role": learner["target_role"],
            "modules": modules,
            "total_hours": total_hours,
            "estimated_weeks": round(weeks, 1),
            "gaps_identified": len(gaps),
        }

    async def select_content(self, skill, learning_style):
        """Select content format matching learning preference."""
        content_map = {
            "visual": {"format": "video", "provider": "microsoft-learn-video"},
            "reading": {"format": "article", "provider": "microsoft-learn-docs"},
            "hands-on": {"format": "lab", "provider": "azure-sandbox"},
        }
        return content_map.get(learning_style, content_map["hands-on"])
```

## Step 4: Deploy Assessment Engine

```python
# assessment.py — skill-level assessments with LLM generation
class AssessmentEngine:
    async def generate_assessment(self, skill: str, level: int) -> dict:
        """Generate adaptive assessment for skill mastery check."""
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Generate a skill assessment. Return JSON: {questions: [{question, options: [a,b,c,d], correct, explanation, difficulty}]}"},
                {"role": "user", "content": f"Skill: {skill}\nLevel: {level}/3\nQuestions: 5\nMix: 2 conceptual, 2 practical, 1 scenario-based"},
            ],
        )
        assessment = json.loads(response.choices[0].message.content)
        assessment["skill"] = skill
        assessment["level"] = level
        assessment["passing_score"] = 0.7 if level <= 2 else 0.8
        return assessment

    async def evaluate_submission(self, assessment_id, answers) -> dict:
        assessment = await self.get_assessment(assessment_id)
        correct = sum(1 for q, a in zip(assessment["questions"], answers) if q["correct"] == a)
        score = correct / len(assessment["questions"])

        return {
            "score": score,
            "passed": score >= assessment["passing_score"],
            "correct": correct,
            "total": len(assessment["questions"]),
            "feedback": [q["explanation"] for q, a in zip(assessment["questions"], answers) if q["correct"] != a],
        }
```

## Step 5: Deploy Progress Tracker

```python
# progress.py — learner state in Cosmos DB
class ProgressTracker:
    async def update_progress(self, learner_id, module_id, status, score=None):
        progress = await self.cosmos.read_item(learner_id)
        progress["modules"][module_id] = {
            "status": status,  # not_started, in_progress, completed, failed
            "score": score,
            "updated_at": datetime.utcnow().isoformat(),
            "time_spent_minutes": progress["modules"].get(module_id, {}).get("time_spent_minutes", 0),
        }
        progress["overall_completion"] = sum(1 for m in progress["modules"].values() if m["status"] == "completed") / len(progress["modules"])
        await self.cosmos.upsert_item(progress)
```

## Step 6: Deploy Learner Portal

```bash
az staticwebapp create \
  --name training-portal \
  --resource-group rg-frootai-training-curriculum \
  --source https://github.com/frootai/training-portal \
  --branch main

az containerapp create \
  --name training-api \
  --resource-group rg-frootai-training-curriculum \
  --environment training-env \
  --image acrTraining.azurecr.io/training-api:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3
```

## Step 7: Verify Deployment

```bash
curl https://training-api.azurecontainerapps.io/health

# Create learner profile
curl -X POST https://training-api.azurecontainerapps.io/api/learners \
  -d '{"id": "learner-001", "current_skills": {"python-basics": 0.7, "cloud-basics": 0.3}, "target_role": "ml-engineer", "learning_style": "hands-on", "available_hours_per_week": 10}'

# Generate learning path
curl https://training-api.azurecontainerapps.io/api/paths/learner-001

# Take assessment
curl -X POST https://training-api.azurecontainerapps.io/api/assess/python-basics
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Skill taxonomy | Query graph | Nodes + dependencies returned |
| Gap analysis | Submit learner profile | Gaps identified correctly |
| Path ordered | Generate path | Prerequisites before advanced |
| Content matched | Check learning style | Visual→video, hands-on→lab |
| Assessment generated | Request assessment | 5 questions with difficulty mix |
| Score evaluated | Submit answers | Score + feedback returned |
| Progress tracked | Complete module | Cosmos DB updated |
| Timeline estimated | Check path | Weeks based on hours/week |

## Rollback Procedure

```bash
az containerapp revision list --name training-api \
  --resource-group rg-frootai-training-curriculum
az containerapp ingress traffic set --name training-api \
  --resource-group rg-frootai-training-curriculum \
  --revision-weight previousRevision=100
```
