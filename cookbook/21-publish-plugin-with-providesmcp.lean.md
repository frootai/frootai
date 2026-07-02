# Recipe 21: Publish a Plugin with providesMcp

> Bundle an MCP server inside a FrootAI plugin, declare its transport spec, validate it passes CI, and ship it through the marketplace so other plays can auto-attach.

## What You'll Build

A FrootAI plugin that ships its own MCP server via `providesMcp` in `plugin.json`; once published, other agents and plays can reference its slug in `mcpAttachments` or `mcp_scope.attached`, and the engine auto-discovers and attaches it.

## Why providesMcp?

Most plugins consume external MCP tools. A `providesMcp` plugin instead creates a new tool surface for others to attach to:

| Plugin Type | Field | Example |
|-------------|-------|---------|
| Consumer | `mcpAttachments` / `requiresMcp` | "I need the Azure MCP tools" |
| Provider | `providesMcp` | "I ship a new MCP server others can use" |

Provider plugins get a **federation-ready** badge in the marketplace and are auto-registered in the federated areas catalog on install.

## Prerequisites

- A working MCP server (see Recipe 5: Build an MCP Server)
- FrootAI repo cloned
- Familiarity with `plugin.json` structure (see Recipe 6: Package Plugin)
- The server must speak one of: `stdio`, `http-sse`, or `http-streaming`

## Schema Reference

The `providesMcp` field in `plugin.json` conforms to `frootai/schemas/provides-mcp-v1.schema.json`:

```json
{
  "providesMcp": {
    "name": "my-tool",
    "transport": "stdio",
    "trust": "community",
    "publisher": "my-org",
    "command": "npx",
    "args": ["-y", "@my-org/mcp-server"]
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Kebab-case area slug (2-64 chars). Becomes the prefix in `<area>.<tool>` |
| `transport` | `enum` | `"stdio"` \| `"http-sse"` \| `"http-streaming"` |
| `trust` | `enum` | `"first-party-ms"` \| `"verified-publisher"` \| `"community"` \| `"untrusted"` |

### Transport-Specific Fields

| Transport | Required Field | Example |
|-----------|---------------|---------|
| `stdio` | `command` | `"npx"`, `"node"`, `"python"` |
| `http-sse` | `url` | `"https://mcp.example.com/sse"` |
| `http-streaming` | `url` | `"https://mcp.example.com/stream"` |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `publisher` | `string` | GitHub-org-style slug (defaults to plugin author) |
| `args` | `string[]` | Arguments passed to the command (stdio only) |

## Steps

### 1. Create Your Plugin Directory

```bash
mkdir -p frootai/plugins/my-custom-mcp
cd frootai/plugins/my-custom-mcp
```

### 2. Write the plugin.json Manifest

```json
{
  "name": "my-custom-mcp",
  "version": "1.0.0",
  "description": "Custom MCP server for internal knowledge-base queries.",
  "author": "My Org",
  "license": "MIT",
  "keywords": ["mcp", "knowledge-base", "search"],
  "providesMcp": {
    "name": "my-kb",
    "transport": "stdio",
    "trust": "community",
    "publisher": "my-org",
    "command": "node",
    "args": ["dist/server.js"]
  },
  "items": {
    "agents": 0,
    "instructions": 1,
    "hooks": 0
  }
}
```

### 3. Include the Server Code

Your plugin directory should contain the server implementation:

```
frootai/plugins/my-custom-mcp/
├── plugin.json
├── dist/
│   └── server.js          ← compiled MCP server entry point
├── src/
│   └── server.ts          ← source (if TypeScript)
├── instructions/
│   └── usage.instructions.md
└── README.md
```

`command` + `args` in `providesMcp` must resolve to a working server when installed.

### 4. Validate the Transport Spec

Run the M10.7 validator to confirm your `providesMcp` declaration is complete:

```bash
node frootai-core/scripts/orchard/validate-mcp-provides-transport.js
```

Expected output on success:

```
  Scanned 89 manifest(s): 86 plugins, 3 play scope files.
  Found 1 providesMcp declaration(s).
  ✅ All providesMcp declarations include a valid, discoverable transport spec.
```

Common failures:

```
  ❌ 1 providesMcp declaration(s) with incomplete transport spec:

    • plugins/my-custom-mcp/plugin.json
      → transport "stdio" requires a "command" field (the executable to spawn)
```

### 5. Register in the MCP Servers Seed (for Marketplace Inclusion)

If you want ecosystem discovery, add the server to the canonical roster:

```bash
# Edit frootai/data/mcp-servers-seed.json
```

Add an entry:

```json
{
  "id": "my-kb",
  "name": "My Knowledge Base MCP",
  "publisher": "my-org",
  "trust": "community",
  "description": "Internal knowledge-base search and retrieval."
}
```

Then other agents can reference `"my-kb"` in `mcpAttachments`, and the M10.5 validator will accept it.

### 6. Publish via the CLI (Dry-Run)

```bash
npx frootai mcp publish plugins/my-custom-mcp/plugin.json --dry-run
```

The publish command validates the `providesMcp` schema, builds a dry-run payload, and shows what would be sent to the marketplace API:

```
DRY RUN — would POST to marketplace:
{
  "apiVersion": 1,
  "plugin": { "name": "my-custom-mcp", ... },
  "providesMcp": { "name": "my-kb", "transport": "stdio", ... }
}
```

### 7. For HTTP Transport: Declare the Endpoint URL

If your server is a remote HTTP service instead of a local subprocess:

```json
{
  "providesMcp": {
    "name": "my-api",
    "transport": "http-sse",
    "trust": "verified-publisher",
    "publisher": "my-org",
    "url": "https://mcp.my-org.com/sse"
  }
}
```

The URL must be reachable at runtime. For local development, use environment variable substitution in your server's startup config.

## Trust Considerations

| Trust Level | Who Can Claim It | What Happens at Attach Time |
|-------------|-----------------|----------------------------|
| `first-party-ms` | Microsoft-published servers only | Auto-trusted, no override needed |
| `verified-publisher` | Marketplace-verified orgs | Auto-trusted, no override needed |
| `community` | Anyone | Blocked unless consumer declares `trust_overrides` |
| `untrusted` | Flagged servers | Always blocked — cannot be attached |

`trust` is self-declared; the engine re-evaluates it against the shipped trust manifest. Claiming `first-party-ms` for a non-Microsoft server won't grant trust; it will be downgraded at verification time.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `command` for stdio transport | Add the executable name (`"node"`, `"npx"`, `"python"`) |
| Missing `url` for http-sse/http-streaming | Add the full endpoint URI |
| Using uppercase in `name` slug | Must be lowercase kebab-case (`my-tool`, not `MyTool`) |
| Forgetting to add to `mcp-servers-seed.json` | Other plays can't reference your slug until it's in the roster |
| Setting `trust: "first-party-ms"` for a community server | Will be downgraded; use `"community"` honestly |

## Next Steps

- **Recipe 22** — Trust override walkthrough (how consumers approve your community server)
- **Recipe 23** — Troubleshoot MCP attach failures (debug why your server won't connect)
- **Recipe 5** — Build an MCP Server (if you haven't written the server yet)
