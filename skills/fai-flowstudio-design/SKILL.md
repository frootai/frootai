---
name: fai-flowstudio-design
description: |
  Design Power Automate FlowStudio orchestration patterns for multi-step AI
  workflows with error handling, approvals, and observability. Use when building
  low-code AI automation on Microsoft Power Platform.
---

# FlowStudio Design Patterns

Design Power Automate flows for AI orchestration with error handling and approvals.

## When to Use

- Building low-code AI automation with Power Automate
- Orchestrating multi-step document processing
- Implementing approval workflows with AI classification
- Connecting Power Platform to Azure AI services

---

## Common Flow Patterns

### Pattern 1: Document Classification + Routing

```
Trigger: Email arrives with attachment
  → Extract attachment
  → Call Azure OpenAI (classify document type)
  → Switch on classification:
    → Invoice → Route to Finance approval
    → Contract → Route to Legal review
    → Other → Route to General inbox
```

### Pattern 2: AI-Powered Approval

```
Trigger: Form submission
  → Call Azure OpenAI (analyze request risk)
  → If risk == "high":
    → Send approval to manager (with AI analysis)
    → Wait for approval
  → If risk == "low":
    → Auto-approve
  → Process request
  → Send confirmation
```

## Error Handling

```json
{
  "actions": {
    "Call_OpenAI": {
      "type": "Http",
      "runAfter": {},
      "inputs": {
        "method": "POST",
        "uri": "@{variables('openai_endpoint')}/chat/completions"
      }
    },
    "Handle_OpenAI_Error": {
      "type": "Compose",
      "runAfter": { "Call_OpenAI": ["Failed", "TimedOut"] },
      "inputs": "OpenAI call failed: @{body('Call_OpenAI')}"
    }
  }
}
```

## Best Practices

| Practice | Why |
|----------|-----|
| Use environment variables for endpoints | No hardcoded URLs |
| Add retry policy on HTTP actions | Handle transient failures |
| Log to Application Insights | Observability |
| Use child flows for reusable logic | DRY principle |
| Set timeout on approval steps | Prevent stuck flows |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flow fails silently | No error handling | Add runAfter for Failed/TimedOut |
| OpenAI timeout | Large prompt or cold start | Add retry, increase timeout |
| Approval stuck | No timeout on approval | Set deadline action |
| Variables not resolving | Wrong expression syntax | Use @{variables('name')} syntax |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
