---
name: fai-power-automate-flow
description: |
  Build Power Automate flows for document processing, approval workflows,
  and AI integration with error handling and monitoring. Use when creating
  automated workflows on Microsoft Power Platform.
---

# Power Automate Flow Patterns

Build automated workflows with triggers, actions, error handling, and AI integration.

## When to Use

- Automating document processing workflows
- Building approval chains with AI classification
- Integrating Power Platform with Azure AI services
- Creating scheduled data sync flows

---

## Document Processing Flow

```
Trigger: When file created in SharePoint
  → Get file content
  → Call Azure Document Intelligence (extract fields)
  → Create Dataverse record with extracted data
  → If confidence < 0.8: Send approval to reviewer
  → Else: Auto-approve and notify submitter
```

## AI Classification Action

```json
{
  "type": "Http",
  "inputs": {
    "method": "POST",
    "uri": "@{variables('openai_endpoint')}/chat/completions",
    "headers": { "Authorization": "Bearer @{variables('api_key')}" },
    "body": {
      "model": "gpt-4o-mini",
      "messages": [
        { "role": "system", "content": "Classify the document type: invoice, contract, report, other" },
        { "role": "user", "content": "@{triggerBody()?['content']}" }
      ],
      "temperature": 0
    }
  }
}
```

## Error Handling Pattern

```
Main Scope (Try):
  → Action 1
  → Action 2
  → Action 3
Error Scope (Catch):
  Configure: Run after → Main Scope has failed/timed out
  → Log error to Application Insights
  → Send notification to ops team
  → Terminate with status: Failed
Finally Scope:
  Configure: Run after → Main Scope succeeded/failed
  → Clean up temp files
```

## Approval Pattern

```
→ Start and wait for approval (Approvals connector)
  → Assigned to: manager@org.com
  → Details: "AI classified as: @{body('Classify')}"
  → If outcome = 'Approve': Process document
  → If outcome = 'Reject': Notify submitter
  → If timeout (48h): Escalate to director
```

## Best Practices

| Practice | Why |
|----------|-----|
| Use environment variables | No hardcoded URLs/keys |
| Add retry on HTTP actions | Handle transient failures |
| Log to App Insights | Observability across flows |
| Use child flows for reuse | DRY, testable logic |
| Set timeout on approvals | Prevent stuck flows |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flow fails silently | No error scope | Add Configure run after for Failed |
| Approval stuck | No timeout | Add deadline; escalate after 48h |
| HTTP 429 from OpenAI | No retry | Enable retry policy on HTTP action |
| Large file fails | 100MB limit | Split large files or use chunking |

