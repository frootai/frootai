# FAI Protocol v1.0 RFC

> **Status:** OPEN (in-flight). Pre-flight seed published 2026-05-22 by founder.
> **Closes:** T+60 days after public launch (date to be locked when launch Wednesday is chosen).
> **Owner:** Founder (Pavleen Bali) until v1.0 GA. Co-owners post-GA per [GOVERNANCE.md](../GOVERNANCE.md).
> **Source-of-truth:** This file accumulates structured feedback during the 60-day window. Replaces ad-hoc Discussion threads as the single canonical place to track what changes from v0.9-rc1 → v1.0.
>
> **Linked artefacts:** [Spec v0.9-rc1](./README.md) · [VERSIONING.md](./VERSIONING.md) · [Conformance suite](../conformance/) · [Examples](./examples/)

---

## 0. Why this document exists

The FAI Protocol is feature-complete at **v0.9-rc1**. We promised a 60-day public RFC before declaring **v1.0 GA**.

This document is the **structured RFC workspace** — a single file where every external comment, every founder self-critique, every endorsement, and every triage decision is tracked. It exists so that anyone — founder, contributor, reviewer, future maintainer — can see at a glance:

1. What changed (or is proposed to change) between v0.9-rc1 → v1.0
2. Why each change was accepted, deferred, or rejected
3. What we promised NEVER changes (the backward-compat invariants)
4. Where v1.0 GA stands against its gating criteria

It is the operational counterpart of [VERSIONING.md §3](./VERSIONING.md#3-the-road-to-v10).

---

## 1. The v1.0 RFC contract

### 1.1 What this RFC covers

| In scope | Out of scope |
|---|---|
| Editorial fixes to the spec (typos, clarifications) | New primitive types beyond the current 9 (defer to v2 RFC) |
| Defining currently undefined behaviour (e.g., hook lifecycle event names, scope semantics) | Adding new WAF pillars beyond the canonical 6 (defer to v2) |
| Tightening loose specifications (e.g., multi-infra precedence) | Reorganising the manifest top-level keys (would be a v2 break) |
| Adding non-breaking optional fields to existing schemas | Changing the JSON Schema Draft version (Draft-07 is locked) |
| Extending the guardrails set via OPTIONAL extension mechanism | Replacing semver as the versioning model |
| Bumping the schema URI from unversioned → `/v1/` | Replacing MIT license |

### 1.2 The 60-day window — operational rhythm

```
Week 1-2      Open RFC + seed self-critique + invite endorsements
Week 3-4      Triage incoming comments daily; build draft v1.0 changelog
Week 5-6      Lock proposed changes; circulate "last call" for objections
Week 7-8      Final tweaks; cut v1.0 GA tag; ship
```

The founder commits to:

- Reading every comment within 48 hours
- Posting a triage verdict (must-fix / will-defer / won't-do) within 7 days
- Updating this document weekly with the running changelog
- Hosting one open office hour per week (timezone-rotating) for live discussion

### 1.3 Backward-compatibility invariants (G.002 sacred)

These are the things v1.0 PROMISES will NEVER change from v0.9-rc1, regardless of feedback. They are guaranteed by [G.002](../../../frootai-blueprint/MASTER-IMPLEMENTATION-TRACKER.md) and [VERSIONING.md §5](./VERSIONING.md#5-deprecation-policy):

1. **All four required manifest fields stay required** (`play`, `version`, `context`, `primitives`).
2. **The 9 primitive type names stay** (agents, instructions, skills, hooks, workflows, plugins, tools, prompts, guardrails) — even if their internal sub-fields gain optional extensions.
3. **The 6 WAF pillar enum values stay** (security, reliability, cost-optimization, operational-excellence, performance-efficiency, responsible-ai).
4. **The 16 canonical knowledge module IDs stay** (F1–F4, R1–R3, O1–O6, T1–T3).
5. **The 5 baseline guardrail metrics stay** (groundedness, coherence, relevance, safety, costPerQuery) at their current ranges.
6. **The `./` and `../../` path resolution semantics stay**.
7. **The unversioned schema URI stays accessible** for v0.9-rc1 plays *forever* (per VERSIONING §4 — v0.x line is frozen but never deleted).
8. **MIT license stays** for spec, schemas, engine, conformance, primitives, plays.

Any proposal that breaks one of these is **out of scope for v1.0** and gets deferred to a future v2 RFC.

---

## 2. Feedback channels (where comments are accepted)

| Channel | Use | Triage SLA |
|---|---|---|
| **GitHub Discussions** category `RFC: FAI Protocol v1.0` | Substantive proposals, counter-proposals, endorsements | 7 days |
| **GitHub Issues** with label `rfc-v1.0` | Specific spec defects, typos, broken examples | 3 days |
| **Public mailing list** (`frootai-spec@buttondown.com`) | High-signal discussion thread; cross-referenced with Discussions | 7 days |
| **Weekly office hour** | Live discussion (recorded + summarised back into this RFC) | Same-day notes |
| **Direct email** (`spec@frootai.dev`) | Confidential or pre-disclosure concerns only | 7 days |

**Anything else** (Twitter replies, LinkedIn DMs, casual Slack pings) is acknowledged but NOT tracked as RFC input. The author is asked to re-file via one of the channels above. This keeps the audit trail clean.

### 2.1 How to file a high-quality RFC comment

A useful comment on this RFC includes:

- **Specific section of the v0.9-rc1 spec** (e.g., "§3.4 Guardrails Section")
- **Concrete proposed change** (not "this is unclear" — "rename X to Y because Z")
- **Backward-compat assessment** (is this additive? breaking?)
- **Counter-examples or evidence** (real plays this affects)

The [self-critique below](#3-self-audited-concerns-internal-seed-2026-05-22) is the founder's worked example of this format.

---

## 3. Self-audited concerns (internal seed · 2026-05-22)

> The founder ran a full read-through of the v0.9-rc1 spec against the engine, conformance suite, and 10 example manifests. The following 14 items are genuine open questions or specification gaps. They are seeded here as the *first* RFC inputs, so the conversation has a substantive starting point rather than waiting for external comments.
>
> Each item carries an initial founder triage. External commenters MAY contest, refine, or escalate any of these.

### CONCERN-001 · Primitive count mismatch (CRITICAL)

- **Section:** §3.3 Primitives Section
- **Issue:** The spec lists 9 primitive type names in §2 Terminology and the wider product narrative (`agents, instructions, skills, hooks, workflows, plugins, tools, prompts, guardrails`). But §3.3 only documents **6** of them as manifest fields: `agents, instructions, skills, hooks, workflows, guardrails`. **`plugins`, `tools`, `prompts` are missing.** The manifest schema must allow them or the count is dishonest.
- **Backward-compat:** Adding these three keys as OPTIONAL string arrays is additive (safe).
- **Proposed v1.0 fix:** Add `plugins`, `tools`, `prompts` to the table in §3.3 with file-pattern conventions matching Appendix B. Update `fai-manifest.schema.json` to allow these as optional `string[]`. Update L0 conformance to recognise (but not require) them.
- **Founder triage:** MUST-FIX before v1.0 GA. This is a credibility issue, not a stylistic one.

### CONCERN-002 · Conformance level numbering mismatch (CRITICAL)

- **Section:** §9.1 Conformance Levels + `../conformance/` README + Master Tracker
- **Issue:** §9.1 defines **Level 1–5** (Parser / Resolver / Wirer / Evaluator / Full). But the conformance suite folder uses **L0–L5** (with L0 being parse-and-schema as the cheapest gate). The Master Implementation Tracker and the launch essay refer to "L0 conformance passing in 0.12s." The spec says there is no L0.
- **Backward-compat:** Renaming spec sections is a doc-only change, but renumbering is conceptually breaking.
- **Proposed v1.0 fix:** Renumber spec §9.1 to use **L0–L5** consistently (L0 = Schema-only / L1 = Resolver / L2 = Wirer / L3 = Evaluator / L4 = Hooks / L5 = Full + MCP). Update conformance suite README. Update launch essay.
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-003 · `scope` semantics undefined

- **Section:** §3.2 Context Section
- **Issue:** `context.scope` is listed as an optional field with description *"Scenario scope identifier for context isolation"*. But nowhere in §4 (Context Resolution) is "scope isolation" defined. Does scope partition the knowledge module cache? Affect concurrent play execution? Influence audit logging? Hand-wavy.
- **Backward-compat:** Defining behaviour for a field that currently does nothing is additive (engines that ignored it still pass; engines that implement it pass too).
- **Proposed v1.0 fix:** Add §4.4 "Scope Isolation" defining: (a) scope as a string identifier with `^[a-z0-9-]+$` pattern, (b) scope influences telemetry tagging and audit log keys but does NOT affect path resolution or knowledge content, (c) scope is opaque to the spec — runtimes MAY use it for cache partitioning but MUST NOT require it.
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-004 · Hook lifecycle events not enumerated

- **Section:** §3.3 (hooks row) + §9.2 (item 7) + Appendix B
- **Issue:** Hooks are "event-driven scripts triggered by lifecycle events." §9.2 mentions "SessionStart, Stop" parenthetically but there's no comprehensive list. Plugin authors cannot reliably target hook events without knowing the canonical list.
- **Backward-compat:** Adding the canonical event names is additive.
- **Proposed v1.0 fix:** Add §3.7 "Hook Lifecycle Events" with the canonical list: `SessionStart, SessionEnd, BeforePrimitiveLoad, AfterPrimitiveLoad, BeforeAgentInvoke, AfterAgentInvoke, BeforeGuardrailEval, AfterGuardrailEval, OnGuardrailViolation, OnError`. Conformant engines MUST support `SessionStart` and `SessionEnd` (L1); SHOULD support the rest (L4).
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-005 · Custom knowledge module registration unspecified

- **Section:** §4.1 Knowledge Module IDs
- **Issue:** "Engines MAY support additional custom module IDs prefixed with `X`." But there's no specification for WHERE the custom modules are defined, HOW the runtime discovers them, or what FORMAT the module content takes.
- **Backward-compat:** Defining a registry format is additive.
- **Proposed v1.0 fix:** Add §4.5 "Custom Knowledge Modules" defining: (a) custom modules live in `./knowledge/X*.md` (or configurable via `context.knowledgeRoot`), (b) each file starts with YAML frontmatter `id: X1-Name`, (c) runtime indexes the directory at load time, (d) ID conflicts (two files claiming the same `X*` ID) are errors.
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-006 · Multi-infrastructure precedence ambiguous

- **Section:** §3.5 Infrastructure Section
- **Issue:** *"A manifest MAY declare multiple infrastructure formats simultaneously, enabling multi-cloud deployment from a single play."* But if a manifest declares BOTH `bicep` and `terraform`, which one deploys? Is the runtime supposed to detect environment and pick? Run both? Error out?
- **Backward-compat:** Clarification is additive.
- **Proposed v1.0 fix:** Add §3.5.1 "Multi-Infrastructure Resolution": (a) the runtime treats each declared format as an INDEPENDENT, deployment-tool-specific entry point; (b) `azd up` reads `bicep`; `terraform apply` reads `terraform`; `docker compose up` reads `docker`; (c) no single command auto-picks — the deployment tool determines the format. Update §3.5 example to show the bicep-and-docker-coexist case explicitly.
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-007 · Guardrail extension mechanism missing

- **Section:** §3.4 Guardrails Section
- **Issue:** The 5 baseline guardrails (groundedness, coherence, relevance, safety, costPerQuery) are excellent for most plays. But real-world deployments need custom guardrails — latency p99, brand-voice compliance, hallucination rate, jailbreak detection. Currently no extension mechanism. Authors would have to fork the spec to add one.
- **Backward-compat:** Adding an optional `custom` sub-object is additive.
- **Proposed v1.0 fix:** Add §3.4.1 "Custom Guardrails": `guardrails.custom` is an optional `object` mapping `string → { threshold: number, comparator: "≥"|"≤"|"=", description: string }`. Engines MUST report unrecognised custom guardrails as "skipped" (not error). Document 3 worked examples (latency-p99, brand-voice, jailbreak-detection).
- **Founder triage:** MUST-FIX before v1.0 GA (this one is high-demand from enterprise).

### CONCERN-008 · Schema URI versioning during v0.x → v1.0 transition

- **Section:** §11 Versioning + VERSIONING.md §3
- **Issue:** Currently, both v0.1 Draft AND v0.9-rc1 share the same schema URI (`https://frootai.dev/schemas/fai-manifest.schema.json`). When v1.0 ships at `/v1/`, what happens to plays whose `$schema` points to the unversioned URI? Do they continue validating against the v0.9-rc1 schema (which becomes "v0.x frozen")? Are they auto-upgraded? Do they break?
- **Backward-compat:** This MUST be defined explicitly.
- **Proposed v1.0 fix:** Add VERSIONING.md §3.1 "URI Migration Behaviour": (a) the unversioned URI continues to serve the v0.9-rc1 schema *forever* (frozen artefact), (b) plays declaring the unversioned URI continue to validate against v0.9-rc1 indefinitely, (c) NEW plays SHOULD declare `/v1/` explicitly, (d) lint warning emitted by Studio + CLI when an unversioned `$schema` is detected (suggests upgrade but does not fail).
- **Founder triage:** MUST-FIX before v1.0 GA. Skipping this guarantees ecosystem churn pain.

### CONCERN-009 · MCP Bridge exposure surface unspecified

- **Section:** §8 Reference Implementation (mcp-bridge.js row)
- **Issue:** `mcp-bridge.js` "exposes manifest-wired primitives as MCP-compatible tools." But the spec doesn't define WHAT the MCP exposure looks like — tool naming convention, parameter mapping, schema generation. Implementers cannot build an alternative MCP bridge without reverse-engineering ours.
- **Backward-compat:** Specifying the surface is additive (current engine becomes the canonical implementation).
- **Proposed v1.0 fix:** Add §8.2 "MCP Bridge Specification": (a) each primitive becomes one MCP tool, (b) tool name = `fai.{playId}.{primitiveType}.{primitiveName}` (kebab-cased), (c) tool parameter schema is the primitive's frontmatter `input` schema if present, else `{ }`, (d) tool description is the primitive's frontmatter `description`. Pin to MCP protocol version it bridges to (currently 2024-11-05).
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-010 · Guardrail evaluation timing unspecified

- **Section:** §3.4 Guardrails + §9.2 (item 4)
- **Issue:** "After each agent response, evaluate the output against each declared guardrail threshold." But — synchronous, blocking the response stream? Async, post-hoc, for audit only? Streaming-aware (eval per chunk vs. on completion)? Different metrics naturally fit different timings.
- **Backward-compat:** Specifying default timing is additive (current engines that block are still conformant).
- **Proposed v1.0 fix:** Add §3.4.2 "Evaluation Timing": (a) default is POST-RESPONSE (sync, blocks delivery to caller), (b) engines MAY support `evaluation: "streaming" | "post-response" | "post-batch"` as an OPTIONAL per-guardrail attribute, (c) `safety` MUST be post-response or pre-stream; never post-batch (safety failures cannot be retroactive).
- **Founder triage:** MUST-FIX before v1.0 GA.

### CONCERN-011 · Empty primitive arrays — valid?

- **Section:** §3.3 Primitives Section + `fai-manifest.schema.json`
- **Issue:** A schema-valid manifest could declare `"primitives": { "agents": [] }`. Is that a valid play (just an empty harness)? Or should at least ONE primitive be required?
- **Backward-compat:** Requiring at least one primitive is technically a breaking change for empty plays. Allowing empty is current behaviour.
- **Proposed v1.0 fix:** Keep current permissive behaviour (engine accepts empty arrays). Add §3.3.1 "Minimum Primitive Set": Conformant engines SHOULD emit a warning if NO primitive arrays are populated (likely user error). Add lint rule in Studio.
- **Founder triage:** MUST-FIX before v1.0 GA (clarification only; no schema change).

### CONCERN-012 · Hot reload / dynamic context unspecified

- **Section:** §4.3 Context Inheritance
- **Issue:** The spec is silent on whether context can change AFTER manifest load — e.g., a knowledge module updated mid-session, a guardrail threshold tightened by a control-plane API. All current language implies static load-once wiring.
- **Backward-compat:** Adding a dynamic-update extension is additive. Pinning to static load-once is also additive (just makes the implicit explicit).
- **Proposed v1.0 fix:** Add §4.6 "Static-by-Default": Context wiring is STATIC at manifest load time per the v1.0 spec. Engines MAY support dynamic context reload via a `reload()` API but the spec does not require or constrain it. Reserve `Dynamic Context` as a v2 RFC topic.
- **Founder triage:** WILL-DEFER (declare static-by-default in v1.0; full dynamic context is v2 scope).

### CONCERN-013 · Internationalisation / multi-language knowledge

- **Section:** §4.1 Knowledge Module IDs
- **Issue:** Knowledge module IDs (`F1-GenAI-Foundations`, etc.) are English. Multi-language teams cannot localise knowledge content while keeping IDs stable.
- **Backward-compat:** Adding a language hint is additive.
- **Proposed v1.0 fix:** WILL-DEFER. Note in v1.0 spec under §4 that "module IDs are language-neutral identifiers; content language is configured via the runtime's locale setting." Full i18n spec is v2 work.
- **Founder triage:** WILL-DEFER (acknowledged; not blocking v1.0).

### CONCERN-014 · Telemetry / observability contract missing

- **Section:** (currently no section)
- **Issue:** A conformant engine emits zero defined telemetry. Operators cannot rely on consistent structured logs / metrics / traces across implementations. OpenTelemetry compatibility unclear.
- **Backward-compat:** Adding a SHOULD-level telemetry section is additive.
- **Proposed v1.0 fix:** Add §10.1 "Telemetry (informative)": Engines SHOULD emit OpenTelemetry traces with span names `fai.manifest.load, fai.context.resolve, fai.primitive.wire, fai.agent.invoke, fai.guardrail.evaluate`. Attribute keys SHOULD include `fai.play.id, fai.play.version, fai.primitive.type, fai.primitive.name, fai.guardrail.metric`. This is informative (SHOULD), not mandatory (MUST).
- **Founder triage:** MUST-FIX before v1.0 GA (this is what enterprise asks for first; getting it right early avoids churn).

### Summary triage

| Triage | Count | Concerns |
|---|---|---|
| **MUST-FIX before v1.0 GA** | 11 | 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 014 (counted incorrectly — see below) |
| **WILL-DEFER to v2 RFC** | 2 | 012, 013 |
| **WON'T-DO** | 0 | — |

(Actual MUST-FIX count: 12 — 001 through 011 and 014.)

External RFC commenters MAY:
- Contest any MUST-FIX → WILL-DEFER triage
- Propose any WILL-DEFER → MUST-FIX with strong justification
- Add new CONCERN-015, -016, … entries via Discussion thread

---

## 4. External feedback inbox

> Triage entries are added below as comments arrive on Discussions / Issues / mailing list. Format mirrors §3.

*(Currently empty — RFC opens publicly on launch Wednesday.)*

| CONCERN-ID | Filed by | Date | Section | Status | Triage verdict | Resolution |
|---|---|---|---|---|---|---|
| _none yet_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ |

---

## 5. Endorsements log

> Public endorsements from framework, LLM, and eval-tooling community voices. Per [VERSIONING.md §3](./VERSIONING.md#v10-ga-gating-criteria), v1.0 GA requires 3+ endorsers from distinct communities.

| Endorser | Affiliation | Community | Date | Statement link |
|---|---|---|---|---|
| _none yet_ | _—_ | _—_ | _—_ | _—_ |

**Outreach target list** (not endorsements yet — outreach plan only):

| Community | Candidate voices | Outreach status |
|---|---|---|
| **Framework** | LangChain core / Semantic Kernel / CrewAI / LlamaIndex maintainers | Pending T+7 days |
| **LLM provider** | Anthropic DevRel / OpenAI DevRel / Mistral DevRel | Pending T+7 days |
| **Eval tooling** | Phoenix (Arize) / Langfuse / Helicone | Pending T+7 days |
| **Standards body** | LF AI & Data Foundation / Cloud Native Computing Foundation | Pending T+14 days |
| **Enterprise architect** | 2-3 Fortune 500 architects via warm intro | Pending design partner conversion |

---

## 6. v1.0 GA closure criteria (mirrors VERSIONING.md §3.1)

The RFC closes and v1.0 GA tags when ALL of these are true. Each is a discrete checkbox — none gets waived.

- [ ] All 12 MUST-FIX self-audited concerns (CONCERN-001…011 + 014) resolved in spec text + schema files
- [ ] All external CONCERN entries either RESOLVED, WILL-DEFER, or WON'T-DO with a public verdict comment
- [ ] **3+ public endorsements** logged in §5 (one each from framework, LLM, eval-tooling — categories may be flexible if a single endorser legitimately spans two)
- [ ] **0 unresolved CRITICAL** external comments in the final 14 days of the comment window
- [ ] Conformance L0 suite passes on the reference engine *and* one third-party implementation (publicly verifiable)
- [ ] All 104 existing solution plays validate against the v1.0 schema with **zero modifications required** (G.002 sacred)
- [ ] Schema URI `https://frootai.dev/schemas/v1/fai-manifest.schema.json` published, immutable, served with `Cache-Control: max-age=31536000, immutable`
- [ ] `VERSIONING.md` updated with v1.0 GA date + final changelog cross-reference
- [ ] Spec README banner updated: status "Release Candidate" → "Stable (v1.0)"
- [ ] Press + community announcement scheduled (Friday Letter #N, cross-post checklist applied per [P1.1.002](../../frootai-blueprint/content/p1.1-category-launch/02-cross-post-checklist.md))

---

## 7. Proposed v1.0 changelog (running draft)

> Updated weekly as MUST-FIX items resolve. Final form becomes the "What changed in v1.0 (vs v0.9-rc1)" section that replaces the current `## What changed in v0.9-rc1` block in [README.md](./README.md).

### Additions (non-breaking, safe to merge any time)

- ➕ `primitives.plugins`, `primitives.tools`, `primitives.prompts` documented in §3.3 + allowed in schema (CONCERN-001)
- ➕ §3.4.1 Custom Guardrails — opt-in extension mechanism (CONCERN-007)
- ➕ §3.5.1 Multi-Infrastructure Resolution — precedence rules (CONCERN-006)
- ➕ §3.7 Hook Lifecycle Events — canonical enumeration (CONCERN-004)
- ➕ §4.4 Scope Isolation — defines `context.scope` semantics (CONCERN-003)
- ➕ §4.5 Custom Knowledge Modules — `X*` registration mechanism (CONCERN-005)
- ➕ §4.6 Static-by-Default — locks dynamic context as v2 scope (CONCERN-012)
- ➕ §8.2 MCP Bridge Specification — tool naming + parameter mapping (CONCERN-009)
- ➕ §3.3.1 Minimum Primitive Set — warning policy on empty arrays (CONCERN-011)
- ➕ §3.4.2 Evaluation Timing — sync vs streaming vs batch (CONCERN-010)
- ➕ §10.1 Telemetry (informative) — OpenTelemetry SHOULD spans (CONCERN-014)
- ➕ VERSIONING.md §3.1 URI Migration Behaviour — unversioned-URI forever-validity (CONCERN-008)

### Renames / clarifications (no semantic change)

- 🔄 §9.1 Conformance Levels renumbered Level 1–5 → L0–L5; aligns with conformance suite folder + Master Tracker (CONCERN-002)
- ✏️ Note added to §4 that knowledge module IDs are language-neutral (CONCERN-013)

### Schema bumps

- `fai-manifest.schema.json` v1.0 → v1.1: adds optional `plugins`, `tools`, `prompts`, `guardrails.custom`. Hosted at `/v1/`.
- `fai-context.schema.json` v1.0 → v1.1: parallel changes (custom guardrails opt-in).
- `marketplace.schema.json` stays at v1.1 (no changes anticipated for v1.0).

### Breaking changes

**None.** v1.0 is a strict superset of v0.9-rc1. Every existing manifest validates without modification.

---

## 8. Amendment process

How an entry moves from "raised" → "incorporated in spec text":

```
┌──────────────────┐
│  Comment filed   │  (via channel from §2)
│  on Discussions  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Founder triage  │  ≤ 7 days (must-fix / will-defer / won't-do)
│  posted on       │  Triage gets a CONCERN-NNN ID + entry in §3 or §4
│  comment thread  │
└────────┬─────────┘
         │
         │  if MUST-FIX:
         ▼
┌──────────────────┐
│  Draft spec      │  Founder edits README.md + relevant schema
│  change in PR    │  PR links to CONCERN-NNN
│  to main branch  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Public review   │  PR open ≥ 7 days for review (longer if change is structural)
│  on the PR       │  At least 1 external reviewer comment required for non-trivial changes
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Merge to main + │  This RFC's §7 changelog gets the entry
│  update RFC §3   │  CONCERN-NNN status flips to RESOLVED
│  status          │
└──────────────────┘
```

**Last-call discipline:** The final 14 days of the RFC window are LAST-CALL for new MUST-FIX entries. After that point, the RFC accepts only editorial fixes and will-defer items — no new breaking-blockers. This protects the v1.0 ship date from late-arriving scope creep.

---

## 9. After v1.0 GA

When this RFC closes, the document is preserved at its current path **forever** as a public record of how v1.0 was made. Future major-version RFCs (v2.0, v3.0) get sibling files: `RFC-v2.0.md`, etc.

Post-GA, the founder commits to:

- Publishing a 1-page retrospective ("what the RFC taught us about the spec") within 14 days of GA
- Migrating all 104 plays' `$schema` references to `/v1/` (non-breaking; lint-warned-only for v0.x references)
- Opening the v1.1 RFC immediately with a smaller surface area (additive only) targeting +6 months from v1.0 GA

---

## 10. Open questions for the community (founder asks)

In addition to the 14 self-audited concerns, the founder explicitly asks the community for feedback on:

1. **Is the 9-primitive ontology complete?** What's a 10th primitive type that production AI teams need and we haven't named? (If yes → v2 RFC scope.)
2. **Is L0 the right floor for conformance?** Should there be an even-cheaper "L−1" (just file-exists check) for IDE-time validation? (Probably not — but worth asking.)
3. **Is MIT-forever the right license?** Or would Apache-2.0 (with patent grant) better protect ecosystem implementers? (License moves are existential decisions; explicit community input wanted.)
4. **Should v1.0 publish a "FAI Conformance Mark"?** A logo + machine-verifiable assertion that "this engine passes L0/L1/L2/etc." Concern: trademarks are not yet registered (per P0.3.011 runbook in flight). Defer to v1.1?
5. **What's the right cadence for Friday-Letter-style RFC updates?** Weekly? Bi-weekly? End of every triage round? (Currently planned weekly for the 60-day window — happy to adjust based on community appetite.)

---

## 11. References

- [Spec v0.9-rc1](./README.md) — what we're proposing to upgrade
- [VERSIONING.md](./VERSIONING.md) — semver + deprecation policy
- [Conformance Suite](../conformance/) — the test pack v1.0 GA must pass
- [Examples](./examples/) — 10 minimal manifests that v1.0 schema MUST validate
- [GOVERNANCE.md](../GOVERNANCE.md) — how decisions get made
- [G.002 (Backward compatibility sacred)](../../../frootai-blueprint/MASTER-IMPLEMENTATION-TRACKER.md) — the invariant this RFC enforces
- [RFC FAQ](../../../frootai-blueprint/content/p1.2-protocol-rfc/03-rfc-faq.md) — 20 Q&A pairs anticipating common RFC questions
- [How we designed the FAI Protocol](../../../frootai-blueprint/content/p1.2-protocol-rfc/01-how-we-designed-fai-protocol.md) — design-decisions essay (the inside-out spec view)

---

*This document is published under MIT. Comments, critiques, and counter-proposals welcome through any of the [§2 channels](#2-feedback-channels-where-comments-are-accepted).*

*— Pavleen Bali · Founder, FrootAI · 2026-05-22*
