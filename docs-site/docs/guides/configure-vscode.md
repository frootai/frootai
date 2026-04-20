---
sidebar_position: 12
title: Configure VS Code
description: Set up VS Code with file associations, schema validation, tasks, and MCP integration for the best FrootAI development experience.
---

# Configure VS Code for FrootAI

Set up VS Code with file associations, JSON schema validation, one-click tasks, and MCP server integration.

## Step 1: File Associations

Add to `.vscode/settings.json` so VS Code recognizes FrootAI file types:

```json title=".vscode/settings.json"
{
  "files.associations": {
    "*.agent.md": "markdown",
    "*.instructions.md": "markdown",
    "*.prompt.md": "markdown",
    "fai-manifest.json": "json",
    "fai-context.json": "json",
    "plugin.json": "json",
    "hooks.json": "json",
    "froot.json": "json"
  }
}
```

## Step 2: JSON Schema Validation

Auto-validate FrootAI JSON files with inline error highlighting:

```json title=".vscode/settings.json"
{
  "json.schemas": [
    {
      "fileMatch": ["agents/*/fai-context.json"],
      "url": "./schemas/fai-context.schema.json"
    },
    {
      "fileMatch": ["solution-plays/*/fai-manifest.json"],
      "url": "./schemas/fai-manifest.schema.json"
    },
    {
      "fileMatch": ["plugins/*/plugin.json"],
      "url": "./schemas/plugin.schema.json"
    },
    {
      "fileMatch": ["hooks/*/hooks.json"],
      "url": "./schemas/hook.schema.json"
    }
  ]
}
```

:::tip Red Squiggles
With schema validation configured, VS Code shows red squiggles for missing required fields before you even run validation scripts.
:::

## Step 3: VS Code Tasks

Add to `.vscode/tasks.json` for one-click validation:

```json title=".vscode/tasks.json"
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate All Primitives",
      "type": "shell",
      "command": "node scripts/validate-primitives.js",
      "group": { "kind": "test", "isDefault": true }
    },
    {
      "label": "Generate Marketplace",
      "type": "shell",
      "command": "node scripts/generate-marketplace.js",
      "group": "build"
    },
    {
      "label": "Scaffold Agent",
      "type": "shell",
      "command": "node scripts/scaffold-primitive.js agent"
    },
    {
      "label": "Scaffold Skill",
      "type": "shell",
      "command": "node scripts/scaffold-primitive.js skill"
    },
    {
      "label": "Run FAI Engine (Play 01)",
      "type": "shell",
      "command": "node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status"
    },
    {
      "label": "Validate Consistency",
      "type": "shell",
      "command": "node scripts/validate-consistency.js"
    }
  ]
}
```

Run tasks via: `Ctrl+Shift+P` → "Tasks: Run Task"

## Step 4: MCP Server Configuration

Give Copilot Chat access to FrootAI MCP tools:

```json title=".vscode/mcp.json"
{
  "servers": {
    "frootai": {
      "command": "node",
      "args": ["mcp-server/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

This enables 25 MCP tools in Copilot Chat:
- `search_knowledge` — search FROOT modules
- `get_module` — retrieve specific knowledge module
- `get_play_detail` — detailed play information
- `compare_models` — AI model comparison
- `estimate_cost` — Azure cost estimation

## Step 5: Recommended Extensions

| Extension | Purpose |
|-----------|---------|
| **GitHub Copilot** | AI pair programmer |
| **GitHub Copilot Chat** | Agent-based interactions |
| **Bicep** | Azure IaC syntax + validation |
| **YAML** | YAML schema validation |
| **Markdown All in One** | Markdown editing |
| **Python** | Python development |

## Step 6: Verify Setup

```bash
# Run the default test task
node scripts/validate-primitives.js
```

Expected output:
```
✅ Passed: 2510
ALL CHECKS PASSED ✅
```

## File Type Recognition

After setup, VS Code automatically recognizes:

| File Pattern | Benefit |
|-------------|---------|
| `*.agent.md` | Copilot understands agent persona |
| `*.instructions.md` | Copilot applies coding standards |
| `fai-manifest.json` | Red squiggles on invalid fields |
| `plugin.json` | Auto-complete for plugin fields |
| `hooks.json` | Event type validation |

## Best Practices

1. **Commit `.vscode/` config** — share the setup with your team
2. **Use tasks, not raw commands** — discoverable and consistent
3. **Enable schema validation** — catch errors before running scripts
4. **Configure MCP** — let Copilot access your knowledge base
5. **Keep `copilot-instructions.md` updated** — it's the project DNA

## See Also

- [MCP Server](/distribution/mcp-server) — FrootAI MCP server
- [Installation](/getting-started/installation) — full setup guide
