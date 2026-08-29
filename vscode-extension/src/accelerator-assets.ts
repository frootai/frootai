import { createHash } from "node:crypto";

export function assertGitCommitSha(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/i.test(value)) throw new Error("GitHub did not return an immutable commit SHA.");
  return value.toLowerCase();
}

export function gitBlobSha(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export function assertGitBlob(bytes: Uint8Array, expectedSha: unknown, label: string): void {
  const expected = typeof expectedSha === "string" && /^[a-f0-9]{40}$/i.test(expectedSha) ? expectedSha.toLowerCase() : "";
  if (!expected || gitBlobSha(bytes) !== expected) throw new Error(`${label} failed immutable Git blob verification.`);
}

export type PreparedAsset = { relative: string; target: string; bytes: Uint8Array };
export type AssetCommitOperations = {
  writeExclusive(target: string, bytes: Uint8Array): void;
  rollbackFailed(relative: string, target: string): void;
  rollback(relative: string, target: string): void;
};

export function commitPreparedAssets(items: PreparedAsset[], operations: AssetCommitOperations): string[] {
  const committed: PreparedAsset[] = [];
  try {
    for (const item of items) {
      try { operations.writeExclusive(item.target, item.bytes); }
      catch (error) {
        try { operations.rollbackFailed(item.relative, item.target); } catch { /* preserve the originating write failure */ }
        throw error;
      }
      committed.push(item);
    }
    return committed.map((item) => item.relative);
  } catch (error) {
    for (const item of committed.reverse()) {
      try { operations.rollback(item.relative, item.target); } catch { /* continue rolling back independently */ }
    }
    throw new Error(`Repository asset installation rolled back: ${error instanceof Error ? error.message : String(error)}`);
  }
}
