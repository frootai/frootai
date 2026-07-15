# Recipe 29 Composition Eval: Azure Resource Audit (Azure + MS Learn)

> Post-run evaluation check asserting recipe 29 (`29-azure-resource-audit`) still produces valid
> output after a harness run — the composition stays healthy as the marketplace
> specs, run script, and sample transcript evolve.

## Check ID

`mcp-composition-29`

## Category

Federation Integrity

## Severity

**Blocking** — fails the evaluation pipeline if the recipe no longer produces a
valid transcript or leaves an attached area unused.

## Recipe under test

[`29-azure-resource-audit`](../cookbook/29-azure-resource-audit.md) — harness at
[`cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs`](../cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs).

## Areas attached

`azure`, `ms-learn`

The harness in [`[X8.12]`] drives these areas with deterministic offline fakes,
so this check runs on a fresh CI runner with no network and no credentials.

## What This Check Does

1. **Runs the recipe harness** — `node cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs`.
2. **Asserts the run is valid** — the transcript ends with `RESULT: OK` and the
   process exits 0.
3. **Asserts full federation** — every attached area (`azure`, `ms-learn`) was exercised;
   the harness throws if any attached area is left unused, proving the recipe is
   a real composition, not a single-server task with idle attachments.
4. **Asserts transcript parity** — the live run still matches the committed
   `sample-output.md` (the [`[X8.13]`] snapshot), catching silent drift.

## Pass Criteria

- `run.mjs` exits 0 and prints `RESULT: OK` as its last result line.
- Every attached area (`azure`, `ms-learn`) appears in the transcript.
- The committed `sample-output.md` transcript matches the live run.

## Fail Examples

```
FAIL: 29-azure-resource-audit
  run.mjs exited 1 — transcript did not end with "RESULT: OK"
  Fix: a step threw; inspect the printed transcript for the failing area

FAIL: 29-azure-resource-audit
  attached area "azure" was never called during the run
  Fix: either wire the area into a step or drop it from mcp_scope.attached
```

## How to Run

### Automated (CI)

```bash
node frootai/cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs
```

Exit code 0 + a final `RESULT: OK` line = pass.

### Manual Verification

```bash
# Run the recipe harness and confirm the last line
node frootai/cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs | tail -1

# Confirm the committed sample matches the live run
diff <(node frootai/cookbook/recipes-mcp-composition/29-azure-resource-audit/run.mjs) \
     <(sed -n '/^```/,/^```/p' frootai/cookbook/recipes-mcp-composition/29-azure-resource-audit/sample-output.md)
```

## Related Checks

- `fai-mcp-scope-consistency` — static scope vs. tool-reference parity ([M10.14] / [X8.21]).
- The nightly `cookbook-composition.yml` workflow ([X8.15]) runs every recipe harness.
- Per-recipe `mcp-scope.json` ([X8.14]) + `security.json` ([X8.18]) keep the
  attach list + credentials honest.
