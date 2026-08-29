import * as assert from "node:assert/strict";
import { assertGitBlob, assertGitCommitSha, commitPreparedAssets, gitBlobSha } from "../accelerator-assets";

const bytes = Buffer.from("name: trusted-agent\n", "utf8");
const sha = gitBlobSha(bytes);
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(assertGitCommitSha("A".repeat(40)), "a".repeat(40));
assert.throws(() => assertGitCommitSha("main"), /immutable commit SHA/);
assert.doesNotThrow(() => assertGitBlob(bytes, sha, ".github/agents/trusted.agent.md"));
assert.throws(() => assertGitBlob(Buffer.from("mutated"), sha, ".github/agents/trusted.agent.md"), /immutable Git blob verification/);

const stored = new Map<string, Uint8Array>();
const removed: string[] = [];
const transactionOwned = new Set<string>();
assert.throws(() => commitPreparedAssets([
  { relative: ".github/one", target: "one", bytes: Buffer.from("one") },
  { relative: ".github/two", target: "two", bytes: Buffer.from("two") },
], {
  writeExclusive(target, content) {
    if (stored.has(target)) throw new Error("exclusive write conflict");
    transactionOwned.add(target);
    if (target === "two") { stored.set(target, content.subarray(0, Math.max(1, content.byteLength - 1))); throw new Error("simulated partial second-file failure"); }
    stored.set(target, content);
  },
  rollbackFailed(_relative, target) { if (transactionOwned.delete(target)) { stored.delete(target); removed.push(`failed:${target}`); } },
  rollback(_relative, target) { if (transactionOwned.delete(target)) { stored.delete(target); removed.push(`committed:${target}`); } },
}), /installation rolled back/);
assert.equal(stored.size, 0);
assert.deepEqual(removed, ["failed:two", "committed:one"]);

const successful = commitPreparedAssets([{ relative: ".github/ok", target: "ok", bytes }], {
  writeExclusive(target, content) { stored.set(target, content); },
  rollbackFailed(_relative, target) { stored.delete(target); },
  rollback(_relative, target) { stored.delete(target); },
});
assert.deepEqual(successful, [".github/ok"]);
assert.equal(stored.get("ok")?.toString(), bytes.toString());
console.log("Immutable accelerator asset and rollback tests passed");
