// @ts-check
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const bin = path.resolve(__dirname, "..", "bin.js");

function invoke(args) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: path.resolve(__dirname, "..", ".."),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

const helpCases = [
  [["engine", "--help"], "harvest any repo into a deployable Solution Play"],
  [["config", "--help"], "Manage CLI preferences"],
  [["docs", "--help"], "Generate CLI reference docs"],
  [["e2e", "--help"], "12-scenario E2E CLI test suite"],
  [["update", "--help"], "newer version of the CLI on npm"],
];

for (const [args, expected] of helpCases) {
  test(`${args[0]} routes through the published binary`, () => {
    const result = invoke(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(expected, "i"));
  });
}

test("capabilities reports executable module evidence", () => {
  const result = invoke(["capabilities", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.summary.ready, 13);
  assert.equal(report.summary.partial, 1);
  assert.equal(report.summary.unavailable || 0, 0);
  assert.equal(report.summary.invalid || 0, 0);
});

test("structured error codes route without side effects", () => {
  const result = invoke(["errors", "codes", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const codes = JSON.parse(result.stdout);
  assert.ok(Array.isArray(codes));
  assert.ok(codes.some((entry) => entry.code === "AUTH_REQUIRED"));
});

test("Orchard browse remains on the A4 dispatcher", () => {
  const result = invoke(["orchard", "help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Browse, install, and contribute/);
  assert.match(result.stdout, /bushel/);
});