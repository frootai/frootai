---
name: fai-release-readiness
description: "Pre-release compliance gate — validates version consistency, changelog, schema compliance, secrets scan, license audit, breaking change detection, build verification, and rollback planning. Blocks or approves publish to npm, PyPI, and VS Code Marketplace."
on:
  workflow_dispatch:
    inputs:
      target:
        description: "Release target"
        type: choice
        options: [mcp-server, python-sdk, vscode-extension, python-mcp, all]
        required: true
      bump_type:
        description: "Semver bump type"
        type: choice
        options: [patch, minor, major]
        required: false
        default: patch
      dry_run:
        description: "Preview only — do not create issue"
        type: boolean
        required: false
        default: false
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[Release Readiness] "
    labels: ["release", "automated"]
timeout-minutes: 20
---

## Step 1: Determine release scope

```bash
TARGET="${{ inputs.target }}"
BUMP="${{ inputs.bump_type || 'patch' }}"
DRY_RUN="${{ inputs.dry_run || 'false' }}"
CURRENT=$(node -e "console.log(require('./package.json').version)")
echo "Current: $CURRENT | Target: $TARGET | Bump: $BUMP"
```

**Package registry mapping:**

| Package | Registry | Config File | Publish Cmd |
|---------|----------|-------------|-------------|
| mcp-server | npm | `mcp-server/package.json` | `npm publish` |
| python-sdk | PyPI | `python-sdk/pyproject.toml` | `twine upload` |
| vscode-extension | Marketplace | `vscode-extension/package.json` | `vsce publish` |
| python-mcp | PyPI | `python-mcp/pyproject.toml` | `twine upload` |

## Step 2: Validate version consistency

```bash
node scripts/validate-consistency.js 2>&1
CONSIST_EXIT=$?
```

Check all package files align:

```bash
node -e "
  const fs = require('fs');
  const root = require('./package.json').version;
  const checks = [
    ['mcp-server', require('./mcp-server/package.json').version],
    ['vscode-ext', require('./vscode-extension/package.json').version],
  ];
  checks.forEach(([pkg, ver]) => {
    console.log((ver === root ? 'MATCH' : 'MISMATCH') + '|' + pkg + '|' + ver + '|expected=' + root);
  });
"
```

Also verify `mcp-server/knowledge.json` version and `marketplace.json` freshness.

## Step 3: Compute next version

```bash
node -e "
  const [M, m, p] = '$CURRENT'.split('.').map(Number);
  const bump = '$BUMP';
  const next = bump === 'major' ? (M+1)+'.0.0' : bump === 'minor' ? M+'.'+(m+1)+'.0' : M+'.'+m+'.'+(p+1);
  console.log('NEXT=' + next);
"
```

| Change Type | Bump | Examples |
|------------|------|---------|
| Bug fixes, docs | patch | Typo fix, dep update |
| New features, non-breaking | minor | New agent, skill, play |
| Breaking API changes | major | Schema change, removed field |

## Step 4: Primitive validation

```bash
node scripts/validate-primitives.js --verbose 2>&1
PRIM_EXIT=$?
PRIM_ERRORS=$(node scripts/validate-primitives.js 2>&1 | grep -c 'ERROR' || echo 0)
echo "Primitives: exit=$PRIM_EXIT errors=$PRIM_ERRORS"
```

Must exit 0 with 0 errors. Any failure is a release blocker.

## Step 5: Schema compliance

Verify each JSON schema in `schemas/` is valid and test against sample files.

| Schema | Validates Against |
|--------|------------------|
| `fai-manifest.schema.json` | `solution-plays/*/fai-manifest.json` |
| `fai-context.schema.json` | `solution-plays/*/fai-context.json` |
| `plugin.schema.json` | `plugins/*/plugin.json` |
| `hooks.schema.json` | `hooks/*/hooks.json` |

```bash
for SCHEMA in schemas/*.json; do
  node -e "
    try { const s = require('./$SCHEMA'); console.log('SCHEMA_OK|$(basename $SCHEMA)'); }
    catch(e) { console.log('SCHEMA_FAIL|$(basename $SCHEMA)|' + e.message); }
  "
done
```

## Step 6: Secrets scan

```bash
SECRETS=0
PATTERNS='sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9-]{20}'
HITS=$(git grep -lP "$PATTERNS" -- ':!*.md' ':!NOTICE' 2>/dev/null | wc -l)
SECRETS=$((SECRETS + HITS))
CONN=$(git grep -l 'DefaultEndpointsProtocol=' -- ':!*.md' 2>/dev/null | wc -l)
SECRETS=$((SECRETS + CONN))
echo "SECRETS_TOTAL=$SECRETS"
```

Must find 0 secrets. Any finding blocks the release.

## Step 7: Changelog validation

```bash
NEXT="computed-from-step-3"
if grep -q "## \[$NEXT\]" CHANGELOG.md 2>/dev/null; then
  echo "CHANGELOG_OK|Entry found"
  HAS_DATE=$(grep "## \[$NEXT\]" CHANGELOG.md | grep -c '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}')
  HAS_CATS=$(sed -n "/## \[$NEXT\]/,/## \[/p" CHANGELOG.md | grep -cE '### (Added|Changed|Fixed|Removed)')
  echo "DATE=$HAS_DATE CATEGORIES=$HAS_CATS"
elif grep -q "## \[Unreleased\]" CHANGELOG.md; then
  echo "CHANGELOG_WARN|Update [Unreleased] header before release"
else
  echo "CHANGELOG_FAIL|No entry for $NEXT"
fi
```

## Step 8: Breaking change detection

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  BREAKING=$(git log "$LAST_TAG"..HEAD --grep='BREAKING' --oneline 2>/dev/null)
  BREAKING_COUNT=$(echo "$BREAKING" | grep -c '.' || echo 0)
  if [ "$BREAKING_COUNT" -gt 0 ] && [ "$BUMP" != "major" ]; then
    echo "BREAK_WARN|$BREAKING_COUNT breaking changes but bump=$BUMP (should be major)"
  fi
fi
```

Also scan for: removed/renamed exports, changed schema required fields, renamed CLI flags.

## Step 9: Marketplace freshness

```bash
node scripts/generate-marketplace.js --dry-run 2>&1
# Compare generated output against committed marketplace.json
DIFF_LINES=$(diff <(cat marketplace.json) <(node scripts/generate-marketplace.js --stdout 2>/dev/null) 2>/dev/null | wc -l || echo 0)
[ "$DIFF_LINES" -gt 0 ] && echo "MARKET_STALE|Needs regeneration" || echo "MARKET_OK"
```

## Step 10: License compliance

```bash
ROOT_LICENSE=$(node -e "console.log(require('./package.json').license || 'MISSING')")
echo "License: $ROOT_LICENSE"
npm ls --prod --json 2>/dev/null | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const bad = ['GPL','AGPL','LGPL','SSPL'];
  function scan(deps, path) {
    Object.entries(deps || {}).forEach(([n, i]) => {
      const l = String(i.license || '');
      if (bad.some(b => l.toUpperCase().includes(b))) console.log('COPYLEFT|' + path + n + '|' + l);
      scan(i.dependencies, path + n + '/');
    });
  }
  scan(d.dependencies, '');
" 2>/dev/null || echo "LICENSE_SKIP|npm ls unavailable"
```

## Step 11: Package build verification

```bash
case "$TARGET" in
  mcp-server|all)
    cd mcp-server && npm ci --ignore-scripts && npm run build 2>&1
    echo "MCP_BUILD=$? SIZE=$(du -sk dist/ 2>/dev/null | awk '{print $1}')KB"
    cd .. ;;
  vscode-extension|all)
    cd vscode-extension && npm ci --ignore-scripts && npm run compile 2>&1
    echo "EXT_BUILD=$?"
    cd .. ;;
  python-sdk|all)
    cd python-sdk && python -m build --no-isolation 2>&1
    echo "SDK_BUILD=$?"
    cd .. ;;
esac
```

## Step 12: Rollback plan

Pre-generate rollback instructions included in the readiness report.

| Step | Action | Window |
|------|--------|--------|
| 1 | `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` | Anytime |
| 2 | `npm unpublish @FAI/mcp-server@X.Y.Z` | Within 72h |
| 3 | Republish previous version from CI artifacts | Anytime |

## Step 13: Generate readiness report

```markdown
# 🍊 Release Readiness — [Target] v[Next] — [Date]

## Pre-Flight Checks
| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | Version consistency | ✅/❌ | All packages at vX.Y.Z |
| 2 | Next version | ℹ️ | vX.Y.Z → vA.B.C |
| 3 | Primitive validation | ✅/❌ | X checks, 0 errors |
| 4 | Schema compliance | ✅/❌ | All schemas valid |
| 5 | Secrets scan | ✅/❌ | 0 secrets found |
| 6 | Changelog | ✅/❌ | Entry present |
| 7 | Breaking changes | ✅/⚠️ | N detected |
| 8 | Marketplace | ✅/❌ | Fresh / stale |
| 9 | License | ✅/❌ | MIT, no copyleft |
| 10 | Build | ✅/❌ | All targets clean |

## Package Details
| Package | Current | Next | Build | Size |
|---------|---------|------|-------|------|
| mcp-server | X.Y.Z | A.B.C | ✅ | XKB |
| python-sdk | X.Y.Z | A.B.C | ✅ | XKB |
| vscode-ext | X.Y.Z | A.B.C | ✅ | XKB |

## Release Commands
```bash
npm run release:dry         # Preview
npm run release             # Bump + sync + validate + commit + tag
git push origin main --tags # Trigger publish
```

## VERDICT
**✅ READY** — All 10 checks passed.
_OR_
**❌ BLOCKED** — X check(s) failed:
1. [Blocker + fix]

_Automated by FAI Release Readiness Workflow_
```

## Error handling

- `validate-consistency.js` failure: fall back to manual version comparison
- Missing package directory: skip checks, note absence
- `npm ci` failure: still report other checks
- No git tags: skip breaking change tag comparison
- Missing `CHANGELOG.md`: flag as blocker
- Dry-run mode: output report to stdout, no GitHub issue created
- Always generate report even if some checks cannot be run