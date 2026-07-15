/**
 * [Z10.3] Smoke + contract tests for the Lean+ compiler scaffold.
 *
 * Validates the harness wiring end-to-end with the StubSemanticCompressor:
 *   - `compilePlus` returns the documented { lean, stats, verdict } shape
 *   - Stub backend → identity → fidelity gate passes → served flavor = semantic
 *   - A "broken" backend that grows the text falls back to lossless
 *   - A backend that drops a hard-fail class (guardrail) falls back to lossless
 *   - Determinism: same input + same backend → identical output
 *
 * No real LLM is exercised — that lives in a future row. This test pins the
 * CONTRACT every backend must satisfy.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compilePlus, StubSemanticCompressor } from "./index.js";

const SAMPLE_FULL = `---
title: Boost Prompt
---

# Boost Prompt

**Use when** the user asks for a stronger phrasing of an existing prompt.

You MUST preserve user intent. NEVER fabricate a tool call.

\`\`\`bash
frootai boost --input "$PROMPT"
\`\`\`

## Parameters

- \`--input\` (string, required)
- \`--style\` (one of: concise | formal | playful)
`;

test("[Z10.3] compilePlus returns { lean, stats, verdict } with documented shape", async () => {
    const out = await compilePlus(SAMPLE_FULL);
    assert.equal(typeof out.lean, "string");
    assert.ok(out.stats && typeof out.stats === "object");
    assert.equal(typeof out.stats.sourceTokens, "number");
    assert.equal(typeof out.stats.losslessTokens, "number");
    assert.equal(typeof out.stats.candidateTokens, "number");
    assert.equal(typeof out.stats.servedTokens, "number");
    assert.equal(typeof out.stats.savedTokens, "number");
    assert.equal(typeof out.stats.savedTokensVsLossless, "number");
    assert.ok(out.stats.servedFlavor === "lossless" || out.stats.servedFlavor === "semantic");
    assert.equal(typeof out.stats.backendId, "string");
    assert.ok(out.verdict && typeof out.verdict === "object");
    assert.equal(typeof out.verdict.pass, "boolean");
    assert.equal(typeof out.verdict.score, "number");
    assert.ok(Array.isArray(out.verdict.reasons));
});

test("[Z10.3] StubSemanticCompressor → identity → fidelity gate passes → lossless reported", async () => {
    const out = await compilePlus(SAMPLE_FULL, { semantic: StubSemanticCompressor });
    assert.equal(out.stats.backendId, "stub-identity");
    assert.equal(out.verdict.pass, true, `expected pass, reasons=${out.verdict.reasons.join(" | ")}`);
    assert.equal(out.stats.servedFlavor, "lossless");
    // Identity stub → byte-for-byte equal to the lossless floor
    assert.equal(out.stats.servedTokens, out.stats.losslessTokens);
    assert.equal(out.stats.savedTokensVsLossless, 0);
});

test("[Z10.3] backend that grows the text is refused, harness falls back to lossless", async () => {
    const Bloater = {
        id: "test-bloater",
        compress: (lean) => lean + "\n\n## Extra section added by bad backend\nthis is bloat\n",
    };
    const out = await compilePlus(SAMPLE_FULL, { semantic: Bloater });
    assert.equal(out.stats.backendId, "test-bloater");
    assert.equal(out.verdict.pass, false);
    assert.equal(out.stats.servedFlavor, "lossless");
    assert.match(out.verdict.reasons.join(" "), /longer than lossless/);
});

test("[Z10.3] shorter text that grows canonical tokens is refused", async () => {
    const TokenInflator = {
        id: "test-token-inflator",
        compress: () => "🧠🧠🧠",
    };
    const out = await compilePlus("aaaaaaaaaaaa", { semantic: TokenInflator });
    assert.equal(out.verdict.pass, false);
    assert.equal(out.stats.servedFlavor, "lossless");
    assert.match(out.verdict.reasons.join(" "), /more tokens than lossless/);
});

test("[Z10.3] backend that drops a guardrail trips Z1 hard-fail → fallback to lossless", async () => {
    const GuardrailDropper = {
        id: "test-guardrail-dropper",
        compress: (lean) => lean
            .replace(/You MUST preserve user intent\./, "")
            .replace(/NEVER fabricate a tool call\./, ""),
    };
    const out = await compilePlus(SAMPLE_FULL, { semantic: GuardrailDropper });
    assert.equal(out.verdict.pass, false);
    assert.equal(out.stats.servedFlavor, "lossless");
    assert.ok(out.verdict.reasons.length > 0, "expected at least one hard-fail reason");
});

test("[Z10.3] determinism — same input + same stub backend → byte-identical output", async () => {
    const a = await compilePlus(SAMPLE_FULL);
    const b = await compilePlus(SAMPLE_FULL);
    assert.equal(a.lean, b.lean);
    assert.equal(a.stats.servedTokens, b.stats.servedTokens);
    assert.equal(a.verdict.score, b.verdict.score);
});

test("[Z10.3] non-string md throws TypeError (boundary)", async () => {
    await assert.rejects(() => compilePlus(null), TypeError);
    await assert.rejects(() => compilePlus(42), TypeError);
});

test("[Z10.3] backend returning non-string throws TypeError with backend id", async () => {
    const BadBackend = {
        id: "test-bad-return",
        compress: () => 12345,
    };
    await assert.rejects(
        () => compilePlus(SAMPLE_FULL, { semantic: BadBackend }),
        (err) => err instanceof TypeError && /test-bad-return/.test(err.message),
    );
});
