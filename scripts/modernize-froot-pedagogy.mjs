#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');

const modules = {
  F1: {
    file: 'GenAI-Foundations.md',
    outcomes: [
      'Explain tokenization, attention, context windows, embeddings, and inference without relying on product marketing.',
      'Estimate the memory, latency, and cost consequences of model size, precision, and context length.',
      'Choose an appropriate quantization and serving approach for a stated workload.',
      'Communicate an LLM architecture decision to application and infrastructure teams.',
    ],
    prerequisites: 'No prior AI coursework. Familiarity with cloud compute, APIs, and basic probability is helpful.',
    scenario: 'Capacity-Plan an Internal LLM Endpoint',
    scenarioBody: [
      '**Situation:** A platform team must host a latency-sensitive internal assistant for 400 concurrent employees while keeping sensitive prompts inside an approved boundary.',
      '**Decisions to make:** Estimate prompt and output token budgets, select model size and precision, calculate VRAM headroom, and choose between managed inference and self-hosting.',
      '**Deliverable:** Produce a one-page architecture decision record containing assumptions, peak concurrency, failure fallback, and the measurements that would change the decision.',
      '**Validation:** Load-test representative prompts, measure time-to-first-token and tokens per second, and reject the design if memory saturation or queue time breaches the stated SLO.',
    ],
    checks: [
      ['Why does a longer context window increase both latency and memory pressure?', 'The model must process more input tokens during prefill, while the KV cache grows with retained context.'],
      ['When is quantization preferable to selecting a smaller model?', 'When the larger model provides required capability and measured quality remains acceptable after reducing precision.'],
      ['What must a capacity estimate include beyond parameter count?', 'Precision, KV-cache growth, batching, concurrency, framework overhead, and operational headroom.'],
    ],
  },
  F2: {
    file: 'LLM-Landscape.md',
    outcomes: [
      'Classify models by capability, licensing, deployment boundary, and operational profile.',
      'Interpret benchmark and model-card evidence without treating one score as a universal ranking.',
      'Build a repeatable shortlist from quality, latency, cost, residency, and support constraints.',
      'Separate direct-provider availability from Microsoft Foundry catalog availability.',
    ],
    prerequisites: 'Complete [F1: GenAI Foundations](./GenAI-Foundations.md), especially tokens, inference, and context windows.',
    scenario: 'Create a Model Shortlist with Explicit Gates',
    scenarioBody: [
      '**Situation:** A regulated support workload needs multilingual classification, grounded answer generation, EU data residency, and a predictable monthly budget.',
      '**Method:** Apply hard gates before comparative scoring. Model names and availability remain inputs supplied by the current provider catalogs, not constants embedded in the decision logic.',
      '```python\nfrom dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Candidate:\n    name: str\n    quality: float\n    p95_latency_ms: int\n    cost_per_case: float\n    approved_regions: set[str]\n\ndef shortlist(models: list[Candidate], *, region: str, latency_slo_ms: int, budget: float):\n    eligible = [m for m in models if region in m.approved_regions]\n    eligible = [m for m in eligible if m.p95_latency_ms <= latency_slo_ms]\n    eligible = [m for m in eligible if m.cost_per_case <= budget]\n    return sorted(eligible, key=lambda m: (-m.quality, m.cost_per_case))\n```',
      '**Validation:** Evaluate the shortlist on a versioned workload dataset and record the provider model ID, deployment region, evaluation date, and rollback candidate.',
    ],
    checks: [
      ['Why should a benchmark not be used as the only model-selection signal?', 'Benchmark tasks may not represent the workload, deployment constraints, safety profile, latency, or total cost.'],
      ['What is the first distinction to make for an open-weight model?', 'Whether its license, weights, deployment tooling, and support model satisfy the intended commercial and operational use.'],
      ['Why must Foundry availability be checked independently?', 'A model announced by a provider may not be available in the required Foundry region, quota, or deployment type.'],
    ],
  },
  F4: {
    file: 'F4-GitHub-Agentic-OS.md',
    outcomes: [
      'Distinguish instructions, prompts, agents, skills, hooks, workflows, and plugins by ownership and lifecycle.',
      'Select the smallest GitHub customization primitive that satisfies a requirement.',
      'Wire reusable primitives through a manifest without duplicating source guidance.',
      'Review an agentic repository for scope, trust, and maintenance risks.',
    ],
    prerequisites: 'Complete [F1: GenAI Foundations](./GenAI-Foundations.md) and understand GitHub repositories, Markdown, and Actions workflows.',
    scenario: 'Compose a Governed Repository Assistant',
    scenarioBody: [
      '**Situation:** A team wants Copilot to apply architecture rules, invoke a repeatable review capability, and run deterministic checks before merge.',
      '**Composition:** Put durable rules in scoped instructions, package the review method as a skill, use an agent only when tool choice or orchestration is required, and keep deterministic enforcement in hooks or workflows.',
      '**Review gate:** Every primitive must declare a narrow purpose, source owner, applicable paths, required tools, and a failure mode that does not silently bypass governance.',
      '**Validation:** Test one matching file, one non-matching file, one denied tool call, and one workflow failure before distributing the package.',
    ],
    checks: [
      ['When should guidance be an instruction instead of an agent?', 'When it is durable contextual policy and does not require autonomous tool choice or orchestration.'],
      ['What belongs in a deterministic workflow rather than a prompt?', 'Checks whose pass/fail result must be reproducible, auditable, and independent of model variability.'],
      ['Why should primitives reference canonical knowledge instead of copying it?', 'References preserve one source of truth and prevent duplicated guidance from drifting.'],
    ],
  },
  R1: {
    file: 'Prompt-Engineering.md',
    outcomes: [
      'Design prompts with explicit role, context, constraints, task, and output contract.',
      'Choose prompting techniques based on measured task difficulty rather than fashion.',
      'Defend prompts against injection, ambiguous tool use, and uncontrolled context growth.',
      'Version and evaluate prompts as production artifacts.',
    ],
    prerequisites: 'Complete [F1: GenAI Foundations](./GenAI-Foundations.md). Basic experience calling a model API is recommended.',
    scenario: 'Release-Gate a Support Prompt',
    scenarioBody: [
      '**Situation:** A support prompt must answer from approved policy documents, abstain when evidence is missing, and return a stable JSON contract for downstream automation.',
      '**Design:** Separate system policy from retrieved evidence, delimit untrusted content, define an abstention path, and validate output with a schema rather than prose instructions alone.',
      '**Evaluation:** Use a versioned set containing answerable, unanswerable, adversarial, multilingual, and long-context cases. Compare groundedness, schema validity, refusal correctness, latency, and cost.',
      '**Release decision:** Promote only when the candidate improves the target metrics without regressing safety or contract validity; retain the prior prompt for rollback.',
    ],
    checks: [
      ['Why should retrieved text be treated as untrusted input?', 'Documents can contain prompt injection or instructions that conflict with system policy.'],
      ['When is few-shot prompting useful?', 'When representative examples clarify a format, boundary, or decision rule that prose alone does not reliably convey.'],
      ['What makes a prompt production-ready?', 'Versioning, representative evaluation, observable metrics, explicit contracts, and a rollback path.'],
    ],
  },
  R2: {
    file: 'RAG-Architecture.md',
    outcomes: [
      'Design independent ingestion and query pipelines with an explicit indexed-data handoff.',
      'Choose chunking, retrieval, filtering, and reranking strategies from workload evidence.',
      'Evaluate retrieval and generation separately before optimizing end-to-end quality.',
      'Operate a RAG system with citations, access controls, freshness, and cost telemetry.',
    ],
    prerequisites: 'Complete [F1: GenAI Foundations](./GenAI-Foundations.md) and [R1: Prompt Engineering](./Prompt-Engineering.md).',
    scenario: 'Ship a Policy Knowledge Assistant',
    scenarioBody: [
      '**Situation:** Employees need cited answers from policy documents with document-level permissions and a four-hour freshness target.',
      '**Offline path:** Extract and normalize source documents, preserve ACL metadata, create versioned chunks and embeddings, then publish an index only after quality checks pass.',
      '**Online path:** Rewrite the query only when necessary, apply identity filters before retrieval, combine lexical and vector candidates, rerank, assemble bounded context, and require citations.',
      '**Validation:** Measure retrieval recall and precision first, then groundedness and citation correctness. Test revoked access, deleted documents, stale indexes, and empty retrieval results.',
    ],
    checks: [
      ['Why should retrieval be evaluated independently from generation?', 'A fluent answer can hide poor retrieval; separate metrics identify whether the defect is search or generation.'],
      ['Where must authorization filters be applied?', 'Before or during retrieval, so unauthorized content never enters model context.'],
      ['When does reranking add the most value?', 'When broad first-stage retrieval has reasonable recall but ordering lacks semantic precision.'],
    ],
  },
  R3: {
    file: 'R3-Deterministic-AI.md',
    outcomes: [
      'Identify where probabilistic behavior is acceptable and where deterministic controls are mandatory.',
      'Use schemas, validators, grounding, and abstention to constrain model outputs.',
      'Design layered reliability controls instead of relying on temperature alone.',
      'Define measurable failure handling for AI-assisted business processes.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [R1](./Prompt-Engineering.md), and [R2](./RAG-Architecture.md).',
    scenario: 'Extract Auditable Invoice Decisions',
    scenarioBody: [
      '**Situation:** An intake service extracts invoice fields and recommends routing, but payment release must remain deterministic and auditable.',
      '**Boundary:** Use the model for extraction and classification; validate fields against a schema and source evidence; use deterministic policy code for approval thresholds and payment actions.',
      '**Failure handling:** Reject malformed outputs, abstain when confidence or evidence is insufficient, preserve the source span for every field, and route exceptions to human review.',
      '**Validation:** Replay a fixed corpus containing missing fields, conflicting totals, prompt injection, duplicate invoices, and unsupported currencies.',
    ],
    checks: [
      ['Why is temperature zero not a complete determinism guarantee?', 'Infrastructure, model versions, tokenization, and service implementations can still change outputs.'],
      ['Which actions should remain outside model control?', 'Irreversible or regulated decisions that require reproducible policy, authorization, and auditability.'],
      ['What is the role of abstention?', 'It converts unsupported certainty into an explicit, testable failure path.'],
    ],
  },
  O1: {
    file: 'Semantic-Kernel.md',
    outcomes: [
      'Explain the current role of Semantic Kernel relative to Microsoft Agent Framework.',
      'Compose prompts, native functions, filters, and telemetry through a kernel boundary.',
      'Design plugin contracts that are narrow, authorized, and testable.',
      'Choose a migration path without discarding stable Semantic Kernel investments.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md) and [R1](./Prompt-Engineering.md); Python or C# familiarity is recommended.',
    scenario: 'Expose a Governed Customer Plugin',
    scenarioBody: [
      '**Situation:** An assistant may look up a customer and draft an invoice email, but sending requires policy checks and approval.',
      '**Design:** Separate read and write functions, define typed parameters, resolve identity server-side, add invocation filters, and emit traces that exclude secrets and unnecessary personal data.',
      '**Migration decision:** Keep stable kernel plugins behind interfaces; introduce Agent Framework orchestration only where the workload needs agent lifecycle or multi-agent coordination.',
      '**Validation:** Test invalid identifiers, denied identities, duplicate requests, downstream timeouts, user cancellation, and approval rejection.',
    ],
    checks: [
      ['What makes a useful plugin function?', 'A narrow purpose, typed contract, explicit authorization, bounded side effects, and observable failures.'],
      ['Why should read and write tools be separate?', 'They carry different risk, consent, idempotency, and approval requirements.'],
      ['When is migration to Agent Framework justified?', 'When the application needs capabilities owned by the newer agent lifecycle, not merely because a newer SDK exists.'],
    ],
  },
  O2: {
    file: 'AI-Agents-Deep-Dive.md',
    outcomes: [
      'Design an agent loop with bounded planning, memory, tools, and termination.',
      'Select single-agent, handoff, supervisor, and multi-agent patterns from workload needs.',
      'Apply identity, consent, policy, and observability at every tool boundary.',
      'Evaluate task completion without confusing autonomy with reliability.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [R1](./Prompt-Engineering.md), and [O3](./O3-MCP-Tools-Functions.md).',
    scenario: 'Orchestrate a Bounded Incident-Response Agent',
    scenarioBody: [
      '**Situation:** An operations agent may inspect telemetry, propose remediation, and open a change request, but cannot execute production changes directly.',
      '**Pattern:** Use one supervisor with specialist read-only tools, a bounded step budget, durable incident state, explicit handoffs, and human approval before any write action.',
      '**Safety:** Treat tool output as untrusted, enforce identity outside prompts, redact traces, and require idempotency keys for ticket or change creation.',
      '**Validation:** Exercise incomplete telemetry, conflicting specialists, tool timeout, approval denial, repeated messages, and maximum-step termination.',
    ],
    checks: [
      ['What distinguishes an agent from a chatbot?', 'An agent selects and performs actions in a loop toward a goal, rather than only producing conversational text.'],
      ['When is a multi-agent design unjustified?', 'When one bounded agent with tools can complete the task with less coordination, latency, and failure surface.'],
      ['What must terminate every agent loop?', 'A success condition, explicit failure/abstention path, cancellation, and a maximum step or cost budget.'],
    ],
  },
  O3: {
    file: 'O3-MCP-Tools-Functions.md',
    outcomes: [
      'Distinguish local function calling, MCP, and A2A by ownership and interoperability boundary.',
      'Design MCP tools with narrow schemas, meaningful errors, and least privilege.',
      'Protect tool execution from injection, confused-deputy, and excessive-agency risks.',
      'Validate protocol discovery, transport, authorization, and lifecycle behavior.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [R1](./Prompt-Engineering.md), and understand JSON Schema and HTTP security.',
    scenario: 'Publish a Read-Only Architecture Evidence Tool',
    scenarioBody: [
      '**Situation:** Agents need to retrieve approved architecture evidence from a repository without receiving arbitrary filesystem access.',
      '**Contract:** Accept a repository-relative evidence identifier, validate it against an allowlist, return content plus provenance, and emit structured not-found, denied, and stale errors.',
      '**Security:** Authorize at execution time, separate discovery from permission, bound response size, and never allow model-provided paths to bypass canonical resolution.',
      '**Validation:** Run protocol initialization, schema validation, traversal attacks, denied resources, cancellation, timeout, and concurrent request tests.',
    ],
    checks: [
      ['When is MCP preferable to an application-local function?', 'When a capability needs a standard discovery and invocation contract across compatible clients.'],
      ['Does tool discovery grant permission?', 'No. Authorization must be enforced for the user, resource, and operation at execution time.'],
      ['Why are precise errors part of tool design?', 'They let the model and operator distinguish retryable failures, invalid input, denial, and unavailable evidence.'],
    ],
  },
  O4: {
    file: 'Azure-AI-Foundry.md',
    outcomes: [
      'Model Microsoft Foundry resources and projects as governance and application boundaries.',
      'Choose deployment, networking, identity, quota, and evaluation patterns from workload requirements.',
      'Separate current Foundry guidance from classic migration references.',
      'Create an evidence-backed production readiness decision for a Foundry workload.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [O2](./AI-Agents-Deep-Dive.md), and have basic Azure CLI and RBAC experience.',
    scenario: 'Approve a Foundry Project for Production',
    scenarioBody: [
      '**Situation:** A platform team must onboard a RAG agent with private data, separate application ownership, managed identity, and regional recovery requirements.',
      '**Discovery commands:** Inspect the target subscription instead of copying resource IDs, regions, or quotas from documentation.',
      '```bash\naz account show --query "{subscription:id, tenant:tenantId}" -o json\naz cognitiveservices account list --query "[].{name:name, kind:kind, location:location, id:id}" -o table\naz role assignment list --assignee "<managed-identity-object-id>" --all -o table\n```',
      '**Decision record:** Capture the parent Foundry resource, child project, identity assignments, private connectivity, model deployment name, quota evidence, evaluation baseline, telemetry destination, and rollback model.',
      '```json\n{\n  "projectBoundary": "one workload and owning team",\n  "identity": "managed identity; no embedded API keys",\n  "network": "private ingress and approved egress",\n  "releaseGates": ["evaluation baseline", "quota evidence", "rollback test"],\n  "liveChecks": ["model catalog", "target-region availability", "RBAC assignments"]\n}\n```',
      '**Validation:** Deny public access where required, prove least-privilege access, exercise quota exhaustion and regional fallback, and retain dated catalog evidence.',
    ],
    checks: [
      ['What boundary does a Foundry project represent?', 'An application/workload boundary under a parent Foundry resource, with ownership and isolation appropriate to the project.'],
      ['Why can documentation not guarantee model availability?', 'Availability depends on current region, subscription, quota, deployment type, and provider lifecycle.'],
      ['What makes a Foundry deployment production-ready?', 'Proven identity, network, quota, evaluation, observability, rollback, and operational ownership controls.'],
    ],
  },
  O5: {
    file: 'AI-Infrastructure.md',
    outcomes: [
      'Estimate GPU memory and throughput requirements from model and traffic characteristics.',
      'Choose managed endpoints, containers, VMs, or Kubernetes from operational constraints.',
      'Design scaling, availability, networking, storage, observability, and cost controls together.',
      'Verify SKU and regional assumptions against the target subscription before approval.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md) and [O4](./Azure-AI-Foundry.md); Kubernetes, networking, and Azure monitoring familiarity is recommended.',
    scenario: 'Right-Size a GPU Serving Platform',
    scenarioBody: [
      '**Situation:** A team must serve a quantized open-weight model with bursty traffic, a p95 latency SLO, and no tolerance for silent request loss.',
      '**Method:** Benchmark one replica, separate prefill and decode behavior, measure VRAM including KV cache, then size replicas from measured concurrency rather than theoretical FLOPS.',
      '```kusto\ncustomMetrics\n| where name in ("gpu_memory_utilization", "tokens_per_second", "queue_depth")\n| summarize p95=value_percentile(value, 95) by name, bin(timestamp, 5m)\n| order by timestamp asc\n```',
      '**Validation:** Test cold start, sustained load, burst load, replica loss, quota exhaustion, model reload, and regional failover. Recheck current SKU availability with `az vm list-skus` before design approval.',
    ],
    checks: [
      ['Why is parameter memory not the complete VRAM estimate?', 'KV cache, activations, runtime buffers, batching, and framework overhead also consume memory.'],
      ['What metric reveals insufficient serving capacity before outright failure?', 'Queue depth and queue delay rising under a stable arrival rate.'],
      ['Why must region and SKU claims be discovered live?', 'Capacity, quotas, and available VM families vary by subscription and change over time.'],
    ],
  },
  O6: {
    file: 'Copilot-Ecosystem.md',
    outcomes: [
      'Distinguish Microsoft 365 Copilot, Copilot Studio, GitHub Copilot, and custom extension boundaries.',
      'Choose grounding, actions, MCP, instructions, and agent customization appropriately.',
      'Evaluate licensing and quota information as dated commercial data, not architecture constants.',
      'Design a Copilot integration with identity, consent, data protection, and observable actions.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md) and [O2](./AI-Agents-Deep-Dive.md); understand Microsoft Entra identity and GitHub repositories.',
    scenario: 'Connect GitHub Copilot to Approved Architecture Knowledge',
    scenarioBody: [
      '**Situation:** Developers need repository guidance and read-only access to a governed architecture knowledge service.',
      '**Repository instruction:** Keep durable policy concise and link to canonical project documentation rather than copying entire standards.',
      '```markdown\n---\napplyTo: "infra/**/*.{bicep,tf}"\n---\nUse managed identity, private connectivity, and repository-approved modules.\nBefore recommending a SKU or model, request live region and quota evidence.\n```',
      '**MCP client configuration:** Keep credentials outside source control and use the client\'s supported environment or secret mechanism.',
      '```json\n{\n  "servers": {\n    "frootai": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "frootai-mcp@latest"]\n    }\n  }\n}\n```',
      '**Validation:** Confirm instruction scope, denied write operations, identity propagation, source citations, tool timeout behavior, and removal of sensitive values from logs.',
    ],
    checks: [
      ['Why should Copilot pricing not drive a durable architecture rule?', 'Plans, quotas, currencies, and commercial terms change independently of technical boundaries.'],
      ['What belongs in repository instructions?', 'Concise, durable, scoped guidance that should influence work on matching files.'],
      ['What must remain outside an MCP configuration committed to source?', 'Tokens, API keys, personal credentials, and environment-specific secrets.'],
    ],
  },
  T1: {
    file: 'T1-Fine-Tuning-MLOps.md',
    outcomes: [
      'Decide when prompting, RAG, fine-tuning, or a combination is justified.',
      'Prepare and govern training data with contamination, privacy, and representativeness controls.',
      'Compare full fine-tuning, LoRA, QLoRA, SFT, and preference optimization tradeoffs.',
      'Operate a reproducible evaluation, registration, deployment, and rollback lifecycle.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [F2](./LLM-Landscape.md), and understand Python ML workflows and evaluation datasets.',
    scenario: 'Approve a Domain Adaptation Experiment',
    scenarioBody: [
      '**Situation:** A legal drafting assistant has stable domain language requirements but must retain general reasoning and citation behavior.',
      '**Gate:** Establish a prompt-plus-RAG baseline first. Fine-tune only if a measured, persistent behavior gap remains and the training data can be governed.',
      '**Experiment:** Version the base model, dataset, adapter configuration, seed, evaluator, and environment. Compare the candidate with both the baseline and a stronger off-the-shelf model.',
      '**Validation:** Measure target behavior, general capability regression, memorization, privacy leakage, safety, latency, and cost. Register only artifacts that reproduce from recorded inputs.',
    ],
    checks: [
      ['What question should precede every fine-tuning project?', 'Whether prompting, retrieval, tooling, or a better base model can close the measured gap more simply.'],
      ['Why is a held-out dataset insufficient by itself?', 'Evaluation must also cover regressions, safety, privacy, memorization, and real operational constraints.'],
      ['What makes an adapter deployable?', 'Traceable base model and data, reproducible training, evaluation evidence, compatible serving, and rollback.'],
    ],
  },
  T2: {
    file: 'Responsible-AI-Safety.md',
    outcomes: [
      'Translate responsible-AI principles into technical controls and accountable owners.',
      'Threat-model data, model, prompt, tool, identity, and human interaction boundaries.',
      'Design evaluations for harmful content, bias, robustness, privacy, and excessive agency.',
      'Operate incident response, evidence retention, and regulatory review throughout the lifecycle.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md) and [O2](./AI-Agents-Deep-Dive.md); domain risk and privacy expertise should participate in the review.',
    scenario: 'Red-Team a Benefits Eligibility Assistant',
    scenarioBody: [
      '**Situation:** An assistant explains benefits policy and gathers information but must not make final eligibility decisions.',
      '**Threats:** Test protected-class proxies, inaccessible language, prompt injection, policy conflicts, privacy leakage, unsafe tool calls, fabricated citations, and automation bias.',
      '**Controls:** Ground explanations in approved policy, separate advice from deterministic eligibility rules, require human review, log evidence and decisions, and provide contestability.',
      '**Validation:** Use representative and adversarial cohorts, publish residual risk, assign incident owners, and repeat evaluation after model, prompt, data, or tool changes.',
    ],
    checks: [
      ['Why can a content filter not provide complete AI safety?', 'It addresses only some harmful content, not bias, privacy, grounding, authorization, agency, or process accountability.'],
      ['What is automation bias?', 'The tendency for people to over-trust automated recommendations even when evidence is weak or conflicting.'],
      ['When must risk evaluation repeat?', 'Whenever models, prompts, data, tools, policies, deployment context, or affected populations materially change.'],
    ],
  },
  T3: {
    file: 'T3-Production-Patterns.md',
    outcomes: [
      'Choose production hosting, gateway, routing, caching, and resilience patterns from explicit SLOs.',
      'Instrument model, retrieval, tool, safety, cost, and business outcome telemetry.',
      'Design graceful degradation and rollback for provider, region, quota, and model failures.',
      'Complete a production readiness review with accountable operational ownership.',
    ],
    prerequisites: 'Complete [O2](./AI-Agents-Deep-Dive.md), [O4](./Azure-AI-Foundry.md), and [O5](./AI-Infrastructure.md).',
    scenario: 'Operate a Cost-Aware Model Router',
    scenarioBody: [
      '**Situation:** A shared API serves extraction, chat, and complex reasoning with different latency and quality requirements.',
      '**Routing policy:** Use deterministic task metadata and measured evaluation bands. Never route solely from a model-generated self-assessment.',
      '```python\ndef route(request):\n    if request.contract == "strict-json" and request.complexity == "low":\n        return "economy-deployment"\n    if request.deadline_ms < 1500:\n        return "low-latency-deployment"\n    if request.requires_deep_reasoning:\n        return "reasoning-deployment"\n    return "standard-deployment"\n```',
      '**Validation:** Shadow traffic before promotion, compare quality by task class, enforce spend and latency budgets, test every fallback, and record the deployment IDs used for each decision.',
    ],
    checks: [
      ['Why should routing use task classes rather than a universal best model?', 'Different tasks have different quality, latency, contract, safety, and cost requirements.'],
      ['What must happen when the preferred deployment is unavailable?', 'A tested fallback, explicit degradation, or fail-closed response must preserve the workload contract.'],
      ['Which telemetry is required to tune a router?', 'Per-route quality, latency, errors, fallbacks, token use, cost, and business outcome.'],
    ],
  },
  'S-10': {
    file: 'V1-Voice-Speech-AI.md',
    outcomes: [
      'Budget end-to-end conversational latency across turn detection, STT, model, and TTS stages.',
      'Design streaming, barge-in, silence, retry, and human-handoff behavior.',
      'Protect voice biometrics, recordings, transcripts, identity, and telephony actions.',
      'Operate voice quality with measurable latency, recognition, containment, and escalation outcomes.',
    ],
    prerequisites: 'Complete [F1](./GenAI-Foundations.md), [R1](./Prompt-Engineering.md), [O2](./AI-Agents-Deep-Dive.md), and [O5](./AI-Infrastructure.md).',
    scenario: 'Launch a Real-Time Call-Center Agent',
    scenarioBody: [
      '**Situation:** A voice agent handles tier-one support, can read account status, and must transfer sensitive or unsupported cases to a human.',
      '**Latency budget:** Allocate measurable budgets to end-of-utterance detection, streaming STT, retrieval/tool calls, first model token, and first synthesized audio. Treat 800 ms as a design target, not a provider SLA.',
      '**Safety:** Announce automation, capture consent where required, minimize recordings, protect transcripts, authenticate before account actions, and preserve immediate human escalation.',
      '**Validation:** Test accents, noise, silence, interruption, packet loss, repeated transfers, denied identity, tool timeout, sensitive-topic escalation, and regional service failure.',
    ],
    checks: [
      ['Why is streaming architectural rather than cosmetic for voice?', 'Recognition, generation, and synthesis must overlap to keep turn latency conversational.'],
      ['What should happen when the user interrupts?', 'Stop or duck synthesis, preserve confirmed context, and prioritize the new utterance without duplicating actions.'],
      ['Why is an 800 ms target not an SLA?', 'End-to-end latency depends on application logic, networks, models, tools, and turn detection beyond any one service guarantee.'],
    ],
  },
};

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function insertAfterToc(content, block, eol) {
  const toc = content.indexOf('## Table of Contents');
  const divider = content.indexOf(`${eol}---`, toc === -1 ? 0 : toc);
  if (divider === -1) throw new Error('Module opening divider not found');
  const position = divider + eol.length + 3;
  return `${content.slice(0, position)}${eol}${eol}${block}${content.slice(position)}`;
}

function updateToc(content, entry, eol) {
  const tocStart = content.indexOf('## Table of Contents');
  if (tocStart === -1) return content;
  const tocEnd = content.indexOf(`${eol}---`, tocStart);
  const toc = content.slice(tocStart, tocEnd);
  if (toc.includes(entry)) return content;
  const keyTakeaways = '- [Key Takeaways](#key-takeaways)';
  const updated = toc.includes(keyTakeaways)
    ? toc.replace(keyTakeaways, `${entry}${eol}${keyTakeaways}`)
    : `${toc.trimEnd()}${eol}${entry}${eol}`;
  return `${content.slice(0, tocStart)}${updated}${content.slice(tocEnd)}`;
}

function renderIntro(id, item, eol) {
  return [
    `<!-- FROOT-PEDAGOGY:${id}:INTRO -->`,
    '## Learning Outcomes',
    '',
    'After completing this module, you can:',
    '',
    ...item.outcomes.map((outcome) => `- ${outcome}`),
    '',
    '## Prerequisites',
    '',
    `**Prerequisites:** ${item.prerequisites}`,
  ].join(eol);
}

function renderScenario(id, item, eol) {
  return [
    `<!-- FROOT-PEDAGOGY:${id}:SCENARIO -->`,
    `## Applied Scenario: ${item.scenario}`,
    '',
    ...item.scenarioBody.flatMap((part) => [part, '']),
  ].join(eol).trimEnd();
}

function renderChecks(id, item, eol) {
  const lines = [`<!-- FROOT-PEDAGOGY:${id}:CHECK -->`, '## Knowledge Check', ''];
  item.checks.forEach(([question, answer], index) => {
    lines.push(`### ${index + 1}. ${question}`, '', '<details>', '<summary>Expected evidence</summary>', '', answer, '', '</details>', '');
  });
  return lines.join(eol).trimEnd();
}

let changed = 0;
for (const [id, item] of Object.entries(modules)) {
  const filePath = path.join(DOCS, item.file);
  let content = fs.readFileSync(filePath, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  if (content.includes(`FROOT-PEDAGOGY:${id}:INTRO`)) continue;

  content = updateToc(content, '- [Learning Outcomes](#learning-outcomes)', eol);
  content = updateToc(content, '- [Prerequisites](#prerequisites)', eol);
  content = updateToc(content, `- [Applied Scenario: ${item.scenario}](#applied-scenario-${slug(item.scenario)})`, eol);
  content = updateToc(content, '- [Knowledge Check](#knowledge-check)', eol);
  content = insertAfterToc(content, renderIntro(id, item, eol), eol);

  const keyTakeaways = `${eol}## Key Takeaways`;
  const keyPosition = content.lastIndexOf(keyTakeaways);
  if (keyPosition === -1) throw new Error(`${item.file}: Key Takeaways not found`);
  content = `${content.slice(0, keyPosition)}${eol}${eol}${renderScenario(id, item, eol)}${content.slice(keyPosition)}`;
  content = `${content.trimEnd()}${eol}${eol}---${eol}${eol}${renderChecks(id, item, eol)}${eol}`;
  fs.writeFileSync(filePath, content, 'utf8');
  changed++;
}

console.log(`Modernized pedagogy in ${changed} FROOT module(s).`);