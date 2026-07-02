# Recipe 19: Attach MCP Areas to an Agent

> Declare which MCP server areas your agent needs, validate the declaration against the marketplace roster, and run the agent with federated tools attached.

## What You'll Build

An agent definition (`.agent.md`) that declares `mcpAttachments`, specifying which external MCP server areas attach when the agent runs. The engine reads this, attaches the right servers, and exposes their tools at runtime.

## Why Declare MCP Attachments?

Without explicit declarations, the engine can't know which external tools your agent needs. `mcpAttachments` gives:

| Benefit | How It Helps |
|---------|-------------|
| **Deterministic context** | Attaches exactly the tools you need |
| **CI validation** | M10.5 catches typos and non-existent areas before deploy |
| **Trust enforcement** | M10.6 blocks untrusted community servers unless explicitly overridden |
| **Reproducibility** | Anyone running the same agent gets the same federated tool surface |

## Prerequisites

- FrootAI repo cloned (`frootai/` workspace)
- An existing agent file or willingness to create one
- Familiarity with YAML frontmatter in `.agent.md` files

## Schema Reference

`mcpAttachments` supports three shapes:

### Shape A: Bare Array (all optional)

```yaml
mcpAttachments: ["azure", "github"]
```

All listed areas are optional: the agent can run without them, but gets extra tools when available.

### Shape B: Object with Required/Optional

```yaml
mcpAttachments:
  required: ["azure"]
  optional: ["github", "playwright"]
  trustOverrides:
    my-community-server: "reviewed-internal"
```

- **required** — aborts at pre-flight if these areas can't be attached
- **optional** — runs with degraded capability if unavailable
- **trustOverrides** — explicit trust declarations for community-tier servers (bypasses M10.6 policy)

### Shape C: Areas Array (legacy)

```yaml
mcpAttachments:
  areas: ["azure", "github"]
```

Same as the bare array form (all optional).

## Steps

### 1. Choose Your Agent File

Every agent lives under `frootai/agents/` as a `.agent.md` file with YAML frontmatter:

```
frootai/agents/fai-azure-architect.agent.md
```

### 2. Add mcpAttachments to the Frontmatter

Open the agent file and add `mcpAttachments` to the YAML frontmatter block:

```yaml
---
description: "Azure architecture expert — landing zones, networking, identity, cost."
name: "FAI Azure Architect"
tools:
  - "codebase"
  - "terminal"
model: ["gpt-4o", "gpt-4o-mini"]
mcpAttachments:
  required: ["azure"]
  optional: ["github", "playwright"]
---
```

### 3. Validate Against the Marketplace Roster

Run the M10.5 validator to confirm all slugs resolve to known MCP servers:

```bash
node frootai-core/scripts/orchard/validate-mcp-area-slugs.js
```

Expected output on success:

```
  Checked 3 slug reference(s) across 238 agents, 101 plays, 336 skills.
  ✅ All MCP area slugs resolve to known entries in the seed roster.
```

If a slug is misspelled or points to an area not in the roster:

```
  ❌ 1 unknown MCP area slug(s) found:

    • agents/fai-azure-architect.agent.md  →  mcpAttachments.required: "azurr"

  Fix: add the missing slug(s) to frootai/data/mcp-servers-seed.json
       or correct the typo in the declaring file.
```

### 4. Validate Trust Policy

Run the M10.6 trust policy validator:

```bash
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

This ensures every referenced area is `first-party-ms` or `verified-publisher`, unless you've declared a `trustOverrides` entry.

### 5. Understand Runtime Behavior

When the engine runs your agent, `context-resolver.js` merges declarations from all sources:

```
Agent mcpAttachments.required    → engine MUST attach (aborts if unavailable)
Agent mcpAttachments.optional    → engine attaches if available (degrades gracefully)
Skill requiresMcp               → pre-flight check per skill
Play  mcp_scope.attached        → play-level requirements
```

The merged plan is passed to `mcp-bridge.js`, which calls `fai_attach_mcp` for each area and returns a unified tool registry.

### 6. Test the Agent Locally

Use the CLI to invoke your agent with MCP areas attached:

```bash
npx frootai mcp attach azure github
npx frootai agent run fai-azure-architect --prompt "Design a hub-spoke network"
```

The agent now has Azure and GitHub MCP tools in addition to its standard `codebase` and `terminal` tools.

### 7. Add a Trust Override (If Needed)

If your agent needs a community-tier server (e.g., a custom internal tool):

```yaml
mcpAttachments:
  required: ["azure"]
  optional: ["my-internal-server"]
  trustOverrides:
    my-internal-server: "reviewed-internal"
```

`trustOverrides` is a free-form reason string documenting why the community server is acceptable.

## Available MCP Areas

The canonical roster lives in `frootai/data/mcp-servers-seed.json`:

| Slug | Publisher | Trust Level |
|------|-----------|-------------|
| `azure` | microsoft | first-party-ms |
| `github` | github | first-party-ms |
| `playwright` | microsoft | first-party-ms |
| `markitdown` | microsoft | first-party-ms |
| `ms-learn` | microsoft | first-party-ms |
| `context7` | upstash | verified-publisher |
| `chrome-devtools` | google | verified-publisher |

To add a new area, edit the seed file and re-run the validators.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Misspelled slug (`azur` instead of `azure`) | Run the M10.5 validator; it reports the exact typo |
| Community server without `trustOverrides` | Add an explicit override or use a trusted alternative |
| Using `areas` when you need required/optional distinction | Switch to the object form with `required` and `optional` arrays |
| Declaring `mcpAttachments` on a skill file | Skills use `requiresMcp` instead (different field, same slug namespace) |

## Next Steps

- **Recipe 20** — Author a Play with `mcp_scope` (play-level MCP requirements)
- **Recipe 21** — Publish a plugin that provides its own MCP server (`providesMcp`)
- **Recipe 22** — Trust override walkthrough (detailed security review process)
