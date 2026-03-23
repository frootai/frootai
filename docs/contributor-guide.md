---
sidebar_position: 32
title: Contributor Guide
---

# FrootAI Contributor Guide

> Everything you need to contribute to FrootAI — from dev setup to PR review.

---

## 1. Development Environment Setup

### 1.1 Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)
- **VS Code** — [code.visualstudio.com](https://code.visualstudio.com/)
- **Python 3.10+** (for evaluation scripts) — [python.org](https://python.org/)

### 1.2 Clone & Install

```bash
# Clone the repository
git clone https://github.com/gitpavleenbali/frootai.git
cd frootai

# Website
cd website && npm install && cd ..

# MCP Server
cd mcp-server && npm install && cd ..

# VS Code Extension
cd vscode-extension && npm install && cd ..
```

### 1.3 Build Everything

```bash
# Website (Docusaurus)
cd website && npx docusaurus build

# MCP Server (no build step — plain Node.js)

# VS Code Extension
cd vscode-extension && npm run compile
```

---

## 2. Repository Structure

```
frootai/
├── docs/                    # 18+ knowledge modules (Markdown)
├── website/                 # Docusaurus site
│   ├── src/pages/           # React pages (landing, setup, plays...)
│   ├── docusaurus.config.ts # Site config (baseUrl: /frootai/)
│   └── sidebars.ts          # Docs sidebar structure
├── mcp-server/              # MCP Server (Node.js, stdio)
│   ├── src/
│   │   ├── index.js         # Entry point
│   │   └── tools/           # Tool implementations
│   └── package.json
├── vscode-extension/        # VS Code Extension
│   ├── src/
│   │   ├── extension.ts     # Activation entry point
│   │   ├── commands/        # Command implementations
│   │   └── panels/          # Sidebar webview panels
│   └── package.json         # Extension manifest
├── solution-plays/          # 20 solution play directories
│   ├── 01-it-ticket-resolution/
│   ├── 02-customer-support-agent/
│   └── ...
├── config/                  # Shared configuration
│   ├── openai.json
│   ├── guardrails.json
│   └── routing.json
├── CONTRIBUTING.md           # Quick contribution guide
├── LICENSE                   # MIT
└── README.md                 # Project overview
```

### Key Files

| File | Role |
|---|---|
| `docs/*.md` | Knowledge modules — the core content |
| `website/docusaurus.config.ts` | Site configuration, plugins, theme |
| `website/sidebars.ts` | Sidebar navigation tree |
| `mcp-server/src/index.js` | MCP Server entry — tool registration |
| `vscode-extension/package.json` | Extension manifest — commands, views, activation |
| `config/guardrails.json` | Safety and content filtering rules |

---

## 3. Adding a New Solution Play

### 3.1 Step-by-Step

1. **Choose a number and slug**: `21-my-new-play`

2. **Create the directory structure**:
   ```bash
   mkdir -p solution-plays/21-my-new-play/.github/prompts
   mkdir -p solution-plays/21-my-new-play/config
   mkdir -p solution-plays/21-my-new-play/evaluation
   ```

3. **Write the README.md** — Overview, architecture, value proposition, deployment steps.

4. **Write the agent.md** (1500–5000 bytes):
   ```markdown
   # Agent Rules: My New Play

   ## Context
   You are an AI agent specializing in [scenario].

   ## Rules
   1. Use Managed Identity (no API keys)
   2. Read config files from config/ for parameters
   3. Follow these behavior rules: [specifics]
   4. Include error handling + logging
   ```

5. **Write copilot-instructions.md** — Project context for GitHub Copilot.

6. **Add config files**:
   - `config/agents.json` — Model and routing parameters
   - Add other config files as needed

7. **Create evaluation set**:
   - `evaluation/golden-set.jsonl` — At least 5 input/output pairs
   - `evaluation/evaluate.py` — Scoring script

8. **Add prompts**:
   - `prompts/init.prompt.md` — Bootstrap prompt
   - Additional prompts as needed

### 3.2 Validation Checklist

Before submitting a PR, verify:

- [ ] `README.md` exists and is >500 bytes
- [ ] `agent.md` exists and is 1500–5000 bytes
- [ ] `copilot-instructions.md` exists
- [ ] At least one config file in `config/`
- [ ] `evaluation/golden-set.jsonl` has 5+ examples
- [ ] `evaluation/evaluate.py` runs without errors
- [ ] No API keys or secrets in any file
- [ ] All file names use kebab-case

### 3.3 CI Validation

The `validate-plays.yml` workflow automatically checks:
- Required file existence
- `agent.md` byte-size range
- JSON validity of config files
- JSONL validity of golden sets

---

## 4. Improving Existing Content

### 4.1 Knowledge Modules (`docs/`)

- Each module is a standalone Markdown file
- Front matter must include `sidebar_position` and `title`
- Use Mermaid diagrams for architecture visuals
- Include practical examples, not just theory
- Target 800–3000 lines per module

### 4.2 Agent Rules (`agent.md`)

When improving a play's agent.md:
- Keep it within 1500–5000 bytes
- Include: context, rules, tool references, error handling
- Be specific about what the agent should/shouldn't do
- Reference config files by path

### 4.3 Config Files

- All JSON must be valid and formatted
- Include comments (via `_comment` fields) for documentation
- Default values should be production-safe
- Guardrails should be strict by default

---

## 5. MCP Server Development

### 5.1 Adding a New Tool

1. Create `mcp-server/src/tools/my-new-tool.js`:

   ```javascript
   module.exports = {
     name: "my_new_tool",
     description: "What this tool does",
     inputSchema: {
       type: "object",
       properties: {
         query: { type: "string", description: "The search query" }
       },
       required: ["query"]
     },
     handler: async ({ query }) => {
       // Implementation
       return { content: [{ type: "text", text: "Result" }] };
     }
   };
   ```

2. Register in `mcp-server/src/index.js`:
   ```javascript
   const myNewTool = require("./tools/my-new-tool");
   server.addTool(myNewTool);
   ```

3. Test locally:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"my_new_tool","arguments":{"query":"test"}}}' | node src/index.js
   ```

### 5.2 Tool Categories

| Category | Convention | Network? |
|---|---|---|
| Static | Returns bundled data | No |
| Live | Fetches external data | Yes |
| Chain | Multi-step orchestration | Depends |
| AI Ecosystem | Model/pattern guidance | No |

### 5.3 Testing

```bash
cd mcp-server
npm test                    # Unit tests
npm run test:integration    # Integration tests (requires network for live tools)
```

---

## 6. VS Code Extension Development

### 6.1 Running in Dev Mode

1. Open `vscode-extension/` in VS Code
2. Press `F5` → launches Extension Development Host
3. Changes hot-reload on recompile

### 6.2 Adding a Command

1. Register in `package.json` under `contributes.commands`:
   ```json
   {
     "command": "frootai.myCommand",
     "title": "FROOT: My Command",
     "category": "FROOT"
   }
   ```

2. Implement in `src/commands/my-command.ts`:
   ```typescript
   import * as vscode from "vscode";

   export function registerMyCommand(context: vscode.ExtensionContext) {
     context.subscriptions.push(
       vscode.commands.registerCommand("frootai.myCommand", async () => {
         // Implementation
         vscode.window.showInformationMessage("Done!");
       })
     );
   }
   ```

3. Wire up in `src/extension.ts`:
   ```typescript
   import { registerMyCommand } from "./commands/my-command";
   registerMyCommand(context);
   ```

### 6.3 Sidebar Panels

Panels are implemented as webview providers in `src/panels/`. Each panel:
- Returns HTML content for the webview
- Uses message passing for interaction
- Follows the existing dark theme / green accent pattern

---

## 7. Website Development

### 7.1 Adding a Page

Create `website/src/pages/my-page.tsx`:

```tsx
import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function MyPage(): JSX.Element {
  return (
    <Layout title="My Page" description="Description for SEO">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1>My Page</h1>
        {/* Content */}
      </div>
    </Layout>
  );
}
```

The page will be available at `/frootai/my-page`.

### 7.2 Docusaurus Conventions

- **Pages** → `website/src/pages/*.tsx` (React) or `.md` (Markdown)
- **Docs** → `docs/*.md` (Markdown with front matter)
- **Styles** → Use existing `index.module.css` classes (`glowCard`, `glowPill`, `ctaPrimary`)
- **Sidebar** → Edit `website/sidebars.ts` to add docs to navigation
- **Config** → `website/docusaurus.config.ts` for site-wide settings

### 7.3 Local Development

```bash
cd website
npx docusaurus start     # Dev server with hot reload
npx docusaurus build     # Production build
npx docusaurus serve     # Serve production build locally
```

---

## 8. Testing & CI

### 8.1 `validate-plays.yml`

Runs on every push that touches `solution-plays/`:
- Checks required files exist
- Validates `agent.md` size (1500–5000 bytes)
- Validates JSON/JSONL files
- Reports failures as PR checks

### 8.2 Manual Testing

Before submitting a PR:

```bash
# Website builds
cd website && npx docusaurus build

# MCP server starts
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/src/index.js

# Extension compiles
cd vscode-extension && npm run compile

# Play validation passes
python scripts/validate-plays.py
```

---

## 9. PR Review Process

### 9.1 What Reviewers Look For

- **Completeness** — All required files present
- **Quality** — agent.md is specific, not generic
- **Security** — No API keys, secrets, or PII
- **Consistency** — Naming follows conventions
- **Testing** — Evaluation set covers edge cases
- **Documentation** — README explains what and why

### 9.2 PR Template

Every PR fills out the template with:
- Summary of changes
- Type (feature / fix / docs / play)
- Checklist of validation steps completed

### 9.3 Review Timeline

- Small fixes: 1–2 days
- New plays: 3–5 days
- Architecture changes: require discussion first

---

## 10. Code Style

### 10.1 Naming

| Item | Convention | Example |
|---|---|---|
| Directories | kebab-case | `solution-plays/01-it-ticket-resolution` |
| Markdown files | PascalCase or kebab-case | `RAG-Architecture.md`, `admin-guide.md` |
| JSON files | kebab-case | `model-comparison.json` |
| TypeScript | camelCase (vars/functions), PascalCase (types) | `fetchModule()`, `ToolConfig` |
| CSS classes | camelCase (CSS modules) | `glowCard`, `heroTitle` |

### 10.2 Comments

- Use JSDoc for TypeScript functions
- Use `#` comments in shell scripts
- Use `//` comments in JSON (via `_comment` fields)
- Markdown files don't need code comments — the content IS the documentation

### 10.3 Encoding

- All files: **UTF-8**
- Line endings: **LF** (not CRLF)
- Indentation: **2 spaces** (TypeScript, JSON, YAML), **4 spaces** (Python)
- Max line length: **120 characters** (soft limit)

---

> **Next**: [Admin Guide](./admin-guide) · [User Guide](./user-guide-complete) · [API Reference](./api-reference)
