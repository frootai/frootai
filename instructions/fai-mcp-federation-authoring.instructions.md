---
description: "MCP federation authoring — how to fill mcpAttachments, requiresMcp, providesMcp, and mcp_scope schema fields correctly across agents, skills, plays, and plugins."
applyTo: "frootai/agents/**/*.md, frootai/skills/**/*.md, frootai/solution-plays/**/agent.md, frootai/plugins/**/plugin.json"
waf:
  - "reliability"
  - "security"
  - "operational-excellence"
---

# MCP Federation Authoring — Schema Field Guide

## The Four Schema Fields

The FrootAI federation kernel uses four schema fields to declare MCP relationships. Each field belongs to a specific content surface:

| Field | Surface | File Location | Purpose |
|-------|---------|---------------|---------|
| `mcpAttachments` | Agent | `frootai/agents/*.agent.md` (YAML frontmatter) | Which MCP areas this agent prefers |
| `requiresMcp` | Skill | `frootai/skills/**/*.md` (YAML frontmatter) | Which MCP areas this skill needs to function |
| `providesMcp` | Plugin | `frootai/plugins/*/plugin.json` | This plugin ships an MCP server |
| `mcp_scope` | Play | `frootai/solution-plays/**/agent.md` or `spec/mcp-scope.json` | Which MCP areas this play requires at runtime |

## Field 1: mcpAttachments (Agents)

Declares which MCP server areas an agent benefits from or requires.

### Shapes

**Bare array** — all areas treated as optional:

```yaml
mcpAttachments: ["azure", "github"]
```

**Object form** — distinguishes required from optional:

```yaml
mcpAttachments:
  required: ["azure"]
  optional: ["github", "playwright"]
```

**With trust overrides** — for community-tier servers:

```yaml
mcpAttachments:
  required: ["azure", "internal-db"]
  optional: ["github"]
  trustOverrides:
    internal-db: "SEC-4421 reviewed 2026-06-15 by @alice"
```

### Rules

- Use `required` only when the agent cannot produce useful output without the area
- Use `optional` when the agent works without it but gains extra capability
- Every slug must exist in `frootai/data/mcp-servers-seed.json`
- Community-tier slugs require a `trustOverrides` entry
- Do NOT duplicate slugs across `required` and `optional`

## Field 2: requiresMcp (Skills)

Declares which MCP areas a skill needs. The engine aborts the skill at pre-flight if any required area is not attached.

### Shape

```yaml
---
description: "Deploy Azure resources using ARM templates"
requiresMcp: ["azure"]
---
```

### Rules

- List only areas the skill directly invokes tools from
- Keep the list minimal — a skill that calls `azure.deploy_resource` needs `["azure"]`, not `["azure", "github"]`
- If the skill can degrade gracefully without an area, don't list it here — let the agent's `mcpAttachments.optional` handle it
- Every slug must exist in `frootai/data/mcp-servers-seed.json`

## Field 3: providesMcp (Plugins)

Declares that a plugin ships its own MCP server for others to consume.

### Shape (in plugin.json)

```json
{
  "providesMcp": {
    "name": "my-tool",
    "transport": "stdio",
    "trust": "community",
    "publisher": "my-org",
    "command": "node",
    "args": ["dist/server.js"]
  }
}
```

### Rules

- `name` must be kebab-case, 2-64 characters
- `transport` must be `"stdio"`, `"http-sse"`, or `"http-streaming"`
- `stdio` requires `command` (the executable to spawn)
- `http-sse` / `http-streaming` requires `url` (the endpoint)
- `trust` is a self-declaration — the engine re-evaluates it against the trust manifest
- Do NOT claim `first-party-ms` unless the server is genuinely Microsoft-published
- Register the slug in `mcp-servers-seed.json` if you want other plays/agents to reference it

## Field 4: mcp_scope (Plays)

Declares which MCP areas the play requires at runtime. The engine guarantees these are attached before any agent runs.

### Shape (YAML frontmatter in agent.md)

```yaml
mcp_scope:
  attached: ["azure", "github", "playwright"]
  router_config:
    trust_overrides:
      internal-tool: "SEC-1234 reviewed 2026-06-01"
    detach_on_finish: true
```

### Shape (spec/mcp-scope.json)

```json
{
  "attached": ["azure", "context7"],
  "router_config": {
    "trust_overrides": {},
    "pre_attach": [],
    "detach_on_finish": false
  }
}
```

### Rules

- All slugs in `attached` are implicitly required — the engine won't start the play without them
- Use `trust_overrides` for any community-tier slug (same policy as agent `trustOverrides`)
- `detach_on_finish: true` cleans up attached servers when the play session ends
- `pre_attach` lists areas to wire during pre-flight (before agent selection) — rare, use for startup-heavy servers
- If both `agent.md` frontmatter and `spec/mcp-scope.json` exist, the JSON file takes precedence

## Slug Namespace

All four fields reference the same slug namespace — the `id` values in `frootai/data/mcp-servers-seed.json`:

| Slug | Trust | Publisher |
|------|-------|-----------|
| `azure` | first-party-ms | microsoft |
| `github` | first-party-ms | github |
| `playwright` | first-party-ms | microsoft |
| `markitdown` | first-party-ms | microsoft |
| `ms-learn` | first-party-ms | microsoft |
| `context7` | verified-publisher | upstash |
| `chrome-devtools` | verified-publisher | google |

To add a new slug, edit the seed file and run the validators.

## Validation Commands

Run these before committing any MCP field changes:

```bash
# Every slug resolves to the roster
node frootai-core/scripts/orchard/validate-mcp-area-slugs.js

# Community slugs have trust overrides
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js

# providesMcp has complete transport spec
node frootai-core/scripts/orchard/validate-mcp-provides-transport.js
```

## Decision Flowchart

```
You want an agent to use external tools?
  → Add mcpAttachments to the agent's .agent.md

You're writing a skill that calls MCP tools?
  → Add requiresMcp to the skill's .md frontmatter

You're building a play that needs specific MCP areas?
  → Add mcp_scope to the play's agent.md or spec/mcp-scope.json

You're publishing a plugin that IS an MCP server?
  → Add providesMcp to your plugin.json
```

## Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| Putting `mcp_scope` on a standalone agent | Use `mcpAttachments` — `mcp_scope` is play-level only |
| Putting `requiresMcp` on an agent | Use `mcpAttachments` — `requiresMcp` is skill-level only |
| Putting `mcpAttachments` on a skill | Use `requiresMcp` — `mcpAttachments` is agent-level only |
| Putting `providesMcp` on an agent.md | Use `plugin.json` — `providesMcp` is plugin-level only |
| Duplicating slugs in required AND optional | Pick one — if it's truly required, don't also list as optional |
| Using a slug not in mcp-servers-seed.json | Add it to the seed file first, then reference it |
| Claiming `first-party-ms` trust for a community server | Use `"community"` honestly; add trust_overrides where needed |
| Forgetting to run validators before pushing | Add to pre-commit hook or CI workflow |

## Cross-Reference

- **Recipe 19** — Attach MCP to an Agent (step-by-step walkthrough)
- **Recipe 20** — Author a Play with mcp_scope
- **Recipe 21** — Publish a Plugin with providesMcp
- **Recipe 22** — Trust Override Walkthrough
- **Recipe 23** — Troubleshoot MCP Attach Failures
