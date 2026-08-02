import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateReadmes } from './validate-readmes.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-readmes-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return root;
}

test('split repository reports unavailable MCP sources without failing README checks', (t) => {
  const root = fixture({ 'README.md': '# FrootAI\n' });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = validateReadmes({ root });
  assert.deepEqual(result.checked, ['README.md']);
  assert.deepEqual(result.sources, { mcp_package: 'unavailable', mcp_index: 'unavailable' });
  assert.equal(result.mcp_version, null);
  assert.equal(result.tool_count, null);
  assert.deepEqual(result.warnings, []);
});

test('available MCP sources produce deterministic stale-claim warnings', (t) => {
  const root = fixture({
    'README.md': 'Install frootai-mcp@1.0.0 with 99 tools.\n',
    'npm-mcp/package.json': '{"version":"2.0.0"}\n',
    'npm-mcp/index.js': 'server.tool(\"one\");\nserver.tool(\"two\");\n',
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = validateReadmes({ root });
  assert.deepEqual(result.sources, { mcp_package: 'available', mcp_index: 'available' });
  assert.equal(result.mcp_version, '2.0.0');
  assert.equal(result.tool_count, 2);
  assert.deepEqual(result.warnings, [
    'README.md: stale version frootai-mcp@1.0.0 (current: @2.0.0)',
    'README.md: tool count 99 tools (actual: 2 tools)',
  ]);
});

test('malformed present package metadata fails closed', (t) => {
  const root = fixture({
    'README.md': '# FrootAI\n',
    'npm-mcp/package.json': '{not-json}\n',
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => validateReadmes({ root }), SyntaxError);
});