# FrootAI VS Code Extension

> **Know the roots. Ship the fruit — right from your editor.**

## Features

### Sidebar Panel
- **Solution Plays**: Browse all 20 plays, click to open README or folder
- **FROOT Modules**: Browse 17 knowledge modules by FROOT layer
- **MCP Tools**: See available MCP tools at a glance

### Commands (Ctrl+Shift+P)
| Command | What It Does |
|---------|-------------|
| `FrootAI: Browse Solution Plays` | Open solution plays on website |
| `FrootAI: Look Up AI Term` | Search 200+ glossary terms |
| `FrootAI: Search Knowledge Base` | Full-text search across all docs |
| `FrootAI: Open Setup Guide` | MCP setup guide |
| `FrootAI: Open Solution Play` | Open a specific play's README |
| `FrootAI: Initialize DevKit` | Copy DevKit files to your current project |
| `FrootAI: Show Architecture Pattern` | View decision guides |

### DevKit Initialization
Run `FrootAI: Initialize DevKit` → select a solution play → DevKit files (agent.md, instructions.md, .vscode/mcp.json, copilot-instructions.md) are copied to your current workspace. Your co-coder instantly becomes solution-aware.

### Status Bar
FrootAI icon in the status bar — click to browse solution plays.

## Install

### From Source (Development)
```bash
cd vscode-extension
npm install
# Press F5 in VS Code to run Extension Development Host
```

### From VSIX (Local Install)
```bash
cd vscode-extension
npx vsce package
code --install-extension frootai-0.1.0.vsix
```

## How It Works

The extension auto-detects if you're in the FrootAI repo or a solution play folder. It reads docs and solution play files directly from disk — no API calls, no cloud dependency.

---

**FrootAI** — Know the roots. Ship the fruit.
