// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const publish = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "publish-cli.yml"), "utf8");
const legacyPublish = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "npm-publish.yml"), "utf8");
const matrix = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "cli-smoke-matrix.yml"), "utf8");

function actionRefs(yaml) {
  return [...yaml.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
}

test("all third-party workflow actions are pinned to immutable SHAs", () => {
  for (const yaml of [publish, matrix]) {
    const refs = actionRefs(yaml);
    assert.ok(refs.length > 0);
    for (const ref of refs) assert.match(ref, /@[0-9a-f]{40}$/, `mutable action ref: ${ref}`);
  }
});

test("release workflow uses least privilege supported by the private repository plan", () => {
  assert.match(publish, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(publish, /persist-credentials:\s*false/g);
  assert.doesNotMatch(publish, /contents:\s*write|packages:\s*write|id-token:\s*write|attestations:\s*write|environment:\s*\n\s+name:\s*npm-production/);
});

test("release workflow builds, verifies, and retains one exact artifact", () => {
  assert.equal((publish.match(/enterprise-gate\.js --out-dir artifacts\/cli/g) || []).length, 1);
  assert.equal((publish.match(/upload-artifact@[0-9a-f]{40}/g) || []).length, 1);
  assert.doesNotMatch(publish, /attest-build-provenance|download-artifact/);
  assert.match(publish, /npm publish "\$tarball" --access public/);
  assert.doesNotMatch(publish, /npm publish[^\n]*--provenance/);
  assert.match(publish, /npm view "frootai@\$version" dist\.integrity/);
  assert.ok((publish.match(/sha256sum --check enterprise-release-evidence\.json\.sha256/g) || []).length >= 1);
  assert.doesNotMatch(publish, /enterprise-gate\.js[^\n]*--offline/);
});

test("publication is explicit, tag-bound, confirmed, and token-authenticated", () => {
  assert.match(publish, /GITHUB_REF_TYPE.*tag/);
  assert.match(publish, /github\.event_name == 'workflow_dispatch' && inputs\.publish == true/);
  assert.match(publish, /expected="publish frootai@\$version"/);
  assert.match(publish, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.doesNotMatch(publish, /github\.event_name == 'push'[^\n]*npm publish/);
});

test("legacy npm workflow cannot publish the CLI", () => {
  assert.doesNotMatch(legacyPublish, /cli-v\*/);
  assert.doesNotMatch(legacyPublish, /^\s{2}publish-cli:/m);
  assert.doesNotMatch(legacyPublish, /working-directory:\s*\.\/cli|npm view frootai version/);
  assert.doesNotMatch(legacyPublish, /^\s+id-token:\s*write/m);
});

test("enterprise publication is duplicate-safe and verifies eventual consistency", () => {
  assert.match(publish, /Exact frootai@\$version artifact is already published/);
  assert.match(publish, /previously published versions: \$version/);
  assert.match(publish, /for attempt in \$\(seq 1 12\)/);
  assert.match(publish, /npm view "frootai@\$version" dist\.integrity --prefer-online/);
});

test("release workflow binds tag, revision, online evidence, and eligibility", () => {
  assert.match(publish, /package_version=.*cli\/package\.json/);
  assert.match(publish, /tag_version=.*GITHUB_REF_NAME/);
  assert.match(publish, /e\.source\.sha !== process\.env\.GITHUB_SHA/);
  assert.match(publish, /e\.release_eligible !== true/);
  assert.match(publish, /e\.environment\.advisory_mode !== 'online'/);
});

test("cross-platform matrix covers supported platforms and enterprise denial", () => {
  for (const value of ["ubuntu-latest", "macos-latest", "windows-latest", "'18'", "'20'", "'22'"]) assert.ok(matrix.includes(value));
  assert.doesNotMatch(matrix, /frootai-core\//);
  assert.match(matrix, /frootai orchard help \| grep -i list/);
  assert.doesNotMatch(matrix, /frootai orchard --help \| grep -i list/);
  assert.match(matrix, /blocked by enterprise policy/);
  assert.match(matrix, /frootai audit verify --json/);
});