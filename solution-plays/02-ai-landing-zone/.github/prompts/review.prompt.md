# Code Review

> Slash command: /review
> Performs an AI-assisted code review focused on RAG quality and Azure best practices.

## Review Checklist

### Security
- [ ] No hardcoded secrets, API keys, or connection strings
- [ ] All Azure calls use Managed Identity
- [ ] User inputs are validated and sanitized
- [ ] Azure Content Safety applied to inputs and outputs

### RAG Quality
- [ ] Retrieval uses hybrid search (not keyword-only or vector-only)
- [ ] Semantic reranker is applied after initial retrieval
- [ ] Temperature is ≤ 0.3 for factual responses
- [ ] System prompt includes anti-hallucination guardrails
- [ ] Source citations are included in every response
- [ ] Abstention logic: "I don't know" when no relevant chunks found

### Azure Best Practices
- [ ] Private endpoints enabled for all data services
- [ ] Error handling with retry + exponential backoff
- [ ] Application Insights logging with correlation IDs
- [ ] Config values read from config/*.json (not hardcoded)

### Infrastructure
- [ ] Bicep template is idempotent (re-runnable)
- [ ] All resources tagged (environment, project, owner)
- [ ] Parameters externalized in parameters.json

## Severity Levels
- 🔴 **Critical**: Security vulnerability or data leak — must fix before merge
- 🟡 **Warning**: Performance issue or missing best practice — should fix
- 🟢 **Suggestion**: Code style or minor improvement — nice to have
