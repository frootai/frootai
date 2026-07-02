# Recipe 13: Build an Agentic Loop (Ralph Loop Pattern)

> Autonomous task loop: fresh context each iteration, disk-backed state, validation backpressure.

## What Is the Ralph Loop?

The Ralph Loop is an **autonomous task execution pattern** where an AI agent reads a plan from disk, executes one task per fresh context, marks it complete, validates as backpressure, and repeats until all tasks are done.

Like the FAI Layer pattern: fresh context per primitive, shared state via play artifacts.

```
┌─────────────────────────────────┐
│ IMPLEMENTATION_PLAN.md (on disk)│
│ ⬜ Task 1: Scaffold structure   │
│ ⬜ Task 2: Create agent         │
│ ⬜ Task 3: Write tests          │
│ ⬜ Task 4: Deploy               │
└──────────┬──────────────────────┘
           │
    ┌──────▼──────┐
    │  Iteration 1 │ ← Fresh context, reads plan
    │  Execute T1   │
    │  Mark ✅      │
    │  Run tests   │ ← Backpressure (must pass)
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Iteration 2 │ ← Fresh context, reads plan
    │  Execute T2   │
    │  Mark ✅      │
    │  Run tests   │
    └──────┬──────┘
           │
          ...
```

## Prerequisites

- `FrootAI` repo cloned
- Node.js 22+
- FAI Engine familiarity

## Steps

### 1. Create the implementation plan

The plan file is shared state across iterations:

```bash
cat > spec/implementation-plan.md << 'EOF'
# Implementation Plan

## Tasks

- [ ] Task 1: Create the project structure with fai-manifest.json
- [ ] Task 2: Build the RAG ingestion pipeline
- [ ] Task 3: Create the retrieval API endpoint
- [ ] Task 4: Add evaluation pipeline
- [ ] Task 5: Write integration tests
- [ ] Task 6: Deploy to Azure Container Apps

## Context
- Play: 01-enterprise-rag
- Stack: Python + FastAPI + Azure AI Search
- WAF pillars: Security, Reliability, Cost

## Completion Criteria
- All tasks checked ✅
- `npm run validate:primitives` exits 0
- All tests pass
EOF
```

### 2. Create the loop runner

```javascript
// scripts/agentic-loop.js
const fs = require('fs');
const { execSync } = require('child_process');

const PLAN_FILE = process.argv[2] || 'spec/implementation-plan.md';
const MAX_ITERATIONS = 20;
const VALIDATION_CMD = 'node scripts/validate-primitives.js';

function readPlan() {
  return fs.readFileSync(PLAN_FILE, 'utf8');
}

function getNextTask(plan) {
  const lines = plan.split('\n');
  for (const line of lines) {
    if (line.match(/^- \[ \] /)) {
      return line.replace('- [ ] ', '').trim();
    }
  }
  return null; // All done
}

function markTaskDone(task) {
  const plan = readPlan();
  const updated = plan.replace(`- [ ] ${task}`, `- [x] ${task}`);
  fs.writeFileSync(PLAN_FILE, updated);
}

function runValidation() {
  try {
    execSync(VALIDATION_CMD, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

// Main loop
for (let i = 0; i < MAX_ITERATIONS; i++) {
  const plan = readPlan();
  const task = getNextTask(plan);

  if (!task) {
    console.log('✅ All tasks complete!');
    break;
  }

  console.log(`\n🔄 Iteration ${i + 1}: ${task}`);
  console.log('─'.repeat(50));

  // Here you would invoke Copilot/agent with:
  // 1. The plan as system context
  // 2. The specific task as the prompt
  // 3. Fresh session (no prior context pollution)

  // After agent executes:
  markTaskDone(task);

  // Backpressure: validation must pass
  if (!runValidation()) {
    console.log('❌ Validation failed — stopping loop');
    break;
  }

  console.log(`✅ Task complete: ${task}`);
}
```

### 3. Integrate with the FAI Engine

Use the FAI Engine as the per-iteration context loader:

```javascript
// Load play context at the start of each iteration
const engine = require('./engine');
const manifest = engine.loadManifest('solution-plays/01-enterprise-rag/fai-manifest.json');

// Context for the agent includes:
// - FROOT knowledge modules (from manifest.context.knowledge)
// - WAF instructions (from manifest.context.waf)
// - Current task from the plan
// - Previous iteration results (from disk)
```

### 4. Add evaluation as backpressure

Replace simple validation with FAI evaluation:

```javascript
function runEvaluation(playId) {
  try {
    const result = execSync(
      `node engine/index.js solution-plays/${playId}/fai-manifest.json --eval`,
      { encoding: 'utf8' }
    );
    // Check all quality gates passed
    return result.includes('All') && result.includes('passed');
  } catch {
    return false;
  }
}
```

### 5. Disk-based state patterns

The plan file is the source of truth. State patterns:

| Pattern | File | Purpose |
|---------|------|---------|
| **Task tracking** | `spec/implementation-plan.md` | `- [ ]` → `- [x]` |
| **Iteration log** | `spec/iteration-log.jsonl` | Append-only log per iteration |
| **Artifacts** | `spec/artifacts/` | Generated files from each task |
| **Error log** | `spec/errors.md` | Failed tasks with error details |

### 6. Run the loop

```bash
node scripts/agentic-loop.js spec/implementation-plan.md
```

## Advanced: Multi-Agent Loop

Use different agents for different task types:

| Task Pattern | Agent | Expertise |
|-------------|-------|-----------|
| "Create structure" | `frootai-architect` | Architecture, scaffolding |
| "Build pipeline" | `frootai-play-01-builder` | Play-specific implementation |
| "Write tests" | `frootai-test-generator` | Test generation |
| "Deploy" | `frootai-devops-expert` | Infrastructure, deployment |
| "Evaluate" | `frootai-play-01-reviewer` | Quality review |

## Why Fresh Context Matters

Each iteration starts clean because:

1. **No hallucination accumulation** — prior mistakes don't pollute later tasks
2. **Token budget reset** — each task gets the full context window
3. **Parallel potential** — independent tasks can run simultaneously
4. **Reproducibility** — same plan + same task = same result

## Best Practices

1. **One task per iteration** — don't batch tasks
2. **Plan on disk, not in memory** — survives crashes and restarts
3. **Validation as backpressure** — never proceed if tests fail
4. **Log everything** — append to `iteration-log.jsonl` for debugging
5. **Set MAX_ITERATIONS** — prevent infinite loops
6. **Fresh context per iteration** — avoid context window pollution
