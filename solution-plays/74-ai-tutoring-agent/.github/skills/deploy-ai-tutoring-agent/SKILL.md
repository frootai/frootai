---
name: "deploy-ai-tutoring-agent"
description: "Deploy AI Tutoring Agent — Socratic questioning, adaptive difficulty, knowledge state tracking, misconception detection, personalized learning paths."
---

# Deploy AI Tutoring Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Curriculum content structured by topic + prerequisites
- Python 3.11+ with `azure-openai`, `networkx` (prerequisite graph)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-tutoring \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Socratic tutor conversations (gpt-4o) | S0 |
| Cosmos DB | Learner profiles, knowledge states, session history | Serverless |
| Azure AI Search | Curriculum content retrieval | Basic |
| Azure Content Safety | Student-facing content moderation | S0 |
| Container Apps | Tutoring API + WebSocket for real-time chat | Consumption |
| Azure Key Vault | API keys | Standard |
| App Insights | Session analytics, learning outcome tracking | Pay-as-you-go |

## Step 2: Configure Curriculum Knowledge Base

```python
# Prerequisite graph (NetworkX directed graph)
# Topic A → Topic B means "A must be mastered before B"
CURRICULUM = {
    "math_algebra": {
        "topics": [
            {"id": "variables", "prerequisites": [], "difficulty": 1},
            {"id": "linear_equations", "prerequisites": ["variables"], "difficulty": 2},
            {"id": "quadratic_equations", "prerequisites": ["linear_equations"], "difficulty": 3},
            {"id": "systems_of_equations", "prerequisites": ["linear_equations"], "difficulty": 3},
            {"id": "polynomials", "prerequisites": ["quadratic_equations"], "difficulty": 4},
        ],
        "misconceptions": {
            "sign_errors": "Common in algebraic manipulation — changing signs when moving terms",
            "distribution": "Forgetting to distribute negative sign: -(a+b) ≠ -a+b",
            "division_by_zero": "Setting denominator to zero in rational expressions"
        }
    }
}

# Index curriculum into Azure AI Search
python deploy/index_curriculum.py \
  --curriculum-dir data/curriculum/ \
  --search-endpoint $SEARCH_ENDPOINT \
  --index-name curriculum-content
```

## Step 3: Deploy Socratic Tutor Engine

```python
SOCRATIC_SYSTEM_PROMPT = """You are a Socratic tutor. Follow these rules EXACTLY:

NEVER give the direct answer. Instead:
1. Ask a guiding question that leads toward understanding
2. If stuck after 1 attempt, give a conceptual hint (not the answer)
3. If stuck after 2 attempts, break into smaller steps
4. Only after 3 failed attempts, explain step-by-step
5. Always end with: "Can you explain this in your own words?"

RESPONSE CLASSIFICATION (internal, do not show to student):
- correct: Student got it right → praise specifically what they did well
- partially_correct: Right approach, wrong details → acknowledge the right parts
- misconception: Specific misunderstanding → address the misconception directly
- question: Student asks → answer with another guiding question
- frustration: Short/repeated wrong → encourage, simplify, offer break

Student profile:
- Knowledge state: {knowledge_state}
- Current topic: {topic} (difficulty: {difficulty}/5)
- Misconception history: {misconceptions}
- Streak: {streak} correct in a row
- Emotional state: {emotional_state}
"""

# Deploy as Container App with WebSocket support
az containerapp create \
  --name tutor-api \
  --resource-group rg-frootai-tutoring \
  --environment cae-tutoring \
  --image ghcr.io/frootai/tutoring-agent:latest \
  --target-port 8080 \
  --transport http2
```

## Step 4: Deploy Knowledge State Tracker

```python
class KnowledgeState:
    """Tracks student mastery per topic using Bayesian Knowledge Tracing."""
    
    def __init__(self, student_id: str):
        self.student_id = student_id
        self.topic_mastery = {}  # topic_id → float (0-1)
        self.misconceptions = []  # List of detected misconceptions
        self.streak = 0
        self.total_interactions = 0
    
    def update(self, topic: str, classification: str):
        current = self.topic_mastery.get(topic, 0.3)  # Prior: 30% mastery
        
        if classification == "correct":
            # Bayesian update: P(mastery | correct) increases
            self.topic_mastery[topic] = min(1.0, current + (1 - current) * 0.15)
            self.streak += 1
        elif classification == "misconception":
            self.topic_mastery[topic] = max(0.0, current - 0.10)
            self.streak = 0
            self.misconceptions.append({"topic": topic, "timestamp": now()})
        elif classification == "partially_correct":
            self.topic_mastery[topic] = min(1.0, current + 0.05)
            self.streak = 0
    
    def get_difficulty(self, topic: str) -> int:
        mastery = self.topic_mastery.get(topic, 0.3)
        if mastery < 0.3: return 1  # Beginner
        if mastery < 0.5: return 2  # Developing
        if mastery < 0.7: return 3  # Proficient
        if mastery < 0.9: return 4  # Advanced
        return 5  # Mastery
```

## Step 5: Deploy Content Safety for Minors

```bash
# CRITICAL: Tutoring agents interact with students (possibly minors)
# Content safety must be STRICT
az cognitiveservices account create \
  --name cs-tutoring-safety \
  --resource-group rg-frootai-tutoring \
  --kind ContentSafety --sku S0

# Configure strict thresholds (block anything concerning)
# Violence: 0 (block all), Sexual: 0, Self-harm: 0, Hate: 0
```

## Step 6: Smoke Test

```bash
# Start a tutoring session
curl -s https://api-tutor.azurewebsites.net/api/session/start \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"student_id": "test-001", "subject": "math_algebra", "topic": "linear_equations"}' | jq '.'

# Send student response
curl -s https://api-tutor.azurewebsites.net/api/session/respond \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"session_id": "...", "message": "I think x = 5 because I divided both sides by 2"}' | jq '.'

# Check knowledge state
curl -s https://api-tutor.azurewebsites.net/api/student/test-001/knowledge \
  -H "Authorization: Bearer $TOKEN" | jq '.topic_mastery'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tutor gives direct answers | System prompt not enforced | Strengthen Socratic constraints, add output validation |
| Difficulty never increases | Streak threshold too high | Lower `streak_to_advance` in config |
| Same misconception repeats | Not tracking across sessions | Verify Cosmos DB persistence for learner profiles |
| Content safety false positives | Blocking academic content | Whitelist educational terms in Content Safety |
| WebSocket timeout | Session idle too long | Set keepalive ping interval to 30s |
