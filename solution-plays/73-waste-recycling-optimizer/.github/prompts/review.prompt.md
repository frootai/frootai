---
mode: "agent"
description: "Review Waste Recycling Optimizer (Play 73) code and architecture"
agent: "reviewer"
tools: ["terminal", "file", "search"]
---

# Review Waste Recycling Optimizer Implementation

You are reviewing the FrootAI Waste Recycling Optimizer solution play (Play 73).

## Review Scope
Perform a comprehensive review covering architecture, security, quality, and WAF alignment.

## Step 1: Architecture Review
- [ ] Solution follows the documented architecture in README.md
- [ ] All Azure resources defined in infra/main.bicep match architecture
- [ ] Service dependencies are clearly documented
- [ ] Data flow follows expected patterns (no unexpected external calls)
- [ ] API contracts are well-defined and documented

## Step 2: Security Review (OWASP LLM Top 10)
- [ ] No hardcoded API keys, secrets, or connection strings in any file
- [ ] DefaultAzureCredential used for all Azure service auth
- [ ] Input validation on all user-facing endpoints
- [ ] Output sanitization before returning LLM responses to users
- [ ] Content Safety API integrated for user-facing content
- [ ] PII detection and handling implemented
- [ ] Rate limiting configured on API endpoints
- [ ] Private endpoints configured for Azure services (production)
- [ ] Key Vault used for all secret storage
- [ ] RBAC role assignments follow least-privilege principle

## Step 3: Code Quality Review
- [ ] Functions have type hints and docstrings
- [ ] Error handling covers all Azure SDK call failure modes
- [ ] Retry with exponential backoff on transient failures
- [ ] Logging uses structured format with correlation IDs
- [ ] No TODO/FIXME/HACK comments left in production code
- [ ] Config values loaded from config/*.json (not hardcoded)
- [ ] Tests exist for business logic (unit) and integrations (integration)

## Step 4: WAF Compliance Check
- [ ] **Reliability:** Health checks, retry policies, circuit breaker
- [ ] **Security:** Managed Identity, Key Vault, Content Safety, RBAC
- [ ] **Cost:** Model routing configured, caching enabled, SKUs right-sized
- [ ] **Ops Excellence:** IaC complete, CI/CD defined, monitoring configured
- [ ] **Performance:** Async patterns, connection pooling, caching
- [ ] **Responsible AI:** Content safety, groundedness checks, source attribution

## Step 5: Configuration Review
- [ ] config/openai.json has appropriate model and temperature settings
- [ ] config/guardrails.json has content safety thresholds defined
- [ ] config/agents.json defines agent behavior and handoff rules
- [ ] All JSON files parse without errors
- [ ] No conflicting configuration between files

## Step 6: Infrastructure Review
- [ ] Bicep compiles without errors: `az bicep build -f infra/main.bicep`
- [ ] All resources have proper tags (project, environment, owner)
- [ ] Managed Identity configured for service-to-service auth
- [ ] Diagnostic settings enabled for all resources
- [ ] Dev/prod environment separation via parameters

## Step 7: Generate Review Report
```markdown
## Review Report — Play 73: Waste Recycling Optimizer
- Architecture: [PASS/FAIL]
- Security: [PASS/FAIL] — [N] issues found
- Code Quality: [PASS/FAIL] — [N] items
- WAF Compliance: [PASS/FAIL] — [N]/6 pillars met
- Configuration: [PASS/FAIL]
- Infrastructure: [PASS/FAIL]
- **Overall: [APPROVED / NEEDS CHANGES]**
```

## Verdict
- **APPROVED:** All checks pass → hand off to @tuner
- **NEEDS CHANGES:** Issues found → return to @builder with specific fix list

After review, document all findings and recommendations in the review report.
