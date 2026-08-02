import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public factory dispatches read-only core contract verification", async () => {
  const source = await readFile(new URL("../.github/workflows/factory.yml", import.meta.url), "utf8");
  assert.match(source, /verify-core-contract:/);
  assert.match(source, /needs: factory/);
  assert.match(source, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /repo: 'frootai-core'/);
  assert.match(source, /event_type: 'public-repo-updated'/);
  assert.match(source, /contract: 'factory-split-repo-v1'/);
  assert.match(source, /secrets\.CORE_REPO_PAT/);
  const pushBlock = source.slice(source.indexOf("  push:"), source.indexOf("permissions:"));
  assert.match(pushBlock, /- 'marketplace\.json'/);
});