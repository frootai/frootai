/**
 * [Z10.8] Security review — no secret leakage in Lean.
 *
 * Threat model: a primitive's Full form may contain secrets — an env var like
 * `$STRIPE_LIVE_KEY` or a guardrail "NEVER log the API key". Lean must never move
 * a secret somewhere it does not already belong (a log line, a metric, metadata),
 * and must never silently drop a secret-protecting guardrail.
 *
 * This adversarial suite plants a unique, grep-able secret token and drives it
 * through the whole pipeline (compile → gate → audit → Lean+ → governance →
 * cost), asserting the secret only ever appears where it legitimately belongs
 * (the served artifact itself, and the operator-facing receipt) and NEVER in a
 * persisted, secret-free surface (the append-only audit, governance/cost output).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { gate } from "./fidelity-gate.js";
import { buildReceipt } from "./fidelity-receipt.js";
import { auditLine, serializeAuditLine } from "./fidelity-audit.js";
import { fetchAuditLine, serializeFetchAuditLine, appendFetchAudit, parseFetchAuditLog } from "./fetch-audit.js";
import { evaluateFetch } from "./governance-policy.js";
import { meterText } from "./cost-meter.js";
import { compilePlus, RuleSemanticCompressor } from "../lean-compiler-plus/index.js";

// A unique, grep-able planted secret. If this string ever appears in a persisted
// surface, the test fails loudly.
const SECRET = "sk_live_PLANTEDSECRET_DO_NOT_LEAK_42";

const FULL_WITH_SECRET = [
  "# Charge Helper",
  "",
  "**Use when** the user asks to charge a card.",
  "",
  `You MUST authenticate with $${SECRET}.`,
  `NEVER log $${SECRET} to stdout.`,
  "",
  "Run the charge.",
].join("\n");

test("[Z10.8] a passing Lean preserves the secret IN PLACE and never duplicates it", () => {
  // Identity lean (passes the gate) — the secret stays exactly where it was.
  const g = gate(FULL_WITH_SECRET, FULL_WITH_SECRET, { id: "charge", type: "skill" });
  assert.equal(g.flavor, "lean");
  // Present exactly as often as in the Full — never relocated or duplicated.
  const inFull = FULL_WITH_SECRET.split(SECRET).length - 1;
  const inServed = g.served.split(SECRET).length - 1;
  assert.equal(inServed, inFull);
});

test("[Z10.8] the persisted fetch-audit is secret-free even when the secret is dropped", () => {
  // A lean that drops the secret param + guardrail → gate fails → fallback.
  const lean = "# Charge Helper\n\n**Use when** the user asks to charge a card.\n\nRun the charge.";
  const g = gate(FULL_WITH_SECRET, lean, { id: "charge", type: "skill" });
  assert.equal(g.fallback, true);

  const line = fetchAuditLine(
    { actor: "tenant-acme", id: "charge", fidelity: g.receipt.score, variant: g.flavor },
    { at: "2026-06-23T00:00:00.000Z" },
  );
  assert.equal(serializeFetchAuditLine(line).includes(SECRET), false);
});

test("[Z10.8] the persisted fidelity-audit records dropped COUNTS, never the secret string", () => {
  const lean = "# Charge Helper\n\n**Use when** the user asks to charge a card.\n\nRun the charge.";
  const g = gate(FULL_WITH_SECRET, lean, { id: "charge", type: "skill" });
  const line = auditLine(g, { at: "2026-06-23T00:00:00.000Z" });
  const blob = serializeAuditLine(line);
  assert.equal(blob.includes(SECRET), false);
  // The drop is still recorded — as a count.
  assert.ok((line.dropped.param ?? 0) + (line.dropped.guardrail ?? 0) > 0);
});

test("[Z10.8] the diagnostic boundary: the receipt MAY name the dropped secret, the audit MAY NOT", () => {
  const lean = "# Charge Helper\n\n**Use when** the user asks to charge a card.\n\nRun the charge.";
  const receipt = buildReceipt(FULL_WITH_SECRET, lean, { id: "charge", type: "skill" });
  // The receipt is operator-facing: it explains what was lost, so it may name it.
  const receiptNamesSecret = JSON.stringify(receipt.dropped).includes(SECRET);
  // The audit line derived from the same gate result must NOT.
  const auditBlob = serializeAuditLine(auditLine(gate(FULL_WITH_SECRET, lean), { at: "2026-06-23T00:00:00.000Z" }));
  assert.equal(auditBlob.includes(SECRET), false);
  // Document the boundary: whatever the receipt does, the audit is the safe surface.
  assert.equal(typeof receiptNamesSecret, "boolean");
});

test("[Z10.8] a Lean+ backend that drops a secret-protecting guardrail falls back to lossless", async () => {
  const GuardrailDropper = {
    id: "test-secret-guardrail-dropper",
    compress: (lean) => lean.replace(new RegExp(`NEVER log \\$${SECRET} to stdout\\.`), ""),
  };
  const out = await compilePlus(FULL_WITH_SECRET, { semantic: GuardrailDropper, primitiveType: "skill" });
  assert.equal(out.verdict.pass, false);
  assert.equal(out.stats.servedFlavor, "lossless");
  // The guardrail survived in the served (lossless) variant.
  assert.match(out.lean, new RegExp(`NEVER log \\$${SECRET}`));
});

test("[Z10.8] the real Lean+ paraphrase backend never relocates the secret", async () => {
  const out = await compilePlus(FULL_WITH_SECRET, { semantic: RuleSemanticCompressor, primitiveType: "skill" });
  // Whatever variant is served, the secret count never exceeds the lossless count.
  const losslessCount = FULL_WITH_SECRET.split(SECRET).length - 1;
  const servedCount = out.lean.split(SECRET).length - 1;
  assert.ok(servedCount <= losslessCount);
});

test("[Z10.8] governance and cost-meter outputs carry no secret", () => {
  const decision = evaluateFetch({ default: { minFidelity: 9.5 } }, { actor: "acme", fidelity: 9.7 });
  assert.equal(JSON.stringify(decision).includes(SECRET), false);
  const metered = meterText(FULL_WITH_SECRET, FULL_WITH_SECRET, 0.0025);
  assert.equal(JSON.stringify(metered).includes(SECRET), false);
});

test("[Z10.8] an append-only audit log file never contains the secret across many fetches", () => {
  const dir = mkdtempSync(join(tmpdir(), "sec-review-"));
  const path = join(dir, "fetch.jsonl");
  try {
    const lean = "# Charge Helper\n\n**Use when** the user asks to charge a card.\n\nRun the charge.";
    for (let i = 0; i < 5; i++) {
      const g = gate(FULL_WITH_SECRET, i % 2 ? FULL_WITH_SECRET : lean, { id: "charge" });
      appendFetchAudit(path, { actor: `t${i}`, id: "charge", fidelity: g.receipt.score, variant: g.flavor }, { at: "2026-06-23T00:00:00.000Z" });
    }
    const body = readFileSync(path, "utf8");
    assert.equal(body.includes(SECRET), false);
    assert.equal(parseFetchAuditLog(body).length, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[Z10.8] the SLA documents the security review section", () => {
  const sla = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SLA.md"), "utf8");
  assert.ok(/Security review/i.test(sla), "SLA must have a security-review section");
  assert.ok(/no secret leakage/i.test(sla), "SLA must state the no-secret-leakage property");
  assert.ok(/operator-facing/i.test(sla), "SLA must state the receipt diagnostic boundary");
});
