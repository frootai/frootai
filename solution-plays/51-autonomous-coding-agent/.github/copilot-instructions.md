---
description: "Autonomous Coding Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Autonomous Coding Agent — Domain Knowledge

This workspace implements an autonomous coding agent — issue-to-PR automation, multi-file code changes, test generation, PR creation, and self-healing CI pipelines.

## Autonomous Coding Architecture (What the Model Gets Wrong)

### Issue → Plan → Code → Test → PR Pipeline
```python
async def resolve_issue(issue: GitHubIssue) -> PullRequest:
    # 1. Understand the issue (classify: bug, feature, refactor)
    analysis = await analyze_issue(issue)
    
    # 2. Create implementation plan (which files, what changes)
    plan = await create_plan(analysis, codebase_index)
    
    # 3. Implement changes (one file at a time, verify each)
    branch = create_branch(f"fix/{issue.number}")
    for change in plan.changes:
        await implement_change(change)
        await verify_change(change)  # Compile/lint after each file
    
    # 4. Generate tests for changed code
    tests = await generate_tests(plan.changes)
    
    # 5. Run tests locally before PR
    test_result = await run_tests()
    if not test_result.passed:
        await fix_failing_tests(test_result)
    
    # 6. Create PR with description
    return await create_pr(branch, issue, plan, test_result)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Change all files at once | Can't isolate which change broke things | One file at a time, verify after each |
| No plan before coding | Random changes, missed files | Plan: list files + changes BEFORE implementing |
| Skip tests | PR without tests = tech debt | Generate tests for every changed function |
| No local verification | PR fails CI = wasted review time | Run lint + tests before PR creation |
| Commit to main directly | No review, no rollback | Always use feature branch + PR |
| Ignore existing tests | Break existing functionality | Run full test suite, not just new tests |
| No PR description | Reviewer has no context | Auto-generate: what changed, why, testing done |
| Unbounded changes | Agent rewrites entire codebase | Scope to issue — max 10 files per PR |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Coding model, temperature=0 for deterministic code |
| `config/guardrails.json` | Max files per PR, allowed file types, test requirements |
| `config/agents.json` | Plan approval rules, auto-merge criteria, branch naming |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement issue resolution, code changes, test generation |
| `@reviewer` | Audit code quality, test coverage, PR completeness |
| `@tuner` | Optimize plan quality, reduce iteration count, improve test coverage |

## Slash Commands
`/deploy` — Deploy agent | `/test` — Run on sample issue | `/review` — Audit code quality | `/evaluate` — Measure resolution rate
