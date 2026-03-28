# Workshop 03: Multi-Agent AI Service — Supervisor + Specialist Agents

> Duration: 120 minutes | Level: Advanced | Audience: AI Engineers, Solution Architects

## Learning Objectives

1. Design a supervisor + specialist agent architecture
2. Configure agent routing, handoff protocols, and shared state
3. Implement guardrails for multi-agent safety (max hops, audit trail)
4. Run evaluation against quality thresholds

## Prerequisites

- Azure subscription with Azure OpenAI access
- Node.js 18+ or Python 3.10+
- VS Code with FrootAI extension

## Workshop Flow

### Part 1: Scaffold Multi-Agent Play (10 min)
```bash
npx frootai scaffold 07-multi-agent-service
cd 07-multi-agent-service
code .
```

### Part 2: Review Supervisor Config (20 min)
- Open `config/openai.json` — examine supervisor routing rules and specialist agent configs
- Open `config/guardrails.json` — review max 5 hops, 30s timeout, audit trail settings

### Part 3: Build the Supervisor (40 min)
Open Copilot Chat:
```
@builder Build a supervisor agent that routes requests to research_agent, action_agent, and analysis_agent based on the user intent
```

### Part 4: Build Specialist Agents (30 min)
```
@builder Build the research_agent that answers questions using the FrootAI knowledge base
```

### Part 5: Test & Evaluate (20 min)
```
@tuner Run evaluation with scores: groundedness=4.2, relevance=3.8, coherence=4.5
```

## Related
- [Solution Play 07](https://frootai.dev/solution-plays)
- [AI Agents Deep Dive](https://frootai.dev/docs/AI-Agents-Deep-Dive)
