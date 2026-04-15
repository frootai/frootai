---
name: fai-tech-stack-blueprint
description: |
  Design technology stack blueprints with component selection, tradeoff analysis,
  integration patterns, and upgrade paths. Use when selecting technologies for
  new AI projects or evaluating stack changes.
---

# Tech Stack Blueprint

Select and document technology stacks with tradeoff analysis.

## When to Use

- Starting a new AI project — choosing technologies
- Evaluating alternatives for a specific component
- Documenting stack decisions for the team
- Planning technology upgrades or migrations

---

## AI Application Stack Template

```markdown
## Stack Blueprint — [Project Name]

### Frontend
| Component | Choice | Alternative | Why |
|-----------|--------|------------|-----|
| Framework | Next.js 15 | Astro | SSR + API routes, React ecosystem |
| Styling | Tailwind CSS | CSS Modules | Utility-first, rapid prototyping |
| State | React hooks | Zustand | Built-in, sufficient for chat UI |

### Backend
| Component | Choice | Alternative | Why |
|-----------|--------|------------|-----|
| Runtime | Python 3.11 | .NET 8 | AI ecosystem, Azure SDK support |
| Framework | FastAPI | Flask | Async, auto OpenAPI, Pydantic |
| ORM | SQLAlchemy 2 | Raw SQL | Type-safe queries, migrations |

### AI Services
| Component | Choice | Alternative | Why |
|-----------|--------|------------|-----|
| LLM | Azure OpenAI (GPT-4o) | Anthropic Claude | Enterprise features, Azure integration |
| Embeddings | text-embedding-3-small | ada-002 | 80% cheaper, comparable quality |
| Search | Azure AI Search | Qdrant | Managed, hybrid + semantic |

### Infrastructure
| Component | Choice | Alternative | Why |
|-----------|--------|------------|-----|
| IaC | Bicep | Terraform | Native Azure, type-safe |
| Container | Azure Container Apps | AKS | Simpler, serverless scaling |
| Database | Cosmos DB | PostgreSQL | Global distribution, flexible schema |
| Secrets | Key Vault | App Config | Compliance, rotation policies |
| CI/CD | GitHub Actions | Azure DevOps | OIDC, GitHub-native |

### Observability
| Component | Choice | Alternative | Why |
|-----------|--------|------------|-----|
| APM | Application Insights | Datadog | Native Azure, OpenTelemetry |
| Logging | Log Analytics | Elastic | KQL, integrated dashboards |
| Alerting | Azure Monitor | PagerDuty | Actionable alerts, action groups |
```

## Decision Criteria

| Factor | Weight | How to Evaluate |
|--------|--------|----------------|
| Team expertise | High | What does the team already know? |
| Ecosystem maturity | High | SDK quality, docs, community |
| Azure integration | Medium | Native connectors, MI support |
| Cost | Medium | Licensing, consumption pricing |
| Lock-in risk | Low-Medium | Open standards, portability |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Paralysis of choice | Too many options | Default to Azure-native + Python/Next.js |
| Stack too complex | Over-engineering | Start minimal, add complexity when needed |
| Skills gap | Chose unfamiliar tech | Prioritize team expertise over novelty |
| Vendor lock-in | All-in on one platform | Use open standards where feasible |

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
