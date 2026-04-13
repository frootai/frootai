---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
description: "Operational excellence patterns — CI/CD, observability, IaC, incident management, and deployment automation aligned to Azure Well-Architected Framework."
---
# Operational Excellence — Azure Well-Architected Framework

When implementing or reviewing code, enforce these operational excellence principles:

## CI/CD
- All deployments MUST go through CI/CD pipelines — no manual deployments
- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Run consistency validation before every release (`validate-consistency.js`)
- Use blue-green or canary deployment strategies for production

## Observability
- Structured logging with correlation IDs across all services
- Application Insights for APM, distributed tracing, and metrics
- Custom metrics for AI-specific KPIs (latency, token usage, groundedness)
- Dashboards for real-time operational visibility

## Infrastructure as Code
- All infrastructure MUST be defined in Bicep/Terraform — no portal clicks
- Use parameter files for environment-specific values
- Version control all IaC alongside application code
- Validate templates before deployment (`az deployment validate`)

## Incident Management
- Uptime monitors on all public endpoints (15-min intervals minimum)
- Auto-create GitHub issues on downtime detection
- Runbooks for common failure scenarios (AI endpoint down, search index stale)
- Post-incident reviews with action items

## Automation
- Pre-commit hooks for lint, format, and consistency checks
- Automated dependency updates (Dependabot)
- Automated content sync across distribution channels
- Release automation with changelog generation
