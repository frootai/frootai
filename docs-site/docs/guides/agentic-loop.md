---
sidebar_position: 10
title: Agentic Loop
description: Implement the autonomous agentic task loop — fresh context per iteration, disk-based state, evaluation backpressure.
---

# Agentic Loop (Ralph Loop Pattern)

Implement the autonomous task execution pattern where an AI agent reads a plan from disk, executes one task per iteration in a fresh context, and uses validation as backpressure.

## How It Works

```
┌────────────────────────────────┐
│ IMPLEMENTATION_PLAN.md (disk)  │
│ ⬜ Task 1: Scaffold structure  │
│ ⬜ Task 2: Create agent        │
│ ⬜ Task 3: Write tests         │
└──────────┬─────────────────────┘
           │
    ┌──────▼──────┐
    │ Iteration 1  │ ← Fresh context
    │ Execute T1   │
    │ Mark ✅       │
    │ Run tests    │ ← Backpressure
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │ Iteration 2  │ ← Fresh context
    │ Execute T2   │
    │ ...          │
    └─────────────┘
```

## Step 1: Create the Implementation Plan

The plan file is the shared state between iterations:

```markdown title="spec/implementation-plan.md"
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

## Completion Criteria
- All tasks checked ✅
- `npm run validate:primitives` exits 0
- All tests pass
```

## Step 2: Create the Loop Runner

```javascript title="scripts/agentic-loop.js"
const fs = require('fs');
const { execSync } = require('child_process');

const PLAN_FILE = process.argv[2] || 'spec/implementation-plan.md';
const MAX_ITERATIONS = 20;

function getNextTask(plan) {
  const lines = plan.split('\n');
  for (const line of lines) {
    if (line.match(/^- \[ \] /)) {
      return line.replace('- [ ] ', '').trim();
    }
  }
  return null;
}

function markTaskDone(task) {
  const plan = fs.readFileSync(PLAN_FILE, 'utf8');
  fs.writeFileSync(PLAN_FILE, plan.replace(`- [ ] ${task}`, `- [x] ${task}`));
}

function runValidation() {
  try {
    execSync('node scripts/validate-primitives.js', { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

for (let i = 0; i < MAX_ITERATIONS; i++) {
  const plan = fs.readFileSync(PLAN_FILE, 'utf8');
  const task = getNextTask(plan);

  if (!task) {
    console.log('✅ All tasks complete!');
    break;
  }

  console.log(`\n🔄 Iteration ${i + 1}: ${task}`);
  // Agent executes the task with fresh context
  markTaskDone(task);

  if (!runValidation()) {
    console.log('❌ Validation failed — stopping loop');
    break;
  }
}
```

## Step 3: Multi-Agent Routing

Assign different agents to different task types:

| Task Pattern | Agent | Expertise |
|-------------|-------|-----------|
| "Create structure" | `fai-architect` | Architecture, scaffolding |
| "Build pipeline" | `fai-play-01-builder` | Play-specific implementation |
| "Write tests" | `fai-test-generator` | Test generation |
| "Deploy" | `fai-devops-expert` | Infrastructure, deployment |
| "Evaluate" | `fai-play-01-reviewer` | Quality review |

## Step 4: Add Evaluation Backpressure

```javascript
function runEvaluation(playId) {
  try {
    const result = execSync(
      `node engine/index.js solution-plays/${playId}/fai-manifest.json --eval`,
      { encoding: 'utf8' }
    );
    return result.includes('passed');
  } catch {
    return false;
  }
}
```

## Why Fresh Context Matters

1. **No hallucination accumulation** — previous mistakes don't pollute future tasks
2. **Token budget reset** — each task gets the full context window
3. **Parallel potential** — independent tasks could run simultaneously
4. **Reproducibility** — same plan + same task = same result

## Disk-Based State Patterns

| Pattern | File | Purpose |
|---------|------|---------|
| Task tracking | `spec/implementation-plan.md` | `- [ ]` → `- [x]` |
| Iteration log | `spec/iteration-log.jsonl` | Append-only log |
| Artifacts | `spec/artifacts/` | Generated files |
| Error log | `spec/errors.md` | Failed tasks |

## Best Practices

1. **One task per iteration** — don't batch multiple tasks
2. **Plan on disk, not in memory** — survives crashes
3. **Validation as backpressure** — never proceed if tests fail
4. **Log everything** — append to `iteration-log.jsonl`
5. **Set MAX_ITERATIONS** — prevent infinite loops
6. **Fresh context per iteration** — avoid context window pollution

## See Also

- [Evaluate a Play](/docs/guides/evaluate-play) — evaluation as backpressure
- [Agents Reference](/docs/primitives/agents) — multi-agent routing
