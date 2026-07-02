# Recipe 20: Author a Play with MCP Scope

> Declare which MCP server areas a solution play requires, configure trust overrides for community servers, and validate the manifest before merging.

## What You'll Build

A solution play that declares `mcp_scope` in its agent frontmatter and/or `spec/mcp-scope.json` — telling the engine which MCP areas to auto-attach when a user selects this play. The engine reads these declarations at play-activation time and wires the federated tool surface before the first agent turn.

## Why Declare mcp_scope on a Play?

Agents declare what they *prefer*; plays declare what the *solution requires*. The distinction matters:

| Surface | Field | Semantics |
|---------|-------|-----------|
| Agent | `mcpAttachments` | Agent-level preference — "I work best with these tools" |
| Play | `mcp_scope.attached` | Play-level requirement — "This solution cannot function without these areas" |
| Skill | `requiresMcp` | Skill-level gate — "Abort this skill if the area isn't attached" |

When a user activates a play, the engine merges all three sources (play + agent + skills) into a single attach plan. The play's `mcp_scope.attached` list is authoritative — the engine guarantees those areas are wired before any agent runs.

## Prerequisites

- FrootAI repo cloned
- An existing solution play under `frootai/solution-plays/`
- Familiarity with the MCP area roster (`frootai/data/mcp-servers-seed.json`)

## Schema Reference

### Agent Frontmatter (agent.md)

The play's `agent.md` can declare `mcp_scope` in its YAML frontmatter:

```yaml
---
description: "Production agent for MCP Gateway (Play 29)"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["azure", "github", "playwright"]
  router_config:
    trust_overrides:
      my-internal-tool: "security-reviewed-2026-Q2"
    detach_on_finish: true
---
```

### Spec File (spec/mcp-scope.json)

For richer configuration, create a dedicated JSON spec:

```json
{
  "$comment": "MCP scope for Play 29 — MCP Gateway",
  "attached": ["azure", "github", "playwright"],
  "router_config": {
    "trust_overrides": {},
    "pre_attach": [],
    "detach_on_finish": true
  }
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `attached` | `string[]` | Area slugs the engine MUST attach before running |
| `router_config.trust_overrides` | `Record<string, string>` | Explicit trust for community servers (slug → reason) |
| `router_config.pre_attach` | `string[]` | Areas to attach during pre-flight (before agent selection) |
| `router_config.detach_on_finish` | `boolean` | Auto-detach areas when the play session ends |

## Steps

### 1. Identify Required MCP Areas

Review your play's architecture and determine which external tool surfaces it needs:

```
Play 21 (Agentic RAG):
  - Needs Azure AI Search → "azure" area
  - Needs library docs grounding → "context7" area
```

### 2. Add mcp_scope to the Play's agent.md

Open `frootai/solution-plays/<your-play>/agent.md` and add `mcp_scope`:

```yaml
---
description: "Production agent for Agentic RAG (Play 21)"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["azure", "context7"]
---
```

### 3. (Optional) Create spec/mcp-scope.json

For plays that need router configuration:

```bash
mkdir -p frootai/solution-plays/21-agentic-rag/spec
```

```json
{
  "attached": ["azure", "context7"],
  "router_config": {
    "trust_overrides": {},
    "detach_on_finish": false
  }
}
```

### 4. Validate Slug Resolution

Run the M10.5 validator to confirm all slugs exist in the roster:

```bash
node frootai-core/scripts/orchard/validate-mcp-area-slugs.js
```

### 5. Validate Trust Policy

Run the M10.6 validator to confirm all areas meet trust requirements:

```bash
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

If your play attaches a community-tier server without a `trust_overrides` entry, the validator will fail:

```
  ❌ 1 untrusted MCP area slug(s) without trust_overrides:

    • solution-plays/21-agentic-rag/agent.md
      mcp_scope.attached: "sketchy-tool" (trust: community)
      Fix: add trust_overrides entry or use a trusted server
```

### 6. Add a Trust Override for Community Servers

If you genuinely need a community-tier server, add an explicit override:

```yaml
mcp_scope:
  attached: ["azure", "my-internal-tool"]
  router_config:
    trust_overrides:
      my-internal-tool: "Reviewed by security team 2026-06-15, ticket SEC-4421"
```

The value is a free-form reason string that documents:
- Who reviewed the server
- When the review happened
- A reference to the approval ticket

### 7. Understand Runtime Merge Behavior

When a user activates your play, the engine performs this merge:

```
1. Load play's mcp_scope.attached        → ["azure", "context7"]
2. Load agent's mcpAttachments.required   → ["azure"]
3. Load agent's mcpAttachments.optional   → ["github"]
4. Load each skill's requiresMcp         → ["azure"]

UNION (required): ["azure", "context7"]   (play attached + agent required)
UNION (optional): ["github"]              (agent optional, not in play)

→ Engine attaches: azure ✓, context7 ✓, github (best-effort)
→ Skill pre-flight: checks requiresMcp ⊆ attached areas
```

### 8. Validate providesMcp (If Your Play Ships a Server)

If your play also *provides* an MCP server for other plays to consume, add a `providesMcp` declaration to `spec/mcp-scope.json`:

```json
{
  "attached": ["azure"],
  "providesMcp": {
    "name": "my-gateway",
    "transport": "stdio",
    "trust": "verified-publisher",
    "command": "node",
    "args": ["dist/server.js"]
  }
}
```

Then run the M10.7 transport spec validator:

```bash
node frootai-core/scripts/orchard/validate-mcp-provides-transport.js
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Declaring `mcp_scope` on the agent under `frootai/agents/` | That's `mcpAttachments` — `mcp_scope` belongs on play-level `agent.md` files |
| Forgetting `trust_overrides` for a community server | Add the override with a review reference, or switch to a trusted alternative |
| Using `required` instead of `attached` in `mcp_scope` | The play-level field is `attached` (not `required`) — all play-level areas are implicitly required |
| Putting `mcp_scope` in `config/agents.json` | Wrong file — use the play's `agent.md` frontmatter or `spec/mcp-scope.json` |

## Next Steps

- **Recipe 21** — Publish a plugin with `providesMcp` (ship your own MCP server)
- **Recipe 22** — Trust override walkthrough (full security review process)
- **Recipe 23** — Troubleshoot MCP attach failures (debugging runtime errors)
