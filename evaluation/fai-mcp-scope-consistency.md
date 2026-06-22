# FAI MCP Scope Consistency

> Evaluation check that walks every solution play and asserts that every tool referenced in its agents, skills, and prompts is either an in-process tool OR belongs to a declared `mcp_scope.attached` area.

## Check ID

`fai-mcp-scope-consistency`

## Category

Federation Integrity

## Severity

**Blocking** — fails the evaluation pipeline if any tool reference falls outside the declared MCP scope.

## What This Check Does

1. **Loads each play's declared MCP scope** from:
   - Play `agent.md` frontmatter → `mcp_scope.attached[]`
   - Play `spec/mcp-scope.json` → `attached[]`

2. **Collects all tool references** used within the play's content:
   - Agent `tools:` arrays in frontmatter
   - Skill tool invocations (tool names in step definitions)
   - Prompt templates that reference `{{tool.<area>.<name>}}` patterns

3. **Classifies each tool** as either:
   - **In-process** — built-in tools (`codebase`, `terminal`, `file`, `search`, `browser`) that don't require MCP
   - **MCP-federated** — prefixed tools (`azure.deploy_resource`, `github.create_pr`) that require an attached area

4. **Asserts** that every MCP-federated tool's area prefix is present in the play's `mcp_scope.attached[]` list.

## Pass Criteria

- Every tool reference with an area prefix (`<area>.<tool>`) has its `<area>` listed in `mcp_scope.attached`.
- In-process tools (no dot prefix, or well-known built-in names) are always allowed.
- Plays with no `mcp_scope` declaration pass if they reference zero MCP-federated tools.

## Fail Examples

```
FAIL: solution-plays/21-agentic-rag/agent.md
  Tool "azure.search_index" references area "azure"
  but mcp_scope.attached = ["context7"]
  Missing area: "azure" — add to mcp_scope.attached or remove the tool reference

FAIL: solution-plays/29-mcp-gateway/agent.md
  Tool "playwright.navigate" references area "playwright"
  but mcp_scope.attached = ["azure", "github"]
  Missing area: "playwright" — add to mcp_scope.attached

FAIL: solution-plays/42-computer-use-agent/agent.md
  Tool "chrome-devtools.evaluate_js" references area "chrome-devtools"
  but mcp_scope is not declared
  Fix: add mcp_scope.attached: ["chrome-devtools"] to frontmatter
```

## In-Process Tool Allowlist

These tools never require MCP scope declarations:

| Tool | Description |
|------|-------------|
| `codebase` | Workspace file search and reading |
| `terminal` | Shell command execution |
| `file` | File system operations |
| `search` | Semantic/text search |
| `browser` | Built-in browser automation |
| `fetch` | HTTP fetch (built-in) |

Any tool name that does NOT contain a dot separator (`.`) is treated as in-process by default.

## How to Run

### Automated (CI)

```bash
node frootai-core/scripts/orchard/validate-mcp-scope-consistency.js
```

Exit code 0 = pass, exit code 1 = fail with details on stderr.

### Manual Verification

```bash
# For a specific play, list its declared scope
grep -A5 "mcp_scope" frootai/solution-plays/21-agentic-rag/agent.md

# Find all dotted tool references in that play's directory
grep -rhoP '[a-z0-9-]+\.[a-z_]+' frootai/solution-plays/21-agentic-rag/ | sort -u

# Check which area prefixes are used
grep -rhoP '[a-z0-9-]+(?=\.[a-z_]+)' frootai/solution-plays/21-agentic-rag/ | sort -u
```

## Remediation

| Issue | Fix |
|-------|-----|
| Tool references an undeclared area | Add the area to `mcp_scope.attached[]` |
| Play uses zero MCP tools but has `mcp_scope` | Safe to keep (no-op), or remove if decluttering |
| Area declared but no tools reference it | Warning only (over-declaration is safe, wastes attach time) |
| Tool name has a dot but isn't MCP-federated | Add to the in-process allowlist if it's a built-in with a dotted name |

## Edge Cases

### Nested Area References

Some tools use nested prefixes: `azure.ai-search.query_documents`. The area is always the first segment before the first dot: `azure`.

### Dynamic Tool References

Template expressions like `{{tool.${area}.${name}}}` are resolved at runtime. This check validates only static references found in committed content.

### Agent-Level vs Play-Level Scope

If an agent declares `mcpAttachments` but the play doesn't declare `mcp_scope`, the engine still attaches (agent-level preference). This check focuses on play-level consistency. Agent-level declarations are covered by M10.13 (dependency audit).

## Related Checks

- **fai-mcp-dependency-audit** (M10.13) — verifies slugs exist in the roster
- **fai-mcp-trust-policy** (M10.15) — verifies trust levels and overrides

## Implementation Reference

| Component | Path |
|-----------|------|
| Validator script | `frootai-core/scripts/orchard/validate-mcp-scope-consistency.js` |
| Play manifests | `frootai/solution-plays/**/agent.md` |
| Play scope files | `frootai/solution-plays/**/spec/mcp-scope.json` |
| Context resolver | `frootai/engine/context-resolver.js` |

## Evaluation Pipeline Integration

```yaml
# .github/workflows/eval.yml
- name: MCP Scope Consistency
  run: node frootai-core/scripts/orchard/validate-mcp-scope-consistency.js
```

Or invoke from the eval-sdk:

```typescript
import { runCheck } from '@frootai/eval-sdk';

const result = await runCheck('fai-mcp-scope-consistency', {
  playsDir: 'frootai/solution-plays',
});

assert(result.pass, `Scope consistency failed: ${result.errors.join(', ')}`);
```

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-20 | Initial release (M10.14) |
