# Recipe 38 Composition Eval: Competitor Pricing Tracker (Firecrawl + MongoDB + Notion)

> Post-run evaluation check asserting recipe 38 (`38-competitor-pricing-tracker`)
> still produces valid output after a harness run — the community-contribution
> sample stays healthy as the marketplace specs, run script, and sample
> transcript evolve.

## Check ID

`mcp-composition-38`

## Category

Federation Integrity

## Severity

**Blocking** — fails the evaluation pipeline if the recipe no longer produces a
valid transcript or leaves an attached area unused.

## Recipe under test

[`38-competitor-pricing-tracker`](../cookbook/38-competitor-pricing-tracker.md) — harness at
[`cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/run.mjs`](../cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/run.mjs).

## Areas attached

`firecrawl`, `mongodb`, `notion`

The harness in [`[X8.12]`] drives these areas with deterministic offline fakes,
so this check runs on a fresh CI runner with no network and no credentials.

## What This Check Does

1. **Runs the recipe harness** — `node cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/run.mjs`.
2. **Asserts the run is valid** — the transcript ends with `RESULT: OK` and the
   process exits 0.
3. **Asserts full federation** — every attached area (`firecrawl`, `mongodb`, `notion`) was exercised;
   the harness throws if any attached area is left unused, proving the recipe is
   a real composition, not a single-server task with idle attachments.
4. **Asserts transcript parity** — the live run still matches the committed
   `sample-output.md` (the [`[X8.13]`] snapshot), catching silent drift.

## Pass Criteria

- `run.mjs` exits 0 and prints `RESULT: OK` as its last result line.
- Every attached area (`firecrawl`, `mongodb`, `notion`) appears in the transcript.
- The committed `sample-output.md` transcript matches the live run.

## Fail Examples

```
FAIL: 38-competitor-pricing-tracker
  run.mjs exited 1 — transcript did not end with "RESULT: OK"
  Fix: a step threw; inspect the printed transcript for the failing area

FAIL: 38-competitor-pricing-tracker
  attached area "firecrawl" was never called during the run
  Fix: either wire the area into a step or drop it from mcp_scope.attached
```

## How to Run

### Automated (CI)

```bash
node frootai/cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/run.mjs
```

Exit code 0 + a final `RESULT: OK` line = pass.

## Related Checks

- `fai-mcp-scope-consistency` — static scope vs. tool-reference parity ([M10.14] / [X8.21]).
- The nightly `cookbook-composition.yml` workflow ([X8.15]) runs every recipe harness.
- This is the sample 11th recipe prototyped via the [X8.25] community-PR workflow.
