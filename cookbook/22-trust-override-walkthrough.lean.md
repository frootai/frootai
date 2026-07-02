# Recipe 22: Trust Override Walkthrough

> Approve a community-tier MCP server for use in your agent or play by declaring a trust override, documenting the security review, and passing CI validation.

## What You'll Build

A documented `trust_overrides` entry that lets your agent or play attach a community-tier MCP server without failing the M10.6 trust policy validator, with an audit-ready review record.

## Why Trust Overrides Exist

The FrootAI federation trust model has three auto-approved tiers:

| Trust Level | Auto-Approved | Example |
|-------------|--------------|---------|
| `first-party-ms` | ✅ | Azure MCP, GitHub MCP, Playwright MCP |
| `verified-publisher` | ✅ | Context7 (Upstash), Chrome DevTools (Google) |
| `community` | ❌ | Any unverified third-party server |
| `untrusted` | ❌ (always blocked) | Flagged or revoked servers |

Community servers are blocked by default because they haven't passed marketplace verification. A `trust_overrides` entry is an explicit, auditable declaration that says: "We reviewed this server and accept the risk for this specific use case."

## When You Need a Trust Override

You need one when **all** of these are true:

1. Your agent/play references a slug whose `trust` field in `mcp-servers-seed.json` is `"community"`
2. You cannot switch to a `first-party-ms` or `verified-publisher` alternative
3. You've performed a security review of the server's code and transport

## Security Review Checklist

Before writing the override, complete this review:

### Transport Security

- [ ] Server uses TLS for all HTTP endpoints (no plaintext)
- [ ] Stdio servers don't write secrets to stdout/stderr
- [ ] No credentials embedded in the server binary or package

### Input Validation

- [ ] Tool parameters are validated (type-checked, bounded)
- [ ] No shell injection vectors in tool implementations
- [ ] File-path tools restrict access to declared scopes

### Data Handling

- [ ] Server doesn't exfiltrate user data to undeclared endpoints
- [ ] Responses don't include data from other tenants
- [ ] Logs don't persist sensitive content beyond the session

### Supply Chain

- [ ] Package source is public and auditable (GitHub repo)
- [ ] Dependencies are pinned (lockfile committed)
- [ ] No known CVEs in the dependency tree
- [ ] Package checksums match between registry and source

### Scope

- [ ] Tools do only what their descriptions claim
- [ ] No hidden administrative or destructive capabilities
- [ ] Resource access is read-only unless explicitly documented

## Steps

### 1. Identify the Community Server

Check which server is failing the trust policy:

```bash
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

Output:

```
  ❌ 1 untrusted MCP area slug(s) without trust_overrides:

    • agents/fai-data-engineer.agent.md
      mcpAttachments.required: "my-internal-db" (trust: community)
      Fix: add trustOverrides entry or use a trusted server
```

### 2. Perform the Security Review

Use the checklist above and record the review in your team's system (Jira, Linear, GitHub Issue, etc.).

Example review ticket:

```
Title: MCP Trust Review — my-internal-db
Server: @my-org/mcp-db-server v2.1.0
Reviewer: @engineer-name
Date: 2026-06-15
Verdict: APPROVED with conditions
Conditions:
  - Pin to v2.1.0 (do not auto-update)
  - Re-review at next major version
  - Only approved for Play 27 (ai-data-pipeline)
```

### 3. Write the Override (Agent)

For an agent file, add `trustOverrides` inside `mcpAttachments`:

```yaml
---
description: "Data engineering expert — pipelines, transforms, quality."
name: "FAI Data Engineer"
tools: ["codebase", "terminal"]
mcpAttachments:
  required: ["azure", "my-internal-db"]
  optional: ["github"]
  trustOverrides:
    my-internal-db: "SEC-4421 reviewed 2026-06-15 by @engineer-name, pinned v2.1.0"
---
```

### 4. Write the Override (Play)

For a solution play, add `trust_overrides` inside `mcp_scope.router_config`:

```yaml
---
description: "Production agent for AI Data Pipeline (Play 27)"
tools: ["terminal", "file"]
mcp_scope:
  attached: ["azure", "my-internal-db"]
  router_config:
    trust_overrides:
      my-internal-db: "SEC-4421 reviewed 2026-06-15 by @engineer-name, pinned v2.1.0"
---
```

Or in `spec/mcp-scope.json`:

```json
{
  "attached": ["azure", "my-internal-db"],
  "router_config": {
    "trust_overrides": {
      "my-internal-db": "SEC-4421 reviewed 2026-06-15 by @engineer-name, pinned v2.1.0"
    }
  }
}
```

### 5. Re-Run the Trust Policy Validator

```bash
node frootai-core/scripts/orchard/validate-mcp-trust-policy.js
```

Expected output:

```
  Checked 3 slug trust-level(s) across 238 agents, 101 plays.
  ✅ All attached MCP areas are trusted or have explicit trust_overrides.
```

### 6. Document the Override in Your PR

Include in the PR description:

```markdown
## Trust Override Added

- **Server**: my-internal-db (@my-org/mcp-db-server v2.1.0)
- **Trust level**: community
- **Review ticket**: SEC-4421
- **Reviewer**: @engineer-name
- **Expiry**: Re-review required at next major version bump
- **Scope**: Only approved for fai-data-engineer agent / Play 27
```

## Override Value Format

The override value is a free-form string. We recommend this structure:

```
<ticket-id> reviewed <date> by <reviewer>, <constraints>
```

Examples:

```
SEC-4421 reviewed 2026-06-15 by @alice, pinned v2.1.0
INFRA-892 reviewed 2026-05-01 by @bob, read-only tools only
SECURITY-103 reviewed 2026-06-20 by @carol, internal network only
```

## Revoking an Override

To revoke access:

1. Remove the slug from `attached` / `required` / `optional`
2. Remove the `trust_overrides` entry
3. Run both validators to confirm clean state
4. Reference the revocation reason in the commit message

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Empty override value (`"my-db": ""`) | Must include review reference — validators accept any non-empty string but empty defeats the audit purpose |
| Override for a server not in the seed roster | M10.5 will still fail — add the server to `mcp-servers-seed.json` first |
| Override without a review ticket | Acceptable for personal dev but should be flagged in PR review |
| Using override to bypass `untrusted` tier | Won't work — `untrusted` is always blocked regardless of overrides |
| Forgetting to re-review after version bump | Set a calendar reminder or CI check for version drift |

## Next Steps

- **Recipe 23** — Troubleshoot MCP attach failures (debug runtime connection issues)
- **Recipe 19** — Attach MCP to an Agent (the basics, if you haven't started there)
- **Recipe 20** — Author a Play with mcp_scope (play-level configuration)
