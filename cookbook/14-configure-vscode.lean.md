# Recipe 14: Configure VS Code for FrootAI

> Set up VS Code with file associations, schema validation, tasks, and MCP integration for the best FrootAI development experience.

## What This Recipe Covers

| Feature | What It Does |
|---------|-------------|
| **File associations** | VS Code recognizes `.agent.md`, `.instructions.md` as special types |
| **Schema validation** | JSON files auto-validate against FrootAI schemas |
| **Tasks** | One-click validation, marketplace generation, scaffolding |
| **MCP server** | FrootAI MCP tools available in Copilot Chat |

## Steps

### 1. File associations

Add to `.vscode/settings.json`:

```json
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

This lets Copilot infer file type and context.

### 2. JSON schema validation

Add schema mappings so VS Code auto-validates your JSON files:

```json
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
    },
    {
      "fileMatch": ["**/SKILL.md"],
      "url": "./schemas/skill.schema.json"
    },
    {
      "fileMatch": ["agents/*.agent.md"],
      "url": "./schemas/agent.schema.json"
    },
    {
      "fileMatch": ["instructions/*.instructions.md"],
      "url": "./schemas/instruction.schema.json"
    }
  ]
}
```

Opening `plugin.json` then shows red squiggles for missing required fields.

### 3. VS Code tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate All Primitives",
      "type": "shell",
      "command": "node scripts/validate-primitives.js",
      "group": { "kind": "test", "isDefault": true },
      "problemMatcher": []
    },
    {
      "label": "Validate Primitives (Verbose)",
      "type": "shell",
      "command": "node scripts/validate-primitives.js --verbose",
      "problemMatcher": []
    },
    {
      "label": "Generate Marketplace",
      "type": "shell",
      "command": "node scripts/generate-marketplace.js",
      "group": "build",
      "problemMatcher": []
    },
    {
      "label": "Scaffold Agent",
      "type": "shell",
      "command": "node scripts/scaffold-primitive.js agent",
      "problemMatcher": []
    },
    {
      "label": "Scaffold Skill",
      "type": "shell",
      "command": "node scripts/scaffold-primitive.js skill",
      "problemMatcher": []
    },
    {
      "label": "Scaffold Instruction",
      "type": "shell",
      "command": "node scripts/scaffold-primitive.js instruction",
      "problemMatcher": []
    },
    {
      "label": "Run FAI Engine (Play 01)",
      "type": "shell",
      "command": "node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status",
      "problemMatcher": []
    },
    {
      "label": "Validate Consistency",
      "type": "shell",
      "command": "node scripts/validate-consistency.js",
      "problemMatcher": []
    }
  ]
}
```

Run tasks via: `Ctrl+Shift+P` → "Tasks: Run Task"

### 4. MCP server configuration

Add to `.vscode/mcp.json`:

```json
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

This gives Copilot Chat access to 22 FrootAI MCP tools:
- `search_knowledge` — search FROOT modules
- `get_module` — retrieve specific knowledge module
- `list_plays` — browse solution plays
- `get_play` — detailed play information
- `estimate_cost` — Azure cost estimation
- `run_play` — execute FAI Engine for a play
- And 16 more...

### 5. Recommended extensions

| Extension | Purpose |
|-----------|---------|
| **GitHub Copilot** | AI pair programmer |
| **GitHub Copilot Chat** | Agent-based interactions |
| **Bicep** | Azure IaC syntax + validation |
| **YAML** | YAML schema validation |
| **Markdown All in One** | Markdown editing features |
| **Python** | Python development |

### 6. Workspace-specific Copilot instructions

Verify `.github/copilot-instructions.md` exists — this project-wide instruction applies to every Copilot interaction in this workspace.

```bash
# Verify copilot instructions are present
test -f .github/copilot-instructions.md && echo "✅ Copilot instructions found" || echo "❌ Missing copilot instructions"
```

### 7. Verify the setup

```bash
# Run the default test task
# (Ctrl+Shift+P → "Tasks: Run Test Task")

# Or from terminal:
node scripts/validate-primitives.js
```

Expected output:
```
✅ Passed: 2510

ALL CHECKS PASSED ✅
```

## File Type Recognition

After setup, VS Code will automatically:

| File Pattern | Recognition | Benefit |
|-------------|-------------|---------|
| `*.agent.md` | Markdown + agent context | Copilot understands agent persona |
| `*.instructions.md` | Markdown + instruction context | Copilot applies coding standards |
| `fai-manifest.json` | JSON + schema validation | Red squiggles on invalid fields |
| `plugin.json` | JSON + schema validation | Auto-complete for plugin fields |
| `hooks.json` | JSON + schema validation | Event type validation |
| `SKILL.md` | Markdown + skill context | Copilot understands skill steps |

## Best Practices

1. **Commit `.vscode/` config** — share the setup with your team
2. **Use tasks, not raw commands** — discoverable and consistent
3. **Enable schema validation** — catch errors before running validation scripts
4. **Configure MCP** — let Copilot access your knowledge base
5. **Keep copilot-instructions.md updated** — it's the project DNA
