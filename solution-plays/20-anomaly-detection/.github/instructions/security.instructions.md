# Security Conventions

> Layer 1 — Always-On Context. Security rules that apply to every prompt.

## Secrets Management
- NEVER hardcode API keys, connection strings, or passwords in code
- Use Azure Key Vault references in app configuration
- Use managed identity for all service-to-service authentication
- Rotate secrets every 90 days (enforce via Key Vault rotation policy)

## Data Protection
- PII must be masked/redacted before storing in logs or AI Search index
- Use Azure Content Safety to filter toxic/harmful content in inputs AND outputs
- Encrypt data at rest (Azure default) and in transit (TLS 1.2+)
- Apply column-level security on sensitive fields in search indexes

## Access Control
- Principle of least privilege — only grant RBAC roles actually needed
- Use security groups for role assignments (not individual users)
- Private endpoints for all data services — no public internet access
- Network Security Groups on all subnets

## Code Security
- No eval(), exec(), or dynamic code execution
- Validate all user inputs — sanitize for injection (SQL, prompt, command)
- Use parameterized queries only
- Pin dependency versions — no floating ranges in package.json/requirements.txt

## Audit & Compliance
- Log all LLM interactions to Application Insights (request/response, tokens, latency)
- Retain logs for 90 days minimum
- Tag all resources with compliance metadata
