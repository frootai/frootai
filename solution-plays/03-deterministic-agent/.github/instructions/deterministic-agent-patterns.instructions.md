# Deterministic Agent Patterns

> Layer 1  Always-On Context. Solution-specific patterns for this play.

## Domain
temperature=0, structured JSON, guardrails, anti-sycophancy

## Key Patterns
- Follow the architecture defined in README.md
- Use config/*.json for all tunable parameters
- Reference agent.md for agent personality and constraints
- All Azure services must use private endpoints and managed identity

## Solution-Specific Rules
- Implement the patterns described in this solution play's README
- Always include error handling with Application Insights logging
- Use the evaluation pipeline to verify quality before deployment
