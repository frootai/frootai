/**
 * [Z10.1] Tests — Audit log per Lean FETCH (who / what / fidelity).
 *
 * The line is compact + secret-free (assembled from a fixed allow-list, never
 * content), the builder is deterministic (injected timestamp), `actor` (who)
 * and `id` (what) are required, and appendFetchAudit is append-only and
 * round-trips through parseFetchAuditLog.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fetchAuditLine,
  serializeFetchAuditLine,
  appendFetchAudit,
  parseFetchAuditLog,
} from "./fetch-audit.js";

const AT = "2026-06-23T00:00:00.000Z";

test("[Z10.1] fetchAuditLine records who/what/fidelity compactly", () => {
  const line = fetchAuditLine(
    { actor: "tenant-acme", id: "deploy-azure", type: "play", variant: "lean", fidelity: 10, savedPct: 41, channel: "cli" },
    { at: AT },
  );
  assert.equal(line.ts, AT);
  assert.equal(line.actor, "tenant-acme");
  assert.equal(line.id, "deploy-azure");
  assert.equal(line.type, "play");
  assert.equal(line.variant, "lean");
  assert.equal(line.fidelity, 10);
  assert.equal(line.savedPct, 41);
  assert.equal(line.channel, "cli");
  assert.equal(line.fallback, false);
});

test("[Z10.1] variant defaults to full + fallback when not 'lean'", () => {
  const line = fetchAuditLine({ actor: "t1", id: "p1" }, { at: AT });
  assert.equal(line.variant, "full");
  assert.equal(line.fallback, true);
  assert.equal(line.channel, "unknown");
  assert.equal(line.fidelity, null);
  assert.equal(line.savedPct, null);
});

test("[Z10.1] an explicit fallback flag overrides the variant inference", () => {
  // Served Full on purpose but the caller wants to mark it not-a-fallback.
  const line = fetchAuditLine({ actor: "t1", id: "p1", variant: "full", fallback: false }, { at: AT });
  assert.equal(line.variant, "full");
  assert.equal(line.fallback, false);
});

test("[Z10.1] ts defaults to null when no timestamp is injected (determinism)", () => {
  const line = fetchAuditLine({ actor: "t1", id: "p1" });
  assert.equal(line.ts, null);
});

test("[Z10.1] missing actor (who) throws TypeError", () => {
  assert.throws(() => fetchAuditLine({ id: "p1" }, { at: AT }), TypeError);
  assert.throws(() => fetchAuditLine({ actor: "   ", id: "p1" }, { at: AT }), TypeError);
});

test("[Z10.1] missing id (what) throws TypeError", () => {
  assert.throws(() => fetchAuditLine({ actor: "t1" }, { at: AT }), TypeError);
});

test("[Z10.1] SECRET-FREE: a fat event leaks no content into the line", () => {
  const line = fetchAuditLine(
    {
      actor: "t1",
      id: "p1",
      variant: "lean",
      fidelity: 9,
      // Hostile extra keys the allow-list must ignore entirely:
      dropped: { guardrail: ["NEVER log $SUPER_SECRET_TOKEN"] },
      fullText: "Set $SUPER_SECRET_TOKEN.",
      reason: "leaked $OTHER_SECRET",
    },
    { at: AT },
  );
  const blob = JSON.stringify(line);
  assert.equal(blob.includes("SUPER_SECRET_TOKEN"), false);
  assert.equal(blob.includes("OTHER_SECRET"), false);
  assert.equal(blob.includes("dropped"), false);
  // Only the safe allow-listed keys survive.
  assert.deepEqual(Object.keys(line).sort(), [
    "actor",
    "channel",
    "fallback",
    "fidelity",
    "id",
    "savedPct",
    "ts",
    "type",
    "variant",
  ]);
});

test("[Z10.1] non-numeric fidelity/savedPct coerce to null", () => {
  const line = fetchAuditLine({ actor: "t1", id: "p1", fidelity: "10", savedPct: NaN }, { at: AT });
  assert.equal(line.fidelity, null);
  assert.equal(line.savedPct, null);
});

test("[Z10.1] serializeFetchAuditLine is a single newline-terminated JSON line", () => {
  const s = serializeFetchAuditLine(fetchAuditLine({ actor: "t1", id: "p1" }, { at: AT }));
  assert.equal(s.endsWith("\n"), true);
  assert.equal(s.trim().split("\n").length, 1);
  assert.deepEqual(JSON.parse(s).actor, "t1");
});

test("[Z10.1] appendFetchAudit is append-only and round-trips", () => {
  const dir = mkdtempSync(join(tmpdir(), "fetch-audit-"));
  const path = join(dir, "fetch.jsonl");
  try {
    appendFetchAudit(path, { actor: "t1", id: "a", variant: "lean", fidelity: 10 }, { at: AT });
    appendFetchAudit(path, { actor: "t2", id: "b", variant: "full" }, { at: AT });
    const rows = parseFetchAuditLog(readFileSync(path, "utf8"));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].actor, "t1");
    assert.equal(rows[0].variant, "lean");
    assert.equal(rows[1].actor, "t2");
    assert.equal(rows[1].fallback, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[Z10.1] appendFetchAudit defaults the timestamp to wall-clock now", () => {
  const dir = mkdtempSync(join(tmpdir(), "fetch-audit-"));
  const path = join(dir, "fetch.jsonl");
  try {
    const before = Date.now();
    const line = appendFetchAudit(path, { actor: "t1", id: "a" });
    const after = Date.now();
    const t = Date.parse(line.ts);
    assert.equal(Number.isNaN(t), false);
    assert.ok(t >= before && t <= after);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
