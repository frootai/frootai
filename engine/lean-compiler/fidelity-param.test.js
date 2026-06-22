/**
 * [Z1.3] Tests — Parameter / env / flag / path retention checker.
 *
 * Token-level (not line-level): verifies the exact --flag / $ENV_VAR /
 * SCREAMING_SNAKE / path survives into Lean even when the surrounding prose is
 * reworded, case-sensitively and boundary-aware. Includes a real-compiler check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkParamRetention, extractParams, tokenRetained } from "./fidelity-param.js";
import { compile } from "./index.js";

test("[Z1.3] extractParams finds flags, env refs, SCREAMING constants and paths", () => {
  const text = "Run with --write and --output-dir. Set $HOME and ${FROOT_API_KEY}. Edit src/app/page.tsx and ./config.json.";
  const t = extractParams(text);
  for (const expected of ["--write", "--output-dir", "HOME", "FROOT_API_KEY", "src/app/page.tsx", "./config.json"]) {
    assert.ok(t.has(expected), `missing ${expected}`);
  }
});

test("[Z1.3] $VAR and ${VAR} unify to the bare name", () => {
  const t = extractParams("$HOME and ${HOME} again");
  assert.equal(t.has("HOME"), true);
  assert.equal(t.size, 1);
});

test("[Z1.3] a SCREAMING tail of a flag is not double-counted", () => {
  const t = extractParams("--FOO_BAR enables it");
  assert.equal(t.has("--FOO_BAR"), true);
  assert.equal(t.has("FOO_BAR"), false);
  assert.equal(t.size, 1);
});

test("[Z1.3] full retention yields ratio 1 and no missing", () => {
  const full = "Set $FROOT_API_KEY, run --write, edit src/app/page.tsx.";
  const lean = "FROOT_API_KEY set; --write; src/app/page.tsx.";
  const r = checkParamRetention(full, lean);
  assert.equal(r.kind, "param");
  assert.equal(r.retained, r.total);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.3] a dropped env var is reported and lowers the ratio", () => {
  const full = "Needs $FROOT_API_KEY and $FROOT_REGION.";
  const lean = "Needs FROOT_API_KEY."; // FROOT_REGION dropped
  const r = checkParamRetention(full, lean);
  assert.equal(r.total, 2);
  assert.equal(r.retained, 1);
  assert.deepEqual(r.missing, ["FROOT_REGION"]);
  assert.equal(r.ratio, 0.5);
});

test("[Z1.3] matching is case-sensitive (--write ≠ --Write)", () => {
  const r = checkParamRetention("use --write", "use --Write");
  assert.equal(r.total, 1);
  assert.equal(r.retained, 0);
  assert.deepEqual(r.missing, ["--write"]);
});

test("[Z1.3] an inline token survives prose rewording (token-level advantage)", () => {
  const full = "It is important to set the FROOT_API_KEY environment variable before running.";
  const lean = "Set FROOT_API_KEY first.";
  const r = checkParamRetention(full, lean);
  assert.equal(r.total, 1);
  assert.equal(r.ratio, 1);
});

test("[Z1.3] boundary-aware: FROOT_API_KEY is not retained by FROOT_API_KEY_V2", () => {
  const r = checkParamRetention("Set FROOT_API_KEY.", "Set FROOT_API_KEY_V2.");
  assert.equal(r.retained, 0);
  assert.deepEqual(r.missing, ["FROOT_API_KEY"]);
});

test("[Z1.3] a path inside a URL is not mistaken for a param token", () => {
  const t = extractParams("See https://frootai.dev/docs/guide.html for details.");
  assert.equal(t.size, 0);
});

test("[Z1.3] no params in Full → vacuous pass (total 0, ratio 1)", () => {
  const r = checkParamRetention("Just explanatory prose with no tokens.", "");
  assert.equal(r.total, 0);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.3] checker is deterministic", () => {
  const full = "Set $FROOT_API_KEY and run --write.";
  const lean = "FROOT_API_KEY; --write.";
  assert.deepEqual(checkParamRetention(full, lean), checkParamRetention(full, lean));
});

test("[Z1.3] tokenRetained handles regex-special characters literally", () => {
  assert.equal(tokenRetained("./config.json", "edit ./config.json now"), true);
  assert.equal(tokenRetained("./config.json", "edit ./configxjson now"), false);
});

test("[Z1.3] our own Lean retains every parameter token (ratio 1)", () => {
  const full = [
    "# Deploy",
    "",
    "Set the FROOT_API_KEY environment variable and FROOT_REGION.",
    "",
    "Run the build with --write and --output-dir.",
    "",
    "Edit the src/app/config.ts file before deploying.",
  ].join("\n");
  const { lean } = compile(full);
  const r = checkParamRetention(full, lean);
  assert.equal(r.total > 0, true, "fixture should contain params");
  assert.deepEqual(r.missing, []);
  assert.equal(r.ratio, 1);
});
