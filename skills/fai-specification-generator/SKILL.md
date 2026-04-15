---
name: fai-specification-generator
description: |
  Generate technical specifications with requirements, API contracts,
  data models, and acceptance criteria. Use when creating detailed specs
  for engineering handoff or system design documentation.
---

# Technical Specification Generator

Create detailed specs with requirements, API contracts, and acceptance criteria.

## When to Use

- Writing technical specs for a new feature or system
- Defining API contracts before implementation
- Creating data model specifications
- Documenting acceptance criteria for QA handoff

---

## Spec Template

```markdown
# Technical Specification: [Feature Name]

## 1. Overview
**Author:** [name] | **Date:** [date] | **Status:** Draft

### Problem
[What problem does this solve?]

### Solution
[High-level technical approach]

## 2. API Contract

### POST /api/chat
**Request:**
\```json
{
  "message": "string (required, 1-4000 chars)",
  "model": "string (optional, default: gpt-4o-mini)",
  "context_id": "string (optional, UUID)"
}
\```

**Response (200):**
\```json
{
  "reply": "string",
  "model": "string",
  "tokens": { "prompt": 150, "completion": 300 },
  "context_id": "UUID"
}
\```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Invalid input (validation failed) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## 3. Data Model

### conversations
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-generated |
| user_id | UUID | FK → users, NOT NULL |
| title | VARCHAR(500) | |
| model | VARCHAR(50) | DEFAULT 'gpt-4o-mini' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

## 4. Non-Functional Requirements
- Latency: P95 < 2000ms
- Availability: 99.9%
- Throughput: 100 concurrent users
- Security: Managed Identity, no API keys

## 5. Acceptance Criteria
- [ ] Chat endpoint returns grounded response within 2s
- [ ] Rate limiting returns 429 after 100 req/min
- [ ] Invalid input returns 400 with field-level errors
- [ ] Conversation persisted in Cosmos DB
```

## Auto-Generation

```python
def generate_spec(feature: str, stack: str) -> str:
    return llm(f"""Write a technical specification for:
Feature: {feature}
Stack: {stack}
Include: API contract (request/response/errors), data model, NFRs, acceptance criteria.
Use markdown with code blocks for JSON schemas.""")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Spec too vague | Missing examples | Add concrete JSON request/response |
| API contract ambiguous | No error codes | Document all error scenarios |
| NFRs missing | Not considered | Add latency, throughput, availability targets |
| Spec becomes stale | No update process | Link spec to implementation in PR |
