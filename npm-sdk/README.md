# frootai

> **FrootAI™ CLI & SDK** — AI Primitive Unification Ecosystem

The official CLI for [FrootAI](https://frootai.dev) — 100 solution plays, 830+ AI primitives, and the FAI Protocol.

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
frootai help                              # Show all commands
frootai info 01                           # Play details, cost estimate, architecture
frootai list                              # Browse all 100 solution plays
frootai search "RAG architecture"         # Search knowledge base
frootai cost 01 --scale prod              # Detailed cost breakdown

# Build
frootai init                              # Interactive project scaffolding
frootai scaffold 01                       # Download play + generate templates
frootai scaffold 01 --kit devkit          # DevKit only
frootai install 01                        # Download play files to current dir

# Deploy
frootai deploy                            # Guided Azure deployment wizard
frootai deploy --dry-run                  # Preview without deploying
frootai deploy -y --resource-group myRG   # Non-interactive deploy

# Validate
frootai validate                          # Check project structure
frootai validate --waf                    # WAF alignment scorecard
frootai doctor                            # Health check for your setup
```

## MCP Server
## SDK (Programmatic API)

```javascript
import { getPlay, searchKnowledge, getAllPlays, lookupTerm } from 'frootai';

// Get a specific play
const play = getPlay('01');
console.log(play.title, play.services);

// Search knowledge base
const results = searchKnowledge('RAG architecture');
results.forEach(r => console.log(r.title, r.score));

// Browse all 100 plays
const plays = getAllPlays();

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
