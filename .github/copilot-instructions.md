# FrootAI — Copilot Instructions

> Architecture guidance for implementing FrootAI solutions.

## Agent Workflow
When implementing features, follow the builder → reviewer → tuner chain:
1. **Build**: Implement using config/ values and architecture patterns from FrootAI MCP
2. **Review**: Self-review against security, RAG quality, Azure best practices, config compliance
3. **Tune**: Verify config/*.json values are production-appropriate and evaluation thresholds are met

For explicit agent handoffs, use @builder, @reviewer, or @tuner in Copilot Chat.

## Well-Architected Framework Alignment
All FrootAI solution plays follow the 6 WAF pillars. See `.github/instructions/` for detailed guidance:
- **Reliability**: Retry, circuit breaker, health checks, graceful degradation
- **Security**: Managed Identity, Key Vault, content safety, RBAC
- **Cost Optimization**: Model routing, token budgets, right-sizing
- **Operational Excellence**: CI/CD, observability, IaC, incident management
- **Performance Efficiency**: Caching, streaming, async, bundle optimization
- **Responsible AI**: Content safety, groundedness, fairness, transparency

## Content Sync
When changing tool counts, versions, module counts, or play counts:
1. Update the source of truth (index.js, package.json, knowledge.json)
2. Run `node scripts/sync-content.js` to propagate
3. Run `node scripts/validate-consistency.js` to verify
See `scripts/CONTENT-SOURCE-MAP.md` for the full data flow.

## Release Process
```bash
npm run release:dry    # Preview version bump + changelog
npm run release        # Bump → sync → validate → commit → tag
git push origin main --tags  # Triggers npm + vsce + docker publish
```
