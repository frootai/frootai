# frootai

> **FrootAI™ CLI & SDK** — AI Primitive Unification Ecosystem

The official CLI & SDK for [FrootAI](https://frootai.dev) — 100 solution plays, 860+ AI primitives, and the FAI Protocol.

## Installation

```bash
# Run directly (no install needed)
npx frootai help

# Or install globally
npm i -g frootai
```

## CLI Commands

```bash
# Explore
frootai help                              # Show all 21 commands
frootai info 01                           # Play details, cost estimate, architecture
frootai list                              # Browse all 100 solution plays
frootai search "RAG architecture"         # BM25 ranked knowledge search
frootai cost 01 --scale prod              # Detailed cost breakdown
frootai primitives                        # Browse 860+ AI primitives catalog

# Build
frootai init                              # Interactive project scaffolding
frootai scaffold 01                       # Download play + generate templates
frootai scaffold 01 --kit devkit          # DevKit only
frootai install 01                        # Download play files to current dir

# Deploy
frootai deploy                            # Guided Azure deployment wizard
frootai deploy --dry-run                  # Preview without deploying
frootai deploy -y --resource-group myRG   # Non-interactive deploy

# Validate & Monitor
frootai validate                          # Check project structure
frootai validate --waf                    # WAF alignment scorecard (6 pillars)
frootai doctor                            # Health check for your setup
frootai status                            # Show current project context + installed kits
frootai diff                              # Compare local files vs GitHub (drift detection)
frootai login                             # Check Azure + GitHub auth status
frootai update                            # Check for latest versions
```

## SDK (Programmatic API)

```javascript
import { getPlay, searchKnowledge, getAllPlays, lookupTerm } from 'frootai';

// Get a specific play
const play = getPlay('01');
console.log(play.title);              // "Enterprise Rag"

// Search knowledge base (BM25 ranked)
const results = searchKnowledge('RAG architecture');
results.forEach(r => console.log(r.title, r.score));

// Browse all 100 plays
const plays = getAllPlays();           // 100 plays

// Look up AI terms
const def = lookupTerm('embeddings');
```

## MCP Server

For the MCP server (AI agent integration), use the companion package:

```bash
npx frootai-mcp                           # Starts MCP server on stdin/stdout
```

```json
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["-y", "frootai-mcp"]
    }
  }
}
```

## Links

- **Website**: [frootai.dev](https://frootai.dev)
- **GitHub**: [github.com/frootai/frootai](https://github.com/frootai/frootai)
- **MCP Server**: [frootai-mcp on npm](https://www.npmjs.com/package/frootai-mcp)
- **Solution Plays**: [frootai.dev/solution-plays](https://frootai.dev/solution-plays)
