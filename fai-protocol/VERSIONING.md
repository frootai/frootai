# FAI Protocol Versioning Policy

> **The contract we make to the ecosystem about how the FAI Protocol evolves.**
>
> *Last updated: 2026-05-22 · Status: in effect from v0.9-rc1*

This document is the authoritative source for how versions of the FAI Protocol — and every artefact it ships (spec, schemas, manifest format, conformance levels, marketplace registry) — are assigned, advanced, and deprecated.

It implements **G.002 (backward compatibility sacred)** and **G.009 (no silent breaks)** from the [Master Implementation Tracker](../../../frootai-blueprint/MASTER-IMPLEMENTATION-TRACKER.md).

---

## 1. The five things we version

| # | Artefact | Where it lives | What its version means |
|---|---|---|---|
| 1 | **Protocol spec** | [`README.md`](./README.md) | The behavioural contract a conformant runtime implements |
| 2 | **Manifest schema** | [`../schemas/fai-manifest.schema.json`](../schemas/fai-manifest.schema.json) | The JSON Schema a play's `fai-manifest.json` is validated against |
| 3 | **Context schema** | [`../schemas/fai-context.schema.json`](../schemas/fai-context.schema.json) | The JSON Schema a standalone primitive's `fai-context.json` is validated against |
| 4 | **Marketplace schema** | [`../schemas/marketplace.schema.json`](../schemas/marketplace.schema.json) | The JSON Schema for the public plugin registry |
| 5 | **Conformance suite** | [`../conformance/`](../conformance/) | The L0–L5 test packs runtimes are graded against |

These versions are **independent**. The spec can move while schemas stay frozen; schemas can ship a v1.1 minor while the spec stays at v1.0. Each artefact carries its own version field.

---

## 2. Semver — the core rules

All artefacts follow **[Semantic Versioning 2.0](https://semver.org)**.

| Bump | Trigger | Examples |
|---|---|---|
| **MAJOR** (`1.0 → 2.0`) | A *breaking* change — existing valid input becomes invalid, or existing valid output is interpreted differently | Removing a required field, changing a field's type, tightening a regex |
| **MINOR** (`1.0 → 1.1`) | An *additive* change — new optional fields, new enum values, new optional sections | Adding an optional `deprecated` flag to plugin entries (this is what v1.1 of `marketplace.schema.json` did) |
| **PATCH** (`1.0.0 → 1.0.1`) | Editorial / clarification — wording, examples, errata. No semantic change | Fixing a typo in a description, adding an example, clarifying ambiguous prose |

Pre-release suffixes use the dot form: `0.9-rc1`, `1.0-rc1`, `1.0-rc2`, `1.0`.

> **Build numbers and metadata** (`+build.20260522`) are reserved for internal CI use only; never relied on by conformant runtimes.

---

## 3. The road to v1.0

Where we are today (2026-05-22):

```
v0.1 Draft  ────►  v0.9-rc1  ────►  v0.9-rc2*  ────►  v1.0 GA
                  (NOW)              (if needed)
```

**`*` v0.9-rc2 will ship only if** the public RFC surfaces breaking concerns. If no breaking concerns surface in the 60-day comment window, v0.9-rc1 graduates directly to v1.0 GA.

### v1.0 GA gating criteria

We declare v1.0 GA when ALL of these are true:

- [ ] **3+ external endorsers** publicly back the spec (one from each of: framework, LLM, eval-tooling communities).
- [ ] **0 unresolved critical RFC comments** in the public Discussion.
- [ ] **Conformance L0 test suite passes** on the reference implementation (`engine/`) AND at least one third-party implementation.
- [ ] **No breaking changes** introduced in the final 30 days of the comment window.
- [ ] **All 104 existing plays** validate cleanly against the v0.9-rc1 → v1.0 schema.
- [ ] **Schema URI version-locked**: `https://frootai.dev/schemas/v1/fai-manifest.schema.json` published and immutable.

When v1.0 ships, the v0.x line is frozen — no new releases. Existing plays continue to validate against v0.9-rc1 indefinitely (it remains hosted at its URI).

---

## 4. Parallel-track versions

Once we reach v1.0, we begin a **dual-version model** to enable migration without forcing it:

```
v1 line:                    v1.0  →  v1.1  →  v1.2  →  ...    (current GA)
v2 line:                                      v2.0-rc  →  v2.0  (next major)
```

Both versions are **hosted simultaneously**:

| Version | Schema URI | Lifecycle |
|---|---|---|
| v0.x | `https://frootai.dev/schemas/fai-manifest.schema.json` | Historical · frozen · still validates |
| v1.x | `https://frootai.dev/schemas/v1/fai-manifest.schema.json` | Active GA |
| v2.x | `https://frootai.dev/schemas/v2/fai-manifest.schema.json` | Active GA (once shipped) |

A play declares which version it targets via `$schema`. The reference engine reads `$schema` and picks the matching validator. **Both v1 and v2 implementations are first-class** until the v1 line is officially deprecated (see §5).

---

## 5. Deprecation policy

We **never silently break a public API.** Every removal follows this sequence:

```
   Day 0          Day 90          Day 180+        Day 365
    │              │               │               │
    ▼              ▼               ▼               ▼
[MARK as       [BLOCKING        [HARD ERROR     [REMOVE
 deprecated     warning in       on next         from spec]
 in spec       conformance       MAJOR]
 + emit        suite + CI]
 runtime
 warning]
```

| Phase | Duration | What happens |
|---|---|---|
| **Mark** | Day 0 | Field added to spec marked `**Deprecated since v1.X.**`; runtime emits a `console.warn` on use; CI shows yellow |
| **Block** | Day 0 → Day 90 | Conformance L0 test for the deprecated field fails (yellow → red); PRs adding the field blocked |
| **Error** | Day 90 → next MAJOR | Reference engine rejects the field by default; users must opt in via `--allow-deprecated` |
| **Remove** | Next MAJOR | Field removed from spec; schema validation rejects it; conformance suite drops the test |

**Minimum 90 days** between Mark and Block. **Minimum 6 months** between Mark and Remove. **Always documented in CHANGELOG.**

---

## 6. Versioning per artefact — specifics

### 6.1 Protocol spec (`README.md`)

- Version declared in `Status` table at the top.
- Bump MINOR when you add a new optional section or clarify behaviour additively.
- Bump MAJOR when you change required fields, default behaviour, or error semantics.
- Editorial changes (typos, examples) bump PATCH and do not require RFC.

### 6.2 Manifest schema (`fai-manifest.schema.json`)

- Version is implicit in the URI: `/schemas/fai-manifest.schema.json` (current), `/schemas/v1/...`, `/schemas/v2/...` (locked majors).
- Adding an optional field → minor schema revision, hot-patch in place, no URI change.
- Removing a field, changing types, or adding a new required field → MAJOR, new URI.
- We never edit a version-locked URI in place. Edits go to the unversioned `/schemas/fai-manifest.schema.json` (which is always the "current" pointer).

### 6.3 Context schema (`fai-context.schema.json`)

Same rules as the manifest schema. Tracked separately because it can evolve independently.

### 6.4 Marketplace schema (`marketplace.schema.json`)

- Version declared via the `$id` and an in-file `description` field.
- Currently at **v1.1** (frozen 2026-05-22 as part of P0.2.004).
- v1.1 added optional fields: `verified`, `certified`, `deprecated`, `deprecationNotice`, `replacedBy`, plus expanded `items` (workflows, prompts, tools, guardrails counts).
- Backwards compatible with v1.0 entries — every v1.0 plugin entry validates cleanly against v1.1.

### 6.5 Conformance suite (`../conformance/`)

- Versioned as `conformance-vX.Y`.
- A conformance run reports which suite version it ran against.
- A runtime can claim "L0 against v0.9-rc1 suite" — that claim remains valid even as later suites add tests.

---

## 7. The "Mark + Sunset" notation in source

When a field is marked deprecated, the spec, schema, and runtime use a consistent vocabulary so tooling can parse it:

**In spec (Markdown):**
```markdown
| `someOldField` | string | No | **Deprecated since v1.2. Use `replacement` instead. Will be removed in v2.0 (no earlier than 2027-01-01).** |
```

**In schema (JSON):**
```json
{
  "someOldField": {
    "type": "string",
    "deprecated": true,
    "x-deprecation": {
      "since": "1.2.0",
      "removeIn": "2.0.0",
      "removeNotEarlierThan": "2027-01-01",
      "replacement": "replacement"
    }
  }
}
```

**In runtime (warning):**
```
[FAI Engine v1.2] WARNING: 'someOldField' is deprecated since v1.2.
  Use 'replacement' instead. Will be removed in v2.0 (≥ 2027-01-01).
  See: https://frootai.dev/spec#deprecations
```

---

## 8. The non-negotiables

These bind every release decision:

1. **No silent breaking changes — ever.** If it surprises a user, it's a bug.
2. **MIT license preserved across versions.** No upgrade tax.
3. **Old plays keep working.** A play authored against v0.9-rc1 MUST validate and run against every v1.x and (with `--legacy`) v2.x.
4. **Schema URIs are immutable once version-locked.** v1 URI never changes; we publish a v2 URI for the next major.
5. **Every change announced.** CHANGELOG.md per artefact, Friday Letter mention, public RFC for any MAJOR.

---

## 9. CHANGELOG location

| Artefact | CHANGELOG |
|---|---|
| Protocol spec | [`README.md` § "What changed in vX.Y"](./README.md) |
| Manifest schema | `../schemas/CHANGELOG.md` *(to be created at first schema change)* |
| Context schema | `../schemas/CHANGELOG.md` |
| Marketplace schema | `../schemas/CHANGELOG.md` |
| Conformance suite | `../conformance/CHANGELOG.md` |

All follow [Keep a Changelog](https://keepachangelog.com) format.

---

*"From the Roots to the Fruits — and the trunk stays sturdy."*
