/**
 * [Z0.12] Tests — CLI.
 *
 * Row literal: "CLI `node engine/lean-compiler/cli.mjs <path>` for local runs".
 *
 * Driven through the exported `runCli(args, io)` with injected IO so no process
 * is spawned and no disk is touched.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli, parseArgs, HELP } from "./cli.mjs";

const SAMPLE = `# T

It is important to note that this is a very verbose paragraph.

You MUST never log secrets.
`;

/** Build an IO harness that records output and serves a fixed file. */
function harness(files = { "in.md": SAMPLE }) {
  const out = [];
  const errs = [];
  const written = {};
  const io = {
    log: (...m) => out.push(m.join(" ")),
    error: (...m) => errs.push(m.join(" ")),
    readFile: (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    },
    writeFile: (p, c) => {
      written[p] = c;
    },
  };
  return { io, out, errs, written };
}

test("[Z0.12] parseArgs separates paths from flags", () => {
  const o = parseArgs(["a.md", "-w", "--type", "skill", "b.md"]);
  assert.deepEqual(o.paths, ["a.md", "b.md"]);
  assert.equal(o.write, true);
  assert.equal(o.type, "skill");
});

test("[Z0.12] no args prints help and returns 1", () => {
  const h = harness();
  const code = runCli([], h.io);
  assert.equal(code, 1);
  assert.ok(h.out.join("\n").includes("Usage:"));
});

test("[Z0.12] --help returns 0 and prints usage", () => {
  const h = harness();
  assert.equal(runCli(["--help"], h.io), 0);
  assert.ok(h.out.join("\n").includes("lean-compiler"));
});

test("[Z0.12] unknown option returns 1", () => {
  const h = harness();
  assert.equal(runCli(["in.md", "--nope"], h.io), 1);
  assert.ok(h.errs.join("\n").includes("unknown option"));
});

test("[Z0.12] default mode prints a per-file savings summary", () => {
  const h = harness();
  assert.equal(runCli(["in.md"], h.io), 0);
  const line = h.out.join("\n");
  assert.ok(line.includes("in.md"));
  assert.ok(/tok/.test(line));
  assert.ok(/bytes/.test(line));
});

test("[Z0.12] --stdout prints the Lean markdown", () => {
  const h = harness();
  assert.equal(runCli(["in.md", "--stdout"], h.io), 0);
  const text = h.out.join("\n");
  assert.ok(text.includes("You MUST never log secrets.")); // behaviour preserved
  assert.ok(!text.includes("It is important to note")); // prose compressed
});

test("[Z0.12] --json prints a parseable sidecar", () => {
  const h = harness();
  assert.equal(runCli(["in.md", "--json"], h.io), 0);
  const obj = JSON.parse(h.out.join("\n"));
  assert.ok(obj.tokens > 0);
  assert.ok(obj.saved >= 0);
  assert.ok(Array.isArray(obj.stages));
});

test("[Z0.12] --write emits .lean.md + .lean.json next to the source", () => {
  const h = harness();
  assert.equal(runCli(["dir/SKILL.md", "--write"], { ...h.io, readFile: () => SAMPLE }), 0);
  assert.ok("dir/SKILL.lean.md" in h.written);
  assert.ok("dir/SKILL.lean.json" in h.written);
  assert.ok(h.written["dir/SKILL.lean.md"].includes("You MUST never log secrets."));
  assert.ok(h.written["dir/SKILL.lean.json"].endsWith("\n"));
});

test("[Z0.12] --stdout with multiple inputs is rejected", () => {
  const h = harness();
  assert.equal(runCli(["a.md", "b.md", "--stdout"], h.io), 1);
  assert.ok(h.errs.join("\n").includes("single input"));
});

test("[Z0.12] a read failure reports the path and returns 1", () => {
  const h = harness();
  assert.equal(runCli(["missing.md"], h.io), 1);
  assert.ok(h.errs.join("\n").includes("cannot read missing.md"));
});

test("[Z0.12] --check passes for a fixed-point input", () => {
  const h = harness();
  assert.equal(runCli(["in.md", "--check", "--quiet"], h.io), 0);
  assert.equal(h.errs.length, 0);
});

test("[Z0.12] HELP text documents the core flags", () => {
  for (const flag of ["--write", "--stdout", "--json", "--type", "--check", "--quiet"]) {
    assert.ok(HELP.includes(flag), `HELP should mention ${flag}`);
  }
});
