# FAI MCP Dependency Audit

> Evaluation check that walks every agent, skill, and play in the FrootAI content corpus and asserts that every declared MCP area slug resolves to a known entry in the marketplace roster and is attachable in CI.

## Check ID

`fai-mcp-dependency-audit`

## Category

Federation Integrity

## Severity

**Blocking** — fails the evaluation pipeline if any declared MCP area slug cannot be resolved or attached.

## What This Check Does

1. **Collects all MCP area declarations** from three content surfaces:
   - Agent files (`frootai/agents/*.agent.md`) → `mcpAttachments.required[]`, `.optional[]`, bare arrays
   - Skill files (`frootai/skills/**/*.md`) → `requiresMcp[]`
   - Play files (`frootai/solution-plays/**/agent.md`) → `mcp_scope.attached[]`

2. **Resolves each slug** against the canonical roster (`frootai/data/mcp-servers-seed.json#mcpServers[]`).

3. **Verifies attachability** by confirming the server entry has a valid transport spec (for `providesMcp` plugins) or is a known first-party/verified-publisher area with a registered attach command.

4. **Reports** all unresolvable or unattachable slugs with file location, field name, and suggested fix.

## Pass Criteria

- Every slug declared in any `mcpAttachments`, `requiresMcp`, or `mcp_scope.attached` field resolves to an `id` in `mcp-servers-seed.json`.
- No slug references a server marked `"trust": "untrusted"` (blocked tier).
- For slugs that come from `providesMcp` plugins, the plugin's transport spec is complete (M10.7 rule).

## Fail Examples

```
FAIL: agents/fai-azure-architect.agent.md
  mcpAttachments.required contains "azurr" — not found in mcp-servers-seed.json
  Suggested fix: did you mean "azure"?

FAIL: skills/deploy-landing-zone.md
  requiresMcp contains "arm-templates" — not found in mcp-servers-seed.json
  Suggested fix: add entry to frootai/data/mcp-servers-seed.json or remove declaration

FAIL: solution-plays/21-agentic-rag/agent.md
  mcp_scope.attached contains "context-7" — not found in mcp-servers-seed.json
  Suggested fix: did you mean "context7"? (no hyphen)
```

## How to Run

### Automated (CI)

```bash
node frootai-core/scripts/orchard/validate-mcp-area-slugs.js
```

Exit code 0 = pass, exit code 1 = fail with details on stderr.

### Manual Verification

```bash
# List all declared slugs across the corpus
grep -rh "mcpAttachments\|requiresMcp\|mcp_scope" frootai/agents/ frootai/skills/ frootai/solution-plays/ \
  | grep -oP '"[a-z0-9-]+"' | sort -u

# Compare against the roster
node -e "const d=require('./frootai/data/mcp-servers-seed.json'); console.log(d.mcpServers.map(s=>s.id).sort().join('\n'))"
```

## Remediation

| Issue | Fix |
|-------|-----|
| Typo in slug | Correct the spelling in the declaring file |
| New server not in roster | Add entry to `frootai/data/mcp-servers-seed.json` |
| Deprecated server removed from roster | Remove the slug from all declaring files |
| Server marked `untrusted` | Replace with a trusted alternative or escalate to security team |

## Related Checks

- **fai-mcp-scope-consistency** (M10.14) — verifies tool references match declared areas
- **fai-mcp-trust-policy** (M10.15) — verifies trust levels and overrides

## Implementation Reference

| Component | Path |
|-----------|------|
| Validator script | `frootai-core/scripts/orchard/validate-mcp-area-slugs.js` |
| Seed roster | `frootai/data/mcp-servers-seed.json` |
| Schema (mcpAttachments) | `frootai/schemas/mcp-attachments-v1.schema.json` |
| Schema (providesMcp) | `frootai/schemas/provides-mcp-v1.schema.json` |

## Evaluation Pipeline Integration

Add to your evaluation config or CI workflow:

```yaml
# .github/workflows/eval.yml
- name: MCP Dependency Audit
  run: node frootai-core/scripts/orchard/validate-mcp-area-slugs.js
```

Or invoke from the eval-sdk:

```typescript
import { runCheck } from '@frootai/eval-sdk';

const result = await runCheck('fai-mcp-dependency-audit', {
  agentsDir: 'frootai/agents',
  skillsDir: 'frootai/skills',
  playsDir: 'frootai/solution-plays',
  seedPath: 'frootai/data/mcp-servers-seed.json',
});

assert(result.pass, `MCP dependency audit failed: ${result.errors.join(', ')}`);
```

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial release (M10.13) |
