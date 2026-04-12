---
name: "deploy-autonomous-coding-agent"
description: "Deploy Autonomous Coding Agent — issue-to-PR pipeline, codebase indexing, multi-file implementation, test generation, GitHub integration, CI self-healing."
---

# Deploy Autonomous Coding Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- GitHub repository with Issues enabled + PAT with `repo` scope
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for code generation)
  - `Microsoft.App` (Container Apps for agent runtime)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ or Node.js 18+ runtime
- `.env` file with: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-autonomous-coding --location eastus2

az deployment group create \
  --resource-group rg-frootai-autonomous-coding \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-auto-coding \
  --name github-token --value "$GITHUB_TOKEN"
az keyvault secret set --vault-name kv-auto-coding \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Code Generation Model

```bash
az cognitiveservices account deployment create \
  --name openai-auto-coding \
  --resource-group rg-frootai-autonomous-coding \
  --deployment-name gpt-4o-coder \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 50 --sku-name Standard
```

Model configuration for code generation:
- **temperature**: 0 (deterministic, reproducible code)
- **seed**: 42 (consistent output for same input)
- **max_tokens**: 4096 (sufficient for large functions)
- **response_format**: JSON for structured plans, plain for code

## Step 3: Deploy Issue-to-PR Pipeline

```python
# autonomous_coder.py — core pipeline
class AutonomousCodingAgent:
    def __init__(self, config):
        self.github = GitHubClient(config["github_token"])
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.max_files_per_pr = config.get("max_files", 10)
        self.require_tests = config.get("require_tests", True)
        self.auto_merge = config.get("auto_merge", False)

    async def resolve_issue(self, issue_number: int):
        # Phase 1: Analyze issue
        issue = await self.github.get_issue(issue_number)
        analysis = await self.analyze_issue(issue)

        # Phase 2: Index codebase (understand structure)
        codebase = await self.index_codebase()

        # Phase 3: Create implementation plan
        plan = await self.create_plan(analysis, codebase)
        if len(plan.files) > self.max_files_per_pr:
            raise ScopeError(f"Plan touches {len(plan.files)} files (max {self.max_files_per_pr})")

        # Phase 4: Create branch + implement changes
        branch = await self.github.create_branch(f"fix/{issue_number}")
        for change in plan.changes:
            await self.implement_change(change)
            await self.verify_change(change)  # Lint + compile after each file

        # Phase 5: Generate tests
        if self.require_tests:
            tests = await self.generate_tests(plan.changes)
            await self.commit_tests(tests)

        # Phase 6: Run full test suite
        test_result = await self.run_tests()
        if not test_result.passed:
            await self.self_heal(test_result, max_attempts=3)

        # Phase 7: Create PR
        pr = await self.github.create_pr(
            branch=branch, title=f"Fix #{issue_number}: {analysis.title}",
            body=self.generate_pr_description(issue, plan, test_result),
        )
        return pr
```

## Step 4: Configure Codebase Indexing

```python
# codebase_index.py — understand repository structure
class CodebaseIndexer:
    def __init__(self, config):
        self.max_files = config.get("max_index_files", 500)
        self.ignore_patterns = config.get("ignore", [
            "node_modules", ".git", "__pycache__", "dist", "build",
            "*.lock", "*.min.js", "*.map"
        ])

    async def index(self, repo_path: str) -> CodebaseIndex:
        """Build searchable index of repository structure."""
        return CodebaseIndex(
            file_tree=self.build_file_tree(repo_path),
            imports=self.extract_imports(repo_path),
            exports=self.extract_exports(repo_path),
            test_patterns=self.detect_test_framework(repo_path),
            language=self.detect_language(repo_path),
        )
```

## Step 5: Configure Self-Healing CI

```python
# self_heal.py — fix failing tests automatically
class SelfHealer:
    async def heal(self, test_result, max_attempts=3):
        for attempt in range(max_attempts):
            # Analyze failure
            failure = await self.analyze_failure(test_result)

            # Generate fix
            fix = await self.generate_fix(failure)
            await self.apply_fix(fix)

            # Re-run tests
            test_result = await self.run_tests()
            if test_result.passed:
                return test_result

        raise HealingFailed(f"Could not fix tests after {max_attempts} attempts")
```

## Step 6: Deploy Agent Runtime

```bash
az acr build --registry acrAutoCoding \
  --image autonomous-coder:latest .

az containerapp create \
  --name autonomous-coder \
  --resource-group rg-frootai-autonomous-coding \
  --environment auto-coding-env \
  --image acrAutoCoding.azurecr.io/autonomous-coder:latest \
  --target-port 8080 \
  --min-replicas 0 --max-replicas 3 \
  --secrets github-token=keyvaultref:kv-auto-coding/github-token,openai-key=keyvaultref:kv-auto-coding/openai-key \
  --env-vars GITHUB_TOKEN=secretref:github-token OPENAI_KEY=secretref:openai-key
```

## Step 7: Configure GitHub Webhook

```bash
# Register webhook for issue events
curl -X POST "https://api.github.com/repos/$OWNER/$REPO/hooks" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d '{
    "config": {
      "url": "https://autonomous-coder.azurecontainerapps.io/api/webhook",
      "content_type": "json"
    },
    "events": ["issues"],
    "active": true
  }'
```

Webhook triggers:
- `issues.labeled` with label `auto-fix` → trigger autonomous resolution
- `issues.assigned` to bot account → trigger autonomous resolution
- Manual: POST to `/api/resolve/{issue_number}`

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Agent healthy | `curl /health` | 200 OK |
| Codebase indexed | `/api/index` | File tree + imports |
| Issue analysis | Submit test issue | Classification + plan |
| Code generation | Implement change | Compiles + lints |
| Test generation | Auto-generate tests | Tests pass |
| PR creation | End-to-end flow | PR with description |
| Self-healing | Introduce failing test | Auto-fixes within 3 attempts |
| Scope guard | 11+ file change | Rejected (max 10) |
| Webhook | Label issue `auto-fix` | Agent triggers |

## Rollback Procedure

```bash
# Close PR and delete branch
gh pr close $PR_NUMBER --delete-branch

# Revert container
az containerapp revision list --name autonomous-coder \
  --resource-group rg-frootai-autonomous-coding
az containerapp ingress traffic set --name autonomous-coder \
  --resource-group rg-frootai-autonomous-coding \
  --revision-weight previousRevision=100
```
