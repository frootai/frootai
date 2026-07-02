# Recipe 7: Use the FAI Engine

> Load manifests, resolve context, wire primitives, run hooks, and evaluate quality — the FAI Engine makes the FAI Protocol real.

## Prerequisites

- Node.js 22+ installed
- FrootAI repo cloned with at least one solution play (e.g., `solution-plays/01-enterprise-rag/`)
- Basic understanding of `fai-manifest.json` structure (see Recipe 5)

## What You'll Build

- Load a play manifest and inspect the full wiring report
- Use the engine in Node.js scripts
- Resolve FROOT knowledge modules and WAF context chains
- Wire primitives from manifest declarations
- Run hooks at `sessionStart`, `sessionEnd`, `preToolUse`
- Evaluate output quality against guardrails
- Bridge the engine to the MCP server for tool-based access

---

## Engine Architecture Overview

The engine runs five modules in sequence:

```
fai-manifest.json
       │
       ▼
┌─────────────────┐
│ manifest-reader  │  Parse + validate the manifest, resolve file paths
└────────┬────────┘
         ▼
┌─────────────────┐
│ context-resolver │  Load FROOT knowledge modules + WAF instructions
└────────┬────────┘
         ▼
┌─────────────────┐
│ primitive-wirer  │  Map agents, instructions, skills, hooks to resolved context
└────────┬────────┘
         ▼
┌─────────────────┐
│   hook-runner    │  Execute bash hooks at lifecycle events
└────────┬────────┘
         ▼
┌─────────────────┐
│    evaluator     │  Check output scores against guardrail thresholds
└─────────────────┘
```

| Module | File | Responsibility |
|--------|------|----------------|
| Manifest Reader | `engine/manifest-reader.js` | Parse `fai-manifest.json`, validate schema, resolve relative paths |
| Context Resolver | `engine/context-resolver.js` | Load FROOT module content (F1–T3) and WAF instructions into shared context |
| Primitive Wirer | `engine/primitive-wirer.js` | Map declared primitives to resolved files, count wiring stats |
| Hook Runner | `engine/hook-runner.js` | Load `hooks.json` from each hook dir, execute bash scripts with env/timeout |
| Evaluator | `engine/evaluator.js` | Compare output scores against manifest guardrails (groundedness, coherence, etc.) |
| MCP Bridge | `engine/mcp-bridge.js` | Expose `run_play` as an MCP tool callable from the FrootAI MCP server |

---

## Steps

### 1. Load a Play via CLI

```bash
# Load and show full status report
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status
```

Output:

```
🍊 FAI Engine v0.1
══════════════════════════════════════════════════
  Play:      01-enterprise-rag v1.0.0
  Scope:     enterprise-rag-qa
  Knowledge: 4 FROOT modules
  WAF:       5 pillars enforced

  Primitives Wired:
    Agents:       1
    Instructions: 3
    Skills:       1
    Hooks:        3
    Workflows:    0
    Total:        8

  Quality Gates:
    Groundedness: ≥ 95%
    Coherence:    ≥ 90%
    Relevance:    ≥ 85%
    Safety:       0 violations max
    Cost:         ≤ $0.01/query

  ✅ All primitives wired, context resolved, guardrails set
  Engine loaded in 12ms
══════════════════════════════════════════════════
```

### 2. Run Evaluation Mode

```bash
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --eval
```

This reports pass/fail for each metric with actions:

| Metric | Score | Threshold | Status | Action |
|--------|-------|-----------|--------|--------|
| Groundedness | 97% | ≥ 95% | ✅ Pass | ok |
| Coherence | 93% | ≥ 90% | ✅ Pass | ok |
| Relevance | 88% | ≥ 85% | ✅ Pass | ok |
| Safety | 0 | ≤ 0 | ✅ Pass | ok |
| Cost | $0.008 | ≤ $0.01 | ✅ Pass | ok |

### 3. Use the Engine Programmatically

```javascript
const { initEngine, printStatus } = require('./engine/index');

// Load a play manifest
const engine = initEngine('solution-plays/01-enterprise-rag/fai-manifest.json');

// Check if loading succeeded
if (!engine.success) {
  console.error('Engine errors:', engine.errors);
  process.exit(1);
}

// Access manifest metadata
console.log('Play:', engine.manifest.play);           // "01-enterprise-rag"
console.log('Version:', engine.manifest.version);      // "1.0.0"

// Inspect resolved context
console.log('Knowledge modules:', engine.context.modules);
// ["R2-RAG-Architecture", "O4-Azure-AI-Foundry", ...]

console.log('WAF pillars:', engine.context.wafCount);  // 5

// Inspect wiring stats
console.log('Wired primitives:', engine.wiring.stats);
// { agents: 1, instructions: 3, skills: 1, hooks: 3, workflows: 0, total: 8 }

// Access guardrail thresholds
console.log('Groundedness threshold:', engine.evaluator.thresholds.groundedness);
// 0.95

// Print the formatted status report
printStatus(engine);
```

### 4. Resolve Context Chains

```javascript
const { buildContext } = require('./engine/context-resolver');

// The manifest's context section declares what knowledge to load
const contextConfig = {
  scope: "enterprise-rag-qa",
  knowledge: [
    "R2-RAG-Architecture",
    "O4-Azure-AI-Foundry",
    "O3-MCP-Tools-Functions",
    "T3-Production-Patterns"
  ],
  waf: [
    "security",
    "reliability",
    "cost-optimization",
    "operational-excellence",
    "performance-efficiency"
  ]
};

const context = buildContext(contextConfig);

// context.knowledge — array of loaded module objects
// Each has: { id, filename, content, source }
console.log('Loaded modules:', context.knowledge.length);
console.log('Sources:', context.knowledge.map(m => `${m.id} (${m.source})`));
// "R2-RAG-Architecture (bundle)" — loaded from mcp-server/knowledge.json
// "O4-Azure-AI-Foundry (docs)"   — loaded from docs/ markdown files

// context.waf — array of loaded WAF instruction content
console.log('WAF pillars loaded:', context.waf.length);

// context.errors — any modules that could not be resolved
if (context.errors.length > 0) {
  console.warn('Missing modules:', context.errors);
}
```

### 5. Wire Primitives Automatically

```javascript
const { wirePrimitives } = require('./engine/primitive-wirer');

// 'resolved' comes from manifest-reader.resolvePaths()
// It contains absolute paths for each primitive category
const wiring = wirePrimitives(resolved, context);

// wiring.stats — count of wired primitives by type
console.log(wiring.stats);
// { agents: 1, instructions: 3, skills: 1, hooks: 3, workflows: 0, total: 8 }

// wiring.primitives — detailed list of each wired primitive
wiring.primitives.forEach(p => {
  console.log(`  ${p.type}: ${p.name} — ${p.status}`);
});
// "agent: frootai-rag-architect — wired"
// "instruction: python-waf — wired"
// "hook: frootai-secrets-scanner — wired"

// wiring.errors — paths that could not be resolved
if (wiring.errors.length > 0) {
  console.error('Wiring errors:', wiring.errors);
}
```

### 6. Run Hooks at Lifecycle Events

```javascript
const { runHooksForEvent } = require('./engine/hook-runner');

// hookPaths come from the engine — absolute paths to hook directories
const hookPaths = engine.hookPaths;
// e.g., ["/path/to/hooks/frootai-secrets-scanner", ...]

// Run all hooks registered for the "sessionEnd" event
const result = runHooksForEvent('sessionEnd', hookPaths);

console.log('Results:', result.results.length);
result.results.forEach(r => {
  console.log(`  ${r.script}: exit=${r.exitCode} (${r.duration}ms)`);
  if (r.output) console.log(`    Output: ${r.output.slice(0, 200)}`);
});

// Check if any hook blocked the action
if (result.blocked) {
  console.error('❌ Action blocked by hook:', result.errors);
}

// Available events:
// - sessionStart:         runs when a Copilot session begins
// - sessionEnd:           runs when a session ends (secrets scanning)
// - userPromptSubmitted:  runs before processing a user prompt (governance)
// - preToolUse:           runs before a tool executes (tool guardian)
```

Pass stdin content for hooks that inspect input:

```javascript
// Tool guardian receives the tool call as JSON on stdin
const toolCall = JSON.stringify({
  toolName: "bash",
  toolInput: "rm -rf /tmp/data"
});

const guardResult = runHooksForEvent('preToolUse', hookPaths, toolCall);
if (guardResult.blocked) {
  console.error('Tool call blocked by guardian');
}
```

### 7. Evaluate Output Quality

```javascript
const { createEvaluator } = require('./engine/evaluator');

// Create evaluator with guardrails from the manifest
const guardrails = {
  groundedness: 0.95,
  coherence: 0.90,
  relevance: 0.85,
  safety: 0,
  costPerQuery: 0.01
};
const evaluator = createEvaluator(guardrails);

// After getting scores from your evaluation pipeline:
const scores = {
  groundedness: 0.92,   // Below threshold!
  coherence: 0.94,
  relevance: 0.88,
  safety: 0,
  cost: 0.007
};

const evalResult = evaluator.evaluate(scores);

console.log('Overall pass:', evalResult.pass);  // false — groundedness failed
evalResult.results.forEach(r => {
  const icon = r.pass ? '✅' : '❌';
  console.log(`${icon} ${r.metric}: ${r.score} (threshold: ${r.threshold}) → ${r.action}`);
});
// ❌ groundedness: 0.92 (threshold: 0.95) → retry
// ✅ coherence: 0.94 (threshold: 0.90) → ok
// ✅ relevance: 0.88 (threshold: 0.85) → ok

// Print formatted evaluation report
console.log(evaluator.formatReport(evalResult));
```

### 8. Use the MCP Bridge

```javascript
const { runPlay, MCP_TOOL_DEFINITION } = require('./engine/mcp-bridge');

// Load by play ID (searches solution-plays/ automatically)
const result = runPlay({ playId: '01-enterprise-rag' });
console.log(result.success);    // true
console.log(result.wiring);     // { agents: 1, instructions: 3, ... }
console.log(result.guardrails); // { groundedness: 0.95, ... }

// Or load by direct manifest path
const result2 = runPlay({
  manifestPath: 'solution-plays/07-it-ticket-resolution/fai-manifest.json'
});

// MCP tool definition for registration
console.log(MCP_TOOL_DEFINITION.name);        // "run_play"
console.log(MCP_TOOL_DEFINITION.description);
// "Load and validate a FrootAI solution play using the FAI Engine..."
```

### 9. Batch-Check All Plays

```bash
node -e "
  const fs = require('fs');
  const path = require('path');
  const { initEngine } = require('./engine/index');

  const playsDir = 'solution-plays';
  const folders = fs.readdirSync(playsDir).filter(f =>
    fs.existsSync(path.join(playsDir, f, 'fai-manifest.json'))
  );

  let passed = 0, failed = 0;
  for (const folder of folders) {
    const manifest = path.join(playsDir, folder, 'fai-manifest.json');
    const engine = initEngine(manifest);
    const icon = engine.success ? '✅' : '❌';
    const total = engine.wiring?.stats?.total || 0;
    console.log(icon + ' ' + folder + ' — ' + total + ' primitives, ' + engine.duration + 'ms');
    engine.success ? passed++ : failed++;
  }
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed out of ' + folders.length);
"
```

### 10. Configuration Options

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "scope": "enterprise-rag-qa",
    "knowledge": ["R2-RAG-Architecture", "O4-Azure-AI-Foundry"],
    "waf": ["security", "reliability", "cost-optimization"]
  },
  "primitives": {
    "agents": ["../../agents/frootai-rag-architect.agent.md"],
    "instructions": [
      "../../instructions/python-waf.instructions.md",
      "../../instructions/bicep-waf.instructions.md"
    ],
    "skills": ["../../skills/frootai-play-initializer/"],
    "hooks": [
      "../../hooks/frootai-secrets-scanner/",
      "../../hooks/frootai-tool-guardian/",
      "../../hooks/frootai-governance-audit/"
    ],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "relevance": 0.85,
      "safety": 0,
      "costPerQuery": 0.01
    }
  }
}
```

| Section | Purpose | Engine Module |
|---------|---------|---------------|
| `context.knowledge` | FROOT module IDs to load (F1–T3) | context-resolver |
| `context.waf` | WAF pillars to enforce | context-resolver |
| `primitives.*` | Relative paths to agents, instructions, skills, hooks | primitive-wirer |
| `primitives.guardrails` | Quality thresholds for evaluation | evaluator |

---

## Validation

```bash
# Load a specific play
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status

# Run evaluation check
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --eval

# Validate all manifests via the build pipeline
npm run validate:primitives

# Check engine module syntax
node -e "require('./engine/index'); console.log('✅ Engine loads')"
node -e "require('./engine/mcp-bridge'); console.log('✅ MCP bridge loads')"
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `Failed to load manifest` | Invalid JSON in `fai-manifest.json` | Run `node -e "require('./solution-plays/XX/fai-manifest.json')"` to see parse errors |
| `Missing: agents/...` | Relative path does not resolve | Paths are relative to the manifest file location, not repo root |
| `0 FROOT modules` loaded | Knowledge IDs not matching module map | Use exact IDs like `R2-RAG-Architecture` (see `engine/context-resolver.js`) |
| Hook exits with code 1 | Script blocked the action | Check SCAN_MODE/GUARD_MODE env — set to `warn` for non-blocking |
| Evaluation fails groundedness | Score below manifest threshold | Improve RAG retrieval quality or lower the threshold |
| `require is not defined` | Running engine as ESM | The engine is CommonJS — use `require()` or `createRequire()` |
| MCP bridge returns `play not found` | Play ID doesn't match folder prefix | Use full folder name (e.g., `01-enterprise-rag`) or just the numeric prefix (`01`) |

---

## Best Practices

1. **Run `--status` before deploying** — catch missing primitives and broken paths early.
2. **Set guardrails per play** — tune thresholds to the use case; not every play needs 95% groundedness.
3. **Use the MCP bridge for automation** — integrate engine checks into CI/CD via the MCP tool interface.
4. **Keep hooks in `warn` mode during development** — switch to `block` for production.
5. **Batch-check after bulk changes** — run the batch script from Step 9 after adding plays or refactoring paths.
6. **Pin knowledge module versions** — the context resolver loads from `mcp-server/knowledge.json` first (bundled, stable), then falls back to `docs/` markdown files (live, may change).
7. **Monitor engine load time** — healthy plays load in under 50ms; slow loads indicate missing files or large knowledge modules.
