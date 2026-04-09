---
description: "Root coding instructions for Pester Test Development (Play 101)"
applyTo: "**/*"
---

# Pester Test Development — Coding Standards & Project Instructions

## Project Overview
This is the FrootAI Pester Test Development solution play (Play 101). It implements a production-grade Pester Test Development system on Azure using the FAI Protocol for AI primitive unification.

## Architecture
```
┌─────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Client     │────▶│   API Layer   │────▶│  Processing      │
│   (HTTPS)    │◀────│   (FastAPI)   │◀────│  Pipeline        │
└─────────────┘     └───────────────┘     └──────────────────┘
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │  Azure       │     │  Azure OpenAI    │
                    │  Key Vault   │     │  (GPT-4o)        │
                    └──────────────┘     └──────────────────┘
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │  App         │     │  Data Store      │
                    │  Insights    │     │  (Search/DB)     │
                    └──────────────┘     └──────────────────┘
```

## File Structure
| Directory | Purpose |
|-----------|---------|
| `.github/agents/` | Builder, reviewer, tuner agents |
| `.github/instructions/` | Coding standards per domain |
| `.github/prompts/` | Slash commands (/deploy, /test, /review, /evaluate) |
| `.github/skills/` | Multi-step operations (deploy, evaluate, tune) |
| `.github/workflows/` | AI-driven CI/CD pipelines |
| `config/` | All configuration (models, guardrails, agents) |
| `evaluation/` | Quality evaluation pipeline (eval.py, test-set.jsonl) |
| `infra/` | Bicep IaC (main.bicep, parameters.json) |
| `mcp/` | MCP server plugin integration |

## Coding Standards

### Pester 5.x Syntax Rules
- MUST use Pester 5.x syntax: Should -Be (not Should Be)
- MUST use BeforeAll for dot-sourcing source files (not script scope)
- MUST mock all Azure cmdlets in unit tests (no real API calls)
- MUST verify mocks with Should -Invoke -Times -Exactly
- MUST use TestDrive for file system operations
- MUST use -TestCases for data-driven tests
- MUST add -Tag (Unit, Integration) to Describe blocks
- MUST NOT mock the function under test — only mock dependencies
- Target ≥90% line coverage, ≥80% branch coverage, 100% function coverage

### PowerShell Best Practices
- Always use [CmdletBinding()] on functions
- Always add [OutputType()] attribute
- Always add [Parameter()] with proper validation
- Use approved verbs: Get, Set, New, Remove, Invoke, Test
- Handle errors with try/catch and -ErrorAction Stop
- Never use Write-Host for programmatic output

### Python
- Python 3.10+ required
- Use `async/await` for all I/O operations
- Type hints on all function signatures
- Pydantic models for data validation
- `DefaultAzureCredential` for all Azure auth
- Structured logging with `logging` module
- `pytest` for testing with `pytest-asyncio`

### TypeScript/JavaScript
- TypeScript 5.0+ with strict mode
- ESModules (import/export, not require)
- `@azure/identity` for Azure auth
- Zod for runtime validation
- Structured logging with correlation IDs

### Bicep
- Use `@description` decorators on all parameters
- Conditional resources for dev/prod (`if (environment == 'prod')`)
- RBAC role assignments for Managed Identity
- Diagnostic settings on all resources
- Tags on all resources: project, play, environment, managedBy

## Naming Conventions

### Files
- Python: `snake_case.py` (e.g., `document_processor.py`)
- TypeScript: `kebab-case.ts` (e.g., `query-handler.ts`)
- Config: `kebab-case.json` (e.g., `model-comparison.json`)
- Bicep: `kebab-case.bicep` (e.g., `main.bicep`)

### Code
- Functions: `snake_case` (Python), `camelCase` (TypeScript)
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Config keys: `snake_case` in JSON

### Azure Resources
- Pattern: `{type}-{project}-{environment}`
- Resource Group: `rg-frootai-{env}`
- OpenAI: `oai-frootai-{env}`
- Key Vault: `kv-frootai-{suffix}`
- Storage: `stfrootai{env}` (no hyphens)

## Error Handling

### Pattern
```python
from enum import Enum

class ErrorCategory(Enum):
    VALIDATION = "validation_error"
    AUTH = "auth_error"
    RATE_LIMIT = "rate_limit"
    SERVICE = "service_error"
    SAFETY = "content_blocked"
    TIMEOUT = "timeout_error"
    INTERNAL = "internal_error"

class AppError(Exception):
    def __init__(self, category: ErrorCategory, message: str, details: dict = None):
        self.category = category
        self.message = message
        self.details = details or {}
        super().__init__(message)
```

### Rules
1. Every external call must have try/except with specific exception types
2. Retry transient failures (429, 503) with exponential backoff
3. Circuit breaker for persistent failures (5+ consecutive)
4. Log errors with correlation ID and context
5. Return user-friendly messages (never raw stack traces)

## Testing Requirements
- **Unit tests:** Business logic, 80%+ coverage
- **Integration tests:** Azure SDK calls with mocks
- **E2E tests:** Full request-response cycle
- **Load tests:** 100 concurrent users baseline
- **Evaluation:** All metrics must pass thresholds

## Configuration
All parameters come from `config/*.json` files. Never hardcode:
- Model names or versions
- Temperature, max_tokens, top_p
- Safety thresholds
- Retry counts and timeouts
- Endpoint URLs
- SKU names

## Deployment
1. Validate: `az bicep lint -f infra/main.bicep`
2. Deploy: `azd up --environment {env}`
3. Verify: `curl {url}/health`
4. Evaluate: `python evaluation/eval.py --ci-gate`
5. Monitor: Check Application Insights for errors

## Security Checklist
- [ ] Managed Identity for all Azure auth
- [ ] Key Vault for all secrets
- [ ] Content Safety on user-facing outputs
- [ ] Input validation with Pydantic/Zod
- [ ] HTTPS only (TLS 1.2+)
- [ ] No secrets in git (pre-commit hook)
- [ ] RBAC with least-privilege
- [ ] Audit logging enabled

## Dependencies
Keep dependencies minimal and pinned:
```
azure-identity==1.19.0
azure-ai-openai==1.0.0
azure-keyvault-secrets==4.9.0
azure-monitor-opentelemetry==1.6.4
fastapi==0.115.0
pydantic==2.10.0
uvicorn==0.34.0
```


## Performance Optimization
- Use connection pooling for all HTTP clients
- Set appropriate timeouts: connect=5s, read=30s, total=60s
- Cache frequently accessed data with appropriate TTL
- Use streaming for large responses
- Implement request coalescing for duplicate queries
- Use batch operations for bulk data processing

## Monitoring & Alerting
Required alerts for production:
| Alert | Condition | Severity |
|-------|-----------|----------|
| Error rate high | > 5% in 5 min window | Critical |
| Latency spike | p95 > 5s for 10 min | Warning |
| Token budget exceeded | > daily limit | Critical |
| Health check failure | 3 consecutive failures | Critical |
| Safety violation | Any severity 6 content | Critical |
| Disk usage high | > 85% | Warning |

## Documentation Standards
- README.md: Architecture, quickstart, configuration, troubleshooting
- Code comments: Explain WHY, not WHAT (the code shows what)
- API docs: Request/response examples with all fields
- Config docs: Inline comments in JSON explaining each field
- ADRs: Record significant architectural decisions

## Git Workflow
- Feature branches from main: `feature/{play-id}-{description}`
- Commit messages: `feat(play-01): description`
- PR requires: passing CI, code review, evaluation gate
- Squash merge to main
- Tag releases: `v{play-id}.{major}.{minor}.{patch}`

## Versioning
- This play follows semantic versioning: MAJOR.MINOR.PATCH
- Breaking changes: new required config fields, removed endpoints
- Minor: new optional features, additional metrics
- Patch: bug fixes, documentation updates
