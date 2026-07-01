# Recipe 23: Troubleshoot MCP Attach Failures

> Diagnose and fix common failures when the FrootAI engine attempts to attach MCP server areas at runtime — from slug resolution errors to transport timeouts.

## When This Recipe Applies

Use this guide when you see any of these symptoms:

- Agent aborts at pre-flight with "required MCP area not available"
- `fai_attach_mcp` returns an error during play activation
- Tools from an expected MCP server don't appear in the agent's context
- CI validators pass but runtime attach still fails
- Timeout or connection-refused errors in the engine logs

## Diagnostic Flowchart

```
Agent/Play fails to attach MCP area
│
├─ Is the slug in mcp-servers-seed.json?
│  ├─ NO → Fix: add the server to the seed roster
│  └─ YES ↓
│
├─ Does M10.5 validator pass?
│  ├─ NO → Fix: correct the typo in your declaration
│  └─ YES ↓
│
├─ Does M10.6 trust policy pass?
│  ├─ NO → Fix: add trust_overrides or use a trusted server
│  └─ YES ↓
│
├─ Is the server installed/reachable?
│  ├─ NO → Fix: install the package or start the HTTP service
│  └─ YES ↓
│
├─ Does the transport handshake succeed?
│  ├─ NO → Fix: check command path, args, or URL reachability
│  └─ YES ↓
│
└─ Check: server responds to `initialize` JSON-RPC call
   ├─ NO → Fix: server bug — see "Server Not Responding" below
   └─ YES → Area attached successfully; check tool registration
```

## Error Categories

### 1. Slug Resolution Failure

**Symptom**: M10.5 validator fails or engine logs `unknown area slug: "xxx"`

**Cause**: The slug in your declaration doesn't match any `id` in `mcp-servers-seed.json`.

**Fix**:

```bash
# Check what slugs are available
node -e "const d=require('./frootai/data/mcp-servers-seed.json'); console.log(d.mcpServers.map(s=>s.id).join(', '))"
```

Common typos:

| Wrong | Correct |
|-------|---------|
| `azurre` | `azure` |
| `github-mcp` | `github` |
| `play-wright` | `playwright` |
| `mark-it-down` | `markitdown` |
| `mslearn` | `ms-learn` |

### 2. Trust Policy Rejection

**Symptom**: M10.6 validator fails or engine logs `untrusted area blocked: "xxx" (trust: community)`

**Cause**: You're attaching a community-tier server without a `trust_overrides` entry.

**Fix**: Either switch to a trusted alternative or add an override (see Recipe 22):

```yaml
mcpAttachments:
  required: ["my-community-server"]
  trustOverrides:
    my-community-server: "SEC-1234 reviewed 2026-06-20"
```

### 3. Server Not Installed (stdio)

**Symptom**: Engine logs `ENOENT: spawn npx failed` or `command not found`

**Cause**: The stdio command declared in `providesMcp` or the CLI attach flow can't find the executable.

**Diagnosis**:

```bash
# Verify the command exists
which npx  # or: Get-Command npx (PowerShell)

# Verify the package is installed
npx -y @azure/mcp --version

# Check PATH includes the expected binary location
echo $PATH
```

**Fix**:

- Install the package: `npm install -g @azure/mcp`
- Or use `npx -y` to auto-install on first run
- Ensure PATH includes `node_modules/.bin/` if using local installs

### 4. Server Not Reachable (HTTP)

**Symptom**: Engine logs `ECONNREFUSED` or `fetch failed` for the server URL

**Cause**: The HTTP-SSE or HTTP-streaming server isn't running or the URL is wrong.

**Diagnosis**:

```bash
# Test connectivity
curl -I https://mcp.example.com/sse

# Check if the server process is running
ps aux | grep mcp-server

# Verify the URL in your declaration
cat frootai/plugins/my-plugin/plugin.json | jq '.providesMcp.url'
```

**Fix**:

- Start the server process
- Verify the URL matches the server's actual listen address
- Check firewall rules / network policies
- For local dev, use `http://localhost:<port>/sse`

### 5. Transport Handshake Timeout

**Symptom**: Engine logs `MCP attach timeout after 30s` or `stdio server did not respond`

**Cause**: The server starts but doesn't complete the MCP `initialize` handshake within the timeout.

**Diagnosis**:

```bash
# Test manually with MCP Inspector
npx @modelcontextprotocol/inspector stdio -- node dist/server.js

# Check if server prints to stderr (blocking stdout)
node dist/server.js 2>stderr.log
cat stderr.log
```

**Common causes**:

| Cause | Fix |
|-------|-----|
| Server prints a banner to stdout before JSON-RPC | Remove stdout prints; use stderr for logging |
| Server waits for stdin input before initializing | Ensure server sends `initialize` response on first JSON-RPC request |
| Server has a slow startup (loading large models) | Increase timeout via `router_config` or optimize cold start |
| Server crashes silently on startup | Check stderr output; add error handling to entry point |

### 6. Tool Registration Missing

**Symptom**: Area attaches successfully but expected tools don't appear in agent context

**Cause**: The server's `tools/list` response doesn't include the expected tools.

**Diagnosis**:

```bash
# List tools from the server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

**Fix**:

- Verify tools are registered in your server's tool manifest
- Check for conditional tool registration (e.g., feature flags)
- Ensure tool names match what the agent expects (`<area>.<tool>`)

### 7. Pre-Flight Abort (Required Area Unavailable)

**Symptom**: Agent refuses to start with `required MCP area "xxx" not available`

**Cause**: A skill declares `requiresMcp: ["xxx"]` but the area failed to attach (for any reason above).

**Diagnosis**:

```bash
# Check which skills require this area
grep -r "requiresMcp" frootai/skills/ | grep "xxx"

# Try attaching manually
npx frootai mcp attach xxx
```

**Fix**: Resolve the underlying attach failure (categories 1-6 above), or temporarily move the area from `required` to `optional` while debugging.

### 8. Version Mismatch

**Symptom**: Server attaches but tools behave unexpectedly or return schema errors

**Cause**: The installed server version doesn't match what your agent/play was tested against.

**Diagnosis**:

```bash
# Check installed version
npx @azure/mcp --version

# Check what version your pin expects
cat package.json | jq '.dependencies["@azure/mcp"]'
```

**Fix**:

- Pin the server version in your project's `package.json`
- Update your tool schemas if you intentionally upgraded
- Add version constraints to your `trust_overrides` documentation

## Engine Debug Mode

Enable verbose MCP attach logging:

```bash
FAI_MCP_DEBUG=1 npx frootai agent run my-agent --prompt "test"
```

This outputs:

```
[mcp-bridge] Attaching area: azure (transport: stdio)
[mcp-bridge] Spawning: npx -y @azure/mcp server start
[mcp-bridge] Initialize handshake: OK (142ms)
[mcp-bridge] Tools registered: 47
[mcp-bridge] Attaching area: github (transport: stdio)
[mcp-bridge] Spawning: npx -y @github/mcp-server
[mcp-bridge] Initialize handshake: OK (89ms)
[mcp-bridge] Tools registered: 31
[mcp-bridge] Attach plan complete: 2/2 areas, 78 tools total
```

## Quick Reference: Validator Commands

```bash
# M10.5 — slug exists in roster
node frootai-core/scripts/orchard/validate-mcp-area-slugs.js

# M10.6 — trust policy (community needs override)
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js

# M10.7 — providesMcp has complete transport spec
node frootai-core/scripts/orchard/validate-mcp-provides-transport.js
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running validators but not testing actual attach | Validators check declarations; test runtime with `frootai mcp attach` |
| Assuming CI pass = runtime works | CI validates slugs/trust; runtime needs the actual server binary |
| Debugging in production instead of locally | Use MCP Inspector locally first: `npx @modelcontextprotocol/inspector` |
| Ignoring stderr output from stdio servers | Stderr often contains the real error; redirect and inspect it |
| Blaming the engine when the server is broken | Test server standalone first with a raw JSON-RPC message |

## Next Steps

- **Recipe 19** — Attach MCP to an Agent (initial setup)
- **Recipe 5** — Build an MCP Server (if your custom server has bugs)
- **Recipe 22** — Trust Override Walkthrough (if blocked by trust policy)
