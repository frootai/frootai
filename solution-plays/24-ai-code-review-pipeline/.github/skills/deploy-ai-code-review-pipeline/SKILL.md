---
name: deploy-ai-code-review-pipeline
description: "Deploy AI Code Review Pipeline — configure GitHub Actions for automated PR review, static analysis, LLM-powered code comments, OWASP scanning, merge gates. Use when: deploy, configure CI/CD review."
---

# Deploy AI Code Review Pipeline

## When to Use
- Set up automated AI-powered code review on GitHub PRs
- Configure static analysis tools as first pass
- Deploy LLM-based review for architecture, logic, and security
- Set up OWASP dependency scanning
- Configure merge gate rules (block on critical findings)

## Prerequisites
1. GitHub repository with branch protection enabled
2. GitHub PAT with `repo`, `pull_request` scopes
3. Azure OpenAI for LLM review (gpt-4o for complex, gpt-4o-mini for style)
4. GitHub Actions runner (GitHub-hosted or self-hosted)

## Step 1: Configure GitHub Actions Workflow
```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]
    branches: [main, develop]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Get changed files
        run: git diff --name-only origin/main...HEAD > changed_files.txt
      - name: Static analysis
        run: npx eslint $(cat changed_files.txt | grep -E '\.ts$|\.js$') || true
      - name: OWASP dependency check
        run: npx audit-ci --critical
      - name: LLM code review
        run: python scripts/llm_review.py --files changed_files.txt --post-comments
```

## Step 2: Configure LLM Review Pipeline
```
Changed Files → Diff Extraction → File Classification
    ├── Small diff (<100 lines) → gpt-4o-mini (style, naming)
    ├── Medium diff (100-500 lines) → gpt-4o (logic, patterns)
    ├── Security-related files → gpt-4o (OWASP LLM Top 10)
    └── Infra files (.bicep, .tf) → gpt-4o (security config)
                                    ↓
              Review Comments → GitHub PR Comment API
```

## Step 3: Configure Review Categories
| Category | Severity | Action | Reviewer |
|----------|----------|--------|----------|
| Security vulnerability | Critical | Block merge | gpt-4o |
| Hardcoded secrets | Critical | Block merge | Static scan |
| Logic error | High | Request changes | gpt-4o |
| Performance concern | Medium | Comment | gpt-4o-mini |
| Style/naming | Low | Suggestion | gpt-4o-mini |
| Documentation missing | Low | Suggestion | gpt-4o-mini |

## Step 4: Configure Merge Gate Rules
```json
{
  "block_on_critical": true,
  "block_on_high": false,
  "require_author_response": true,
  "auto_approve_low": true,
  "max_open_findings": 5
}
```

## Step 5: Configure Review Prompts
System prompt focus: security (OWASP), logic errors (off-by-one, null, race), performance (N+1, indexes), best practices. No style-only comments.

## Step 6: Post-Deployment Verification
- [ ] GitHub Action triggers on PR creation
- [ ] Static analysis runs without crashing
- [ ] LLM review generates actionable comments
- [ ] Comments posted to correct PR lines
- [ ] Merge blocked on critical findings
- [ ] OWASP dependency scan detecting vulnerabilities

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No comments posted | Missing PAT permissions | Grant `pull_request: write` scope |
| Comments on wrong lines | Diff offset wrong | Use unified diff with correct hunks |
| Too many comments (noise) | Style issues reviewed | Add "no style" to prompt |
| Review >5 min | Large PR reviewed entirely | Only review changed files |
| Merge not blocked | No branch protection | Enable required status checks |
| Duplicate comments | No dedup on re-push | Check existing comments first |

## Security Considerations
- Store GitHub PAT in Key Vault or GitHub Actions secrets (never in code)
- Limit PAT scope to `pull_request:write` + `contents:read` only
- Review comments should NOT include the vulnerable code in plain text
- Log all review actions for audit trail (who reviewed, what was found)
- Rate limit the review pipeline (max 10 PRs/minute) to prevent abuse
