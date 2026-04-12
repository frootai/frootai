---
name: deploy-ai-powered-testing
description: "Deploy AI-Powered Testing — configure LLM test generation from source AST, mutation testing framework, test prioritization, CI/CD integration for automated test suites. Use when: deploy, set up test automation."
---

# Deploy AI-Powered Testing

## When to Use
- Generate unit/integration tests automatically from source code
- Set up mutation testing to validate test effectiveness
- Configure test prioritization (run most critical tests first)
- Integrate AI test generation into CI/CD pipelines
- Detect and reduce flaky tests automatically

## Prerequisites
1. Source code repository with functions/classes to test
2. Azure OpenAI (gpt-4o for complex test generation, gpt-4o-mini for simple)
3. Test framework installed (pytest, Jest, Pester, etc.)
4. GitHub Actions or Azure DevOps for CI integration

## Step 1: Configure Test Generation Pipeline
```
Source Code → AST Parser → Function Signatures + Logic
    → GPT-4o generates test cases (unit + edge + error)
    → Test file creation → Run tests → Report coverage
    → Mutation testing → Verify test strength
```

## Step 2: Configure AST-Based Generation
| Language | AST Parser | Test Framework |
|----------|-----------|----------------|
| Python | ast module | pytest |
| TypeScript | ts-morph | Jest/Vitest |
| C# | Roslyn | xUnit/NUnit |
| PowerShell | Parser API | Pester |
| Java | JavaParser | JUnit |

```python
# Extract function signatures for test generation
import ast
tree = ast.parse(source_code)
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        signature = { "name": node.name, "params": [a.arg for a in node.args.args],
                      "returns": ast.dump(node.returns) if node.returns else None }
```

## Step 3: Configure LLM Test Prompts
```python
system_prompt = """Generate comprehensive tests for the function below.
Include: happy path, edge cases, error cases, boundary values.
Use pytest. Each test should have a descriptive name.
Include docstrings explaining what each test verifies.
Use unittest.mock for external dependencies.
Do NOT test implementation details — test behavior."""
```

## Step 4: Configure Mutation Testing
| Mutation Type | What It Changes | Purpose |
|--------------|----------------|---------|
| Conditional | `if x > 5` → `if x >= 5` | Test boundary conditions |
| Arithmetic | `a + b` → `a - b` | Test calculations |
| Return value | `return True` → `return False` | Test assertions |
| Null injection | `return result` → `return None` | Test null handling |
| Exception removal | Remove try/catch | Test error handling |

## Step 5: Configure CI Integration
```yaml
name: AI Test Generation
on: [pull_request]
jobs:
  generate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate tests for changed files
        run: python scripts/generate_tests.py --changed-files $(git diff --name-only HEAD~1)
      - name: Run generated tests
        run: pytest tests/generated/ -v --cov --cov-report=term
      - name: Mutation testing
        run: python scripts/mutation_test.py --target src/ --tests tests/generated/
```

## Step 6: Post-Deployment Verification
- [ ] Test generation producing valid, runnable tests
- [ ] Generated tests passing on current code
- [ ] Mutation testing detecting weak assertions
- [ ] CI pipeline running on every PR
- [ ] Coverage report showing improvement
- [ ] Flaky test detector flagging unstable tests
- [ ] Test prioritization ordering by risk

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Generated tests don't compile | Wrong test framework | Set framework in config |
| Tests too trivial (assert True) | Prompt too vague | Add "test behavior, not implementation" |
| Import errors in generated tests | Missing dependencies | Include dependency context in prompt |
| Mutation score low (<50%) | Weak assertions | Re-generate with "strong assertions" directive |
| Flaky test detected | Non-deterministic code | Add retry + flag for human review |
| CI too slow | Running all tests | Enable test prioritization |
