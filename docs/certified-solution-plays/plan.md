# Certified Solution Plays Program

## Goal

Turn the 101 Solution Plays from design blueprints into evidence-backed solution engineering contracts, certify five runnable flagship workloads first, and project one truthful maturity state into the website and VS Code.

## Flagship Cohort

| Play | Runtime outcome |
|---|---|
| `01-enterprise-rag` | Ingest fixture documents and answer with valid citations |
| `03-deterministic-agent` | Execute and replay schema-constrained decisions with canonical hashes |
| `06-document-intelligence` | Process fixture documents into typed fields with provenance |
| `07-multi-agent-service` | Route a task through bounded specialists with an execution trace |
| `33-voice-ai-agent` | Simulate a voice turn with interruption, escalation, and finalized transcript |

## Requirements

| ID | Requirement | Evidence |
|---|---|---|
| `REQ-CSP-001` | All 101 manifests load without crashes or unresolved declared paths. | Engine corpus audit |
| `REQ-CSP-002` | Readiness is derived from machine evidence, never editable catalog labels. | Certification schema and verifier |
| `REQ-CSP-003` | Each flagship starts locally without cloud credentials. | Offline endpoint smoke receipts |
| `REQ-CSP-004` | Each flagship has a production Azure adapter boundary and matching IaC declaration. | Runtime contract and architecture-to-IaC audit |
| `REQ-CSP-005` | Evaluation calls the running endpoint and fails closed on missing metrics or placeholder data. | Endpoint evaluation receipts |
| `REQ-CSP-006` | Website and VS Code consume the same certification projection. | Projection parity tests |
| `REQ-CSP-007` | Build, evaluate, what-if, deploy, and observe actions require contiguous valid evidence. | Lifecycle policy tests |
| `REQ-CSP-008` | Organization policy can constrain providers, models, regions, budgets, networking, and approvals. | Policy overlay tests |
| `REQ-CSP-009` | Generated files and evidence retain source, config, model, dataset, IaC, and commit hashes. | Signed evidence records |
| `REQ-CSP-010` | Localhost review exposes play maturity, run controls, evidence, architecture, costs, and guide without breaking existing routes. | Responsive browser tests |

## Execution DAG

1. **Truth foundation**
   - Repair engine path typing and all 101 manifests.
   - Add corpus audit for unresolved paths, context, placeholders, and command targets.
   - Replace catalog `Ready` claims with no certification until evidence exists.
2. **Certification foundation**
   - Add evidence schema, `flagship-v1` policy, verifier, publisher, audit, and canonical index.
   - Implement contiguous promotion: Designed -> Scaffold -> Build -> Evaluation -> Deploy -> Production Observed.
3. **Runnable framework**
   - Add shared TypeScript scenario kernel, HTTP lifecycle, deterministic offline adapters, endpoint evaluator, and test utilities.
   - Implement Play 03 as the first complete vertical slice.
4. **Flagship expansion**
   - Implement Plays 01, 06, 07, and 33 in that order.
   - Update runtime contract, architecture map, IaC, evaluation, and evidence together.
5. **Unified projection**
   - Generate website and extension catalogs from canonical certification index.
   - Gate build/install/deploy actions on current evidence.
6. **Enterprise lifecycle**
   - Add organization policy overlays and approval gates.
   - Add what-if, deployment receipt, telemetry, cost drift, expiration, and demotion.
7. **Release validation**
   - Run corpus, runtime, IaC, evaluation, projection, accessibility, and browser matrices.
   - Launch isolated localhost review; do not deploy without explicit approval.

## Quality Gates

- No stage passes from claimed or synthetic values.
- Missing, stale, invalid, unsigned, or non-contiguous evidence fails closed.
- Offline tests make unexpected outbound network access fail.
- A service in architecture must be provisioned, explicitly external, or explicitly mocked offline.
- Evaluation datasets contain no TODO ground truth and every required metric must be measured.
- Azure mutations require what-if evidence and human approval.

## Validation Commands

```powershell
npm run test:engine
npm run manifests:check
npm run certification:audit -- --profile flagship-v1
npm run runtime:test -- --profile offline
npm run certification:verify -- --through build
```

Website and extension projection gates are added in their isolated worktrees during the projection phase.
