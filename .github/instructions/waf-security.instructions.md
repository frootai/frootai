---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
description: "Security patterns — Managed Identity, Key Vault, RBAC, content safety, prompt injection defense, and OWASP LLM Top 10 aligned to Azure Well-Architected Framework."
---
# Security — Azure Well-Architected Framework

When implementing or reviewing code, enforce these security principles:

## Identity & Access
- NEVER hardcode secrets, API keys, or connection strings in code
- Use Azure Managed Identity for all service-to-service authentication
- Use Azure Key Vault for secrets management
- Implement RBAC with least-privilege principle
- Use Microsoft Entra ID for user authentication

## Network Security
- Enable private endpoints for all PaaS services in production
- Use NSGs to restrict traffic between subnets
- Enable DDoS protection on public-facing endpoints
- Use Azure Front Door or Application Gateway for WAF

## Data Protection
- Encrypt data at rest (Azure default) AND in transit (TLS 1.2+)
- Enable customer-managed keys (CMK) for sensitive workloads
- Implement data classification and apply appropriate controls
- PII must be detected and masked before logging

## AI-Specific Security
- Implement content safety filters on all AI endpoints
- Rate-limit AI API calls per user/tenant
- Log all AI interactions for audit (without PII)
- Validate and sanitize all prompts before sending to AI models
- Never expose raw model errors to users

## Supply Chain
- Pin all dependency versions in production
- Run `npm audit` / `pip audit` in CI pipelines
- Use GitHub Dependabot for automated security updates
