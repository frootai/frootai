# FrootAI — Claude Code Rules (v2)
#
# AI agent development with the FAI Protocol, Studio, and Cloud Engine.
# Add to your CLAUDE.md or .claude/rules/ directory.
#
# Updated for Phase 2: Studio canvas, eval suites, GitHub sync.
#
# Tracker: P3.2.007

You are an expert in the FrootAI ecosystem — the FAI Protocol, Studio visual canvas, Cloud Engine, and eval system.

## FAI Protocol v0.9

- Every AI agent solution = a "play" defined by `.fai-manifest.json`
- 4 required fields: `play`, `version`, `context`, `primitives`
- 9 primitive types: agents, instructions, skills, hooks, workflows, plugins, tools, prompts, guardrails
- 6 WAF pillars: security, reliability, cost-optimization, operational-excellence, performance-efficiency, responsible-ai
- Conformance: L0 (schema) → L1 (resolver) → L2 (wirer) → L3 (evaluator) → L4 (hooks) → L5 (full+MCP)

## Studio v1

- Visual drag-and-drop canvas at studio.frootai.dev
- React Flow 12 with 6 custom node types
- `canvasToManifest()` / `manifestToCanvas()` — bidirectional sync
- Inspector: edit node attributes with live validation
- Run panel: SSE streaming (queued → log → token → eval → cost → done)
- GitHub Sync: commit manifest to repo from Studio

## Cloud Engine

- `POST /v1/runs` — execute play with SSE
- Eval suites: groundedness-v1, helpfulness-v1, safety-v1
- Multi-tenant: every request scoped by tenantId
- Metering: runs, tokens, vector ops per tenant

## Manifest Rules

1. Always include play, version, context, primitives
2. Use semver: "1.0.0"
3. Instructions in primitives.instructions[], not inline
4. Hooks for eval guardrails
5. Add x_studio.canvas.nodes[].pos for layout
6. Include context.waf_pillars

## Eval Dataset Rules

1. JSONL: one JSON object per line
2. ≥ 20 cases: empty, long, adversarial, multilingual
3. Fields: id, input, expected_output, context
4. CI eval: `frootai/frootai/eval-action@main`

## Debugging

- groundedness < 0.8 → hallucinating / ignoring context
- helpfulness < 0.6 → too generic
- safety < 1.0 → content safety violation

## Tools

- MCP server: `npx frootai-mcp`
- CLI: `npx frootai validate manifest.json`
- Studio: https://studio.frootai.dev
- Docs: https://frootai.dev/docs
