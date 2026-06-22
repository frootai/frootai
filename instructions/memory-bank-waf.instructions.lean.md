---
description: "Persistent project documentation standards — maintain context across AI sessions with structured memory files."
applyTo: "**"
waf:
  - "operational-excellence"
---

# Memory Bank & Context Management — FAI Standards

> Standards for coding agent memory systems — persistent context, session tracking, and cross-conversation continuity.

## Memory Scopes

Three tiers, each with distinct lifecycle and visibility:

| Scope | Path | Persists | Visibility | Use For |
| --- | --- | --- | --- | --- |
| **User** | `/memories/` | Forever | All workspaces | Preferences, patterns, lessons learned |
| **Session** | `/memories/session/` | Current conversation | Single chat session | Task plans, progress tracking, WIP notes |
| **Repo** | `/memories/repo/` | Until deleted | Current workspace | Build commands, conventions, project state |

- User memory auto-loads first 200 lines into context — keep it lean
- Session memory files are listed but NOT auto-loaded — read explicitly when needed
- Repo memory is workspace-scoped — store codebase facts, not personal preferences

## File Structure Standards

Organize by topic, one concern per file. Use descriptive kebab-case names:

```
/memories/
├── preferences.md          # Editor, language, machine constraints
├── debugging.md             # Lessons from past debugging sessions
├── patterns.md              # Coding patterns that worked well
└── session/
    ├── migration-plan.md    # Current task plan + progress
    ├── api-redesign.md      # Multi-turn task state
    └── bug-analysis.md      # Investigation notes
```

## When to Read vs Write

### Read Memory
- **Start of conversation** — check `/memories/` and `/memories/session/` for prior context
- **Before creating files** — check if a memory on the topic already exists (deduplication)
- **When stuck** — prior sessions may have solved the same problem

### Write Memory
- **Discovered a non-obvious gotcha** — e.g., a framework quirk, version-specific behavior
- **User states a preference** — e.g., "always use pnpm", "never use classes"
- **Completing a multi-step task** — update progress so next session can resume
- **After a hard-won fix** — record the root cause and solution

### Delete Memory
- **Information is outdated** — project migrated, tool changed, pattern abandoned
- **Session complete** — clean up session files for finished tasks
- **Duplicate exists** — merge into existing file, remove the duplicate

## Conciseness Rules

User memory is expensive — every line loads into every conversation. Enforce brevity:

```markdown
# Good — terse bullet points
- Windows ARM64, limited RAM
- NEVER use `next dev` — eats 2-3GB, use `npx serve out` instead
- Node v22.18.0

# Bad — prose paragraphs
The user is running Windows on ARM64 architecture. Their machine has
limited RAM available, so we should be careful about memory-intensive
operations. They prefer using Node.js version 22.18.0 and have
mentioned that running next dev causes issues...
```

## Deduplication Protocol

Before creating any memory file:
1. **View the directory** — `view /memories/` to see what exists
2. **Check for overlap** — if `preferences.md` exists, don't create `user-prefs.md`
3. **Update existing** — use `str_replace` or `insert` to add to existing files
4. **Merge if needed** — consolidate scattered notes into one topical file

## Multi-Turn Task Tracking

For tasks spanning multiple exchanges, use session memory with structured progress:

```markdown
# API Migration — Progress

## Plan
1. ✅ Audit current endpoints (found 23 routes)
2. ✅ Design new schema (saved to docs/api-v2.md)
3. 🔄 Migrate auth routes (3/7 done)
4. ⬜ Migrate data routes
5. ⬜ Update tests

## Decisions
- Keep backward compat for /v1/users (3 consumers)
- New routes use kebab-case, old stay camelCase

## Blockers
- Token refresh endpoint needs Redis — blocked on infra ticket #142
```

## Cross-Session Continuity

Repo memory bridges sessions for long-running projects:

```json
// /memories/repo/ example structure (as .md files)
{
  "build_command": "npm run build",
  "test_command": "npm test -- --coverage",
  "deploy_command": "az containerapp up",
  "conventions": {
    "naming": "kebab-case files, camelCase variables",
    "testing": "vitest, 80% coverage target",
    "branching": "feature/* → main, no develop branch"
  },
  "known_issues": [
    "PostCSS workers leak on crash — kill orphans before build",
    "Config validation runs at startup — never skip"
  ]
}
```

## Coding Preference Patterns

Record preferences as actionable rules, not vague opinions:

```markdown
# preferences.md — good entries
- Prefer `const` over `let` — only use `let` for actual reassignment
- Error messages: include operation name + entity ID, never just "failed"
- Imports: group stdlib → external → internal, blank line between groups
- Tests: arrange-act-assert, one assertion per test where practical
- Never auto-add docstrings to code I didn't write
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Dumping full file contents into memory | Bloats context, wastes tokens every conversation | Store only key facts, reference file paths |
| Creating a new file per conversation | Memory directory explodes, duplicates everywhere | Append to existing topical files |
| Writing prose paragraphs | User memory auto-loads — prose wastes token budget | Bullet points, 1-2 lines max per entry |
| Never cleaning up session memory | Stale plans confuse future sessions | Delete session files when task completes |
| Storing secrets or credentials | Memory files may be shared or synced | Never store API keys, tokens, passwords |
| Recording obvious information | "Python uses indentation" adds no value | Only record non-obvious insights and gotchas |
| Not checking before creating | Creates duplicate `debugging.md` and `debug-notes.md` | Always `view` directory first |
| Storing transient state as permanent | "Currently on step 3" in user memory is stale next week | Use session memory for WIP, user memory for lessons |

## WAF Alignment

| Pillar | Memory Practice |
|--------|----------------|
| **Operational Excellence** | Track build commands, deploy steps, and project conventions in repo memory — eliminates repeated discovery |
| **Reliability** | Record known failure modes and workarounds — prevents re-encountering solved problems |
| **Security** | Never store secrets, credentials, or PII in memory files — treat memory as potentially shared |
| **Cost Optimization** | Keep user memory under 200 lines — every line loads into every conversation's token budget |
| **Performance Efficiency** | Read session memory on-demand, not eagerly — only load what the current task needs |
| **Responsible AI** | Don't store user-identifying information or conversation content — only store technical facts |
