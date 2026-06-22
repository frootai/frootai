# FAI MCP Trust Policy

> Evaluation check that asserts no solution play forces a `community`-tier MCP server attach without an explicit `trust_overrides` declaration in its manifest.

## Check ID

`fai-mcp-trust-policy`

## Category

Federation Security

## Severity

**Blocking** — fails the evaluation pipeline if any play attaches a community server without documenting the trust override.

## What This Check Does

1. **Loads the MCP servers roster** from `frootai/data/mcp-servers-seed.json` and builds a trust map (`slug → trust level`).

2. **Walks every solution play** and extracts:
   - `mcp_scope.attached[]` from play `agent.md` frontmatter
   - `attached[]` from `spec/mcp-scope.json`
   - `router_config.trust_overrides` keys from both surfaces

3. **Also walks every agent** and extracts:
   - `mcpAttachments.required[]` / `.optional[]` / bare arrays
   - `trustOverrides` keys

4. **For each declared slug**, checks:
   - If trust level is `first-party-ms` → auto-approved ✓
   - If trust level is `verified-publisher` → auto-approved ✓
   - If trust level is `community` → must have a `trust_overrides` entry
   - If trust level is `untrusted` → always blocked (override cannot bypass)

5. **Reports** all policy violations with file location, slug, trust level, and required fix.

## Pass Criteria

- Every `community`-tier slug in `mcp_scope.attached` has a corresponding key in `router_config.trust_overrides`.
- Every `community`-tier slug in `mcpAttachments` has a corresponding key in `trustOverrides`.
- No declaration references an `untrusted`-tier slug (overrides cannot bypass this).
- Plays/agents that only reference `first-party-ms` or `verified-publisher` areas pass without overrides.

## Fail Examples

```
FAIL: solution-plays/99-custom-play/agent.md
  mcp_scope.attached contains "internal-db" (trust: community)
  No trust_overrides entry found for "internal-db"
  Fix: add router_config.trust_overrides.internal-db with review reference

FAIL: agents/fai-data-engineer.agent.md
  mcpAttachments.required contains "sketchy-tool" (trust: community)
  No trustOverrides entry found for "sketchy-tool"
  Fix: add trustOverrides.sketchy-tool with review reference or remove the slug

FAIL: solution-plays/50-risky-play/agent.md
  mcp_scope.attached contains "revoked-server" (trust: untrusted)
  BLOCKED: untrusted-tier servers cannot be attached regardless of overrides
  Fix: remove "revoked-server" from attached list; use a trusted alternative
```

## Trust Level Matrix

| Trust Level | Auto-Approved | Override Possible | Policy |
|-------------|:------------:|:-----------------:|--------|
| `first-party-ms` | ✅ | N/A | Microsoft-published; always trusted |
| `verified-publisher` | ✅ | N/A | Marketplace-verified org; always trusted |
| `community` | ❌ | ✅ | Requires explicit `trust_overrides` with review reference |
| `untrusted` | ❌ | ❌ | Revoked or flagged; permanently blocked |

## Override Value Requirements

The override value must be a non-empty string. Recommended format:

```
<ticket-id> reviewed <date> by <reviewer>, <constraints>
```

Examples of valid overrides:

```json
{
  "trust_overrides": {
    "internal-db": "SEC-4421 reviewed 2026-06-15 by @alice, pinned v2.1.0",
    "custom-search": "INFRA-892 reviewed 2026-05-01 by @bob, read-only tools only"
  }
}
```

Examples that will pass validation but are poor practice:

```json
{
  "trust_overrides": {
    "something": "approved"
  }
}
```

The validator accepts any non-empty string, but PR reviewers should enforce the ticket-reference format.

## How to Run

### Automated (CI)

```bash
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

Exit code 0 = pass, exit code 1 = fail with details on stderr.

### Manual Verification

```bash
# List all community-tier servers in the roster
node -e "const d=require('./frootai/data/mcp-servers-seed.json'); d.mcpServers.filter(s=>s.trust==='community').forEach(s=>console.log(s.id))"

# Find which plays/agents reference community servers
grep -rl "community-slug-name" frootai/agents/ frootai/solution-plays/
```

## Remediation

| Issue | Fix |
|-------|-----|
| Community slug without override | Add `trust_overrides` / `trustOverrides` with a review ticket reference |
| Untrusted slug referenced | Remove the slug entirely; no override can bypass this |
| Override exists but is empty string | Replace with a meaningful review reference |
| Override for a slug not in `attached` | Harmless (dead override); clean up for clarity |
| Server downgraded from verified to community | Add override or switch to an alternative server |

## Security Rationale

Community MCP servers pose risks because:

1. **No verification gate** — anyone can publish an MCP server package
2. **Tool surface is opaque** — the server controls what tools do at runtime
3. **Data access** — attached servers receive the full conversation context
4. **Supply chain** — unverified packages may have compromised dependencies

The trust override mechanism ensures:
- A human reviewed the server's code and behavior
- The decision is documented and auditable
- The approval is scoped to a specific use case
- Revocation is straightforward (remove the override)

## Related Checks

- **fai-mcp-dependency-audit** (M10.13) — verifies slugs exist in the roster
- **fai-mcp-scope-consistency** (M10.14) — verifies tool references match declared areas

## Implementation Reference

| Component | Path |
|-----------|------|
| Validator script | `frootai-core/scripts/orchard/validate-mcp-trust-policy.js` |
| Seed roster (trust levels) | `frootai/data/mcp-servers-seed.json` |
| Trust model docs | `frootai/cookbook/22-trust-override-walkthrough.md` |

## Evaluation Pipeline Integration

```yaml
# .github/workflows/eval.yml
- name: MCP Trust Policy
  run: node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

Or invoke from the eval-sdk:

```typescript
import { runCheck } from '@frootai/eval-sdk';

const result = await runCheck('fai-mcp-trust-policy', {
  agentsDir: 'frootai/agents',
  playsDir: 'frootai/solution-plays',
  seedPath: 'frootai/data/mcp-servers-seed.json',
});

assert(result.pass, `Trust policy failed: ${result.errors.join(', ')}`);
```

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial release (M10.15) |
