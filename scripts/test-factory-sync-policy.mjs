import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/factory-sync.yml", import.meta.url), "utf8");

function actionReferences(source) {
  return [...source.matchAll(/\buses:\s+([^\s#]+)/g)].map((match) => match[1]);
}

test("Factory Sync uses only actions allowed by repository policy", () => {
  const actions = actionReferences(workflow);
  assert.ok(actions.length > 0, "workflow must reference actions");
  assert.deepEqual(actions.filter((action) => !action.startsWith("actions/")), []);
  assert.doesNotMatch(workflow, /peter-evans\/repository-dispatch/);
});

test("Factory Sync dispatches to core through GitHub-owned github-script", () => {
  assert.match(workflow, /actions\/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea/);
  assert.match(workflow, /github-token:\s*\$\{\{ secrets\.CORE_REPO_PAT \}\}/);
  assert.match(workflow, /github\.rest\.repos\.createDispatchEvent/);
  assert.match(workflow, /repo:\s*'frootai-core'/);
  assert.match(workflow, /event_type:\s*'public-repo-updated'/);
});

test("Factory Sync full audit honors split-repository ownership", () => {
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.full_audit == true/);
  assert.match(workflow, /node scripts\/build-solution-play-index\.mjs --check/);
  assert.match(workflow, /node scripts\/audit-froot-docs\.js/);
  assert.match(workflow, /node scripts\/validate-consistency\.js/);
  assert.doesNotMatch(workflow, /cd npm-mcp|cd vscode-extension|npm pack --dry-run/);
});
