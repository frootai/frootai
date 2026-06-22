/**
 * [Z0.6] Tests — Stage 3c: TABLE / LIST compressor.
 *
 * Row literal: "Stage 3 TABLE/LIST compressor — collapse whitespace, dedupe rows".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compressTable, compressList, splitRow } from "./compress-table-list.js";
import { compile } from "./index.js";

// ── splitRow ──────────────────────────────────────────────────────────────
test("[Z0.6] splitRow trims cells and drops outer-pipe artefacts", () => {
  assert.deepEqual(splitRow("| foo  |  bar |"), ["foo", "bar"]);
});

test("[Z0.6] splitRow keeps a genuinely-empty interior cell", () => {
  assert.deepEqual(splitRow("|  | b |"), ["", "b"]);
});

test("[Z0.6] splitRow respects escaped pipes and code-span pipes", () => {
  assert.deepEqual(splitRow("| a\\|b | `c|d` |"), ["a\\|b", "`c|d`"]);
});

// ── compressTable ─────────────────────────────────────────────────────────
test("[Z0.6] collapses aligned column padding to single-space cells", () => {
  const raw = "| name   | role     |\n|--------|----------|\n| a      | b        |";
  const out = compressTable(raw);
  assert.equal(out, "| name | role |\n| --- | --- |\n| a | b |");
});

test("[Z0.6] preserves alignment colons in the separator row", () => {
  const raw = "| a | b | c |\n|:-------|-------:|:-----:|\n| 1 | 2 | 3 |";
  const out = compressTable(raw);
  assert.ok(out.includes("| :--- | ---: | :---: |"));
});

test("[Z0.6] dedupes byte-identical body rows, keeps first, order preserved", () => {
  const raw = "| k | v |\n|---|---|\n| a | 1 |\n| b | 2 |\n| a | 1 |";
  const out = compressTable(raw);
  const bodyRows = out.split("\n").slice(2);
  assert.deepEqual(bodyRows, ["| a | 1 |", "| b | 2 |"]);
});

test("[Z0.6] table cell CONTENT is never altered (only padding)", () => {
  const raw = "| col |\n|-----|\n| `keep|me` |\n| a\\|b |";
  const out = compressTable(raw);
  assert.ok(out.includes("`keep|me`"));
  assert.ok(out.includes("a\\|b"));
});

test("[Z0.6] table compressor is monotone and idempotent", () => {
  const raw = "| name   | role     |\n|--------|----------|\n| a      | b        |";
  const once = compressTable(raw);
  assert.ok(once.length <= raw.length);
  assert.equal(compressTable(once), once);
});

// ── compressList ──────────────────────────────────────────────────────────
test("[Z0.6] collapses interior space runs, trims trailing whitespace", () => {
  const raw = "- foo     bar   \n- baz";
  assert.equal(compressList(raw), "- foo bar\n- baz");
});

test("[Z0.6] preserves nesting indentation", () => {
  const raw = "- top\n    - nested    item";
  assert.equal(compressList(raw), "- top\n    - nested item");
});

test("[Z0.6] list code spans + links are not space-collapsed", () => {
  const raw = "- see [a  b](http://x  y) and `c   d`";
  const out = compressList(raw);
  assert.ok(out.includes("[a  b](http://x  y)"));
  assert.ok(out.includes("`c   d`"));
});

test("[Z0.6] dedupes adjacent byte-identical list items", () => {
  const raw = "- same\n- same\n- other";
  assert.equal(compressList(raw), "- same\n- other");
});

test("[Z0.6] list compressor is monotone and idempotent", () => {
  const raw = "- foo     bar\n- baz   ";
  const once = compressList(raw);
  assert.ok(once.length <= raw.length);
  assert.equal(compressList(once), once);
});

// ── end-to-end via compile() ──────────────────────────────────────────────
test("[Z0.6] compile() compresses a padded table without losing content", () => {
  const md = "# T\n\n| name   | role     |\n|--------|----------|\n| alpha  | builder  |\n| beta   | tester   |\n";
  const out = compile(md);
  assert.ok(out.stats.saved > 0);
  assert.ok(out.lean.includes("alpha"));
  assert.ok(out.lean.includes("builder"));
  assert.ok(out.lean.includes("| --- | --- |"));
});
