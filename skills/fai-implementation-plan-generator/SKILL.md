---
name: fai-implementation-plan-generator
description: |
  Generate implementation plans with milestones, dependencies, acceptance criteria,
  risk assessment, and delivery governance. Use when planning multi-week projects
  or creating IMPLEMENTATION_PLAN.md files for agentic workflows.
---

# Implementation Plan Generator

Create structured implementation plans with milestones, dependencies, and governance.

## When to Use

- Planning a multi-week engineering project
- Creating IMPLEMENTATION_PLAN.md for agentic loops (Ralph pattern)
- Breaking epics into tracked milestones
- Generating plans from PRDs or specs

---

## Plan Template

```markdown
# Implementation Plan — [Project Name]

## Overview
**Goal:** [One-sentence description]
**Timeline:** [Start] → [End]
**Owner:** [Name]

## Milestones

### M1: Foundation (Week 1)
- [ ] Set up repository with folder structure
- [ ] Provision Azure infrastructure (Bicep)
- [ ] Configure CI/CD pipeline
- **Acceptance:** Infrastructure deployed, pipeline green

### M2: Core Feature (Week 2-3)
- [ ] Implement [primary feature]
- [ ] Add unit tests (>80% coverage)
- [ ] Create evaluation dataset
- **Acceptance:** Feature works end-to-end in dev
- **Depends on:** M1

### M3: Integration (Week 3-4)
- [ ] Connect to external services
- [ ] Integration tests pass
- [ ] Performance benchmarks meet SLO
- **Acceptance:** All services connected, SLOs met
- **Depends on:** M2

### M4: Production (Week 4-5)
- [ ] Deploy to staging, run smoke tests
- [ ] Security review complete
- [ ] Deploy to production
- **Acceptance:** Live with monitoring active
- **Depends on:** M3

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API quota insufficient | Delays M2 | Request quota increase in Week 0 |
| Integration complexity | Delays M3 | Spike in Week 1 |

## Dependencies
- Azure subscription with OpenAI provisioned
- Access to customer data source
```

## Auto-Generation

```python
def generate_plan(spec: str, timeline_weeks: int = 4) -> str:
    return llm(f"""Create an implementation plan from this spec.
Use markdown with milestones, tasks, acceptance criteria, dependencies, and risks.
Timeline: {timeline_weeks} weeks. Use checkboxes for tasks.

Spec:
{spec}""")
```

## Agentic Plan (for Ralph Loop)

```markdown
# IMPLEMENTATION_PLAN.md

## Tasks (ordered by priority)
- [ ] Set up FastAPI project structure
- [ ] Add /chat endpoint with Pydantic models
- [ ] Integrate Azure OpenAI with MI auth
- [ ] Add health check endpoint
- [ ] Write unit tests for chat endpoint
- [ ] Add Dockerfile with multi-stage build
- [ ] Configure CI pipeline
- [ ] Deploy to Azure Container Apps

## Completed
(Agent moves tasks here after implementation + test)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Plan too vague | Generated from one-liner spec | Provide detailed spec or PRD |
| Dependencies missed | No dependency analysis | Draw dependency graph before plan |
| Milestones slip | No weekly checkpoint | Add "Acceptance" criteria per milestone |
| Agent skips tasks | Plan not structured for parsing | Use checkboxes, clear task boundaries |
