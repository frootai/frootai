---
description: "Taming Copilot — prevent overreach, enforce constraints, verify before executing, undo patterns."
applyTo: "**"
waf:
  - "security"
  - "reliability"
---

# Taming Copilot — FAI Standards

## Effective Prompting

Be specific. Copilot predicts from context — vague prompts produce vague code.

- State the language, framework, and constraints upfront: "Write a Python FastAPI endpoint that accepts JSON, validates with Pydantic, and returns 422 on bad input"
- Include variable names, return types, and error handling expectations in your prompt
- One task per prompt — "add retry logic to this function" beats "refactor and improve this file"
- Provide examples of expected input/output when the format matters
- Reference existing code: "follow the same pattern as `createUser()` in auth.service.ts"

## Inline Suggestions

- **Tab** accepts the full suggestion, **Esc** dismisses it
- **Ctrl+Right** (Windows/Linux) or **Cmd+Right** (macOS) accepts word-by-word — use this for partial accept when only the first part is correct
- **Alt+]** / **Alt+[** cycles through alternative suggestions
- If suggestions are consistently wrong, add a comment above the line describing intent — Copilot re-anchors on comments
- Dismiss and retype the first few characters to get a fresh suggestion set

## Copilot Chat

Slash commands target specific workflows:

```
/explain    — explain selected code or error messages
/fix        — propose a fix for diagnostics in the selection
/tests      — generate unit tests for selection
/doc        — generate JSDoc/docstring for function
/new        — scaffold a new project via workspace creation
```

Context scoping — tell Copilot where to look:

```
@workspace how is authentication handled?       — searches entire project
#file:src/auth.ts explain the token refresh flow — scopes to one file
#selection rewrite this with async/await         — operates on editor selection
@terminal explain the last error                 — reads terminal output
```

Combine them: `@workspace /tests for #file:src/utils/retry.ts` generates tests scoped to one file using full project context.

## Instruction Files for Project Standards

Create `.github/copilot-instructions.md` to inject project-wide rules into every Copilot interaction:

```markdown
# Project Standards
- Use `snake_case` for Python, `camelCase` for TypeScript
- All API responses follow `{ data, error, meta }` envelope
- Never use `any` — define interfaces in `types/`
- Logging via `structlog` (Python) or `pino` (Node) — no console.log
```

Scoped instructions target specific file types:

```yaml
# .github/instructions/python-api.instructions.md
---
description: "Python API conventions"
applyTo: "**/*.py"
---
Use FastAPI with Pydantic v2. Always add `response_model` to endpoints.
Return 422 for validation errors, 404 for missing resources, 500 for unhandled.
```

## Agent Mode

Agent mode follows Explore → Plan → Implement → Review:

1. **Explore** — Copilot reads your codebase, identifies relevant files, runs terminal commands
2. **Plan** — proposes a multi-step plan before writing code. Review the plan — reject steps that touch unrelated files
3. **Implement** — edits files, creates new ones, runs builds. Watch the diff view — revert individual hunks you disagree with
4. **Review** — verifies with build/test runs. If tests fail, it auto-diagnoses and retries

Guard rails for agent mode:
- Undo freely — every edit is a separate checkpoint you can revert
- If agent suggests deleting a file, verify it's truly unused before accepting
- Watch for scope creep — agent may "improve" adjacent code. Reject edits outside your task

## Custom Agents

Define specialized agents in `.github/agents/`:

```yaml
# .github/agents/builder.agent.md
---
description: "Implements features following project conventions"
model: ["gpt-4o", "gpt-4o-mini"]
tools: ["codebase", "terminal", "fetch"]
---
You are a builder agent. Follow config/*.json for all tunable parameters.
Use DefaultAzureCredential for Azure auth. Run tests after every change.
```

Invoke with `@builder implement the retry middleware` in Copilot Chat.

## Accept vs Reject Decisions

**Accept** when the suggestion:
- Matches your intent and follows project patterns
- Handles edge cases (null checks, error paths) correctly
- Uses the right imports and types from your codebase

**Reject** when:
- It invents APIs or methods that don't exist (hallucination)
- It adds unnecessary abstractions for a one-time operation
- It uses deprecated packages or insecure patterns (e.g., `eval()`, SQL concatenation)
- The logic is correct but naming doesn't match project conventions — partial-accept + rename

## Comment-Driven Development

Write the comment first, let Copilot fill in the implementation:

```python
# Retry with exponential backoff: base=1s, max=30s, 3 attempts, jitter
def retry_with_backoff(func, *args, **kwargs):
    # Copilot generates the implementation from the comment above
```

This works especially well for:
- Algorithm descriptions ("Binary search on sorted timestamps")
- Regex patterns ("Match ISO 8601 dates with optional timezone")
- Data transformations ("Pivot rows to columns, group by category")

## Test Generation

- Select a function → `/tests` generates a test file matching your framework (pytest/jest/xUnit)
- Add edge cases manually — Copilot tends to generate happy-path tests
- Prompt for specific scenarios: "add a test for when the API returns 429 and retry succeeds on attempt 2"
- Comment above test: `# Verify PII is redacted from log output` → Copilot writes the assertion

## Security Review with Copilot

Select suspicious code and ask:

```
@workspace /explain are there any security vulnerabilities in #selection?
```

Check for OWASP LLM Top 10:
- Prompt injection — does user input flow directly into LLM prompts without sanitization?
- Insecure output handling — is LLM output rendered as HTML or executed as code?
- Sensitive data exposure — are API keys, tokens, or PII logged or returned in responses?
- Excessive permissions — does the service account have broader access than needed?

## Refactoring Workflows

1. Select the code block → ask "extract this into a function with proper types"
2. Use `/fix` on diagnostic warnings to auto-resolve linting issues
3. "Convert this callback chain to async/await" — Copilot handles the transformation
4. Rename via F2 (symbol rename) — Copilot respects workspace-wide references
5. Agent mode for large refactors: "move all database logic from controllers into a `db/` service layer"

## Copilot CLI

```bash
gh copilot explain "kubectl get pods -n production | grep CrashLoop"
# → Explains each flag, pipe, and grep pattern

gh copilot suggest "find all .env files not in .gitignore"
# → Generates the shell command for your OS
```

Use `explain` before running unfamiliar commands from Stack Overflow or AI suggestions.

## Workspace Indexing

Copilot indexes your workspace for `@workspace` queries. Maximize quality:
- Keep `.gitignore` current — indexed files = relevant context
- Use descriptive file/folder names — `services/auth.ts` beats `utils/helper2.ts`
- Add brief module-level comments — they appear in search results
- Large monorepos: open only the relevant subfolder to reduce noise

## Anti-Patterns

- ❌ Accepting suggestions without reading them — always review the diff
- ❌ Prompting with "make this better" — be specific about what to change
- ❌ Using Copilot output as-is for security-critical code (auth, crypto, input validation)
- ❌ Ignoring red squiggles after accepting — type errors mean the suggestion was wrong
- ❌ Hardcoding secrets because Copilot suggested `apiKey = "sk-..."` in a code pattern
- ❌ Letting agent mode refactor code outside the scope of your current task
- ❌ Skipping tests after Copilot-generated changes — "it looks right" isn't verification

## WAF Alignment

| Pillar | Copilot Practice |
|--------|-----------------|
| **Security** | Review every suggestion touching auth, crypto, or input handling. Use `.instructions.md` to enforce `DefaultAzureCredential`. Never accept hardcoded secrets. |
| **Reliability** | Verify error handling in generated code — add retry, timeout, and fallback if missing. Run tests after every accepted change. |
| **Cost Optimization** | Use `gpt-4o-mini` model in agent config for simple tasks. Avoid regenerating large files — use targeted edits. Set `max_tokens` in config, not inline. |
| **Operational Excellence** | Commit Copilot instruction files to repo. Use agent mode's plan step as a lightweight design review. Keep `.gitignore` tuned for indexing. |
| **Performance** | Reject suggestions that add unnecessary abstractions or synchronous I/O. Use streaming patterns from instruction files. Partial-accept to keep only the fast path. |
| **Responsible AI** | Never ship LLM-generated content to users without Content Safety. Review generated test data for bias. Keep humans in the loop for AI-critical decisions. |
