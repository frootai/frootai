import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scaffoldHarnessSubject } from './harness-subject-scaffold.js';

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-scaffold-subject-')));
  fs.mkdirSync(path.join(root, 'products', 'new-product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'products', 'new-product', 'README.md'), '# New Product\n');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('new product descriptor inherits the platform kind default by omission', (t) => {
  const root = fixture(t);
  const input = { repoRoot: root, subject: 'new-product', kind: 'product', root: 'products/new-product', owner: 'Product team', description: 'A newly registered FAI product.' };
  const preview = scaffoldHarnessSubject(input);
  assert.equal(preview.written, false);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.descriptor.extends, undefined);
  assert.equal(preview.descriptor.display_name, 'New Product');
  assert.deepEqual(preview.descriptor.context.waf, ['security', 'operational-excellence']);
  const written = scaffoldHarnessSubject({ ...input, write: true });
  assert.equal(written.written, true);
  assert.equal(fs.existsSync(written.descriptorPath), true);
  assert.match(fs.readFileSync(written.descriptorPath, 'utf8'), /"subject": "new-product"/);
});

test('unsafe roots and duplicate subjects fail closed', (t) => {
  const root = fixture(t);
  const base = { repoRoot: root, subject: 'new-product', kind: 'product', root: '../outside', owner: 'Product team', description: 'A newly registered FAI product.', write: true };
  assert.match(scaffoldHarnessSubject(base).errors.join('\n'), /root/);
  const valid = { ...base, root: 'products/new-product' };
  assert.equal(scaffoldHarnessSubject(valid).written, true);
  assert.match(scaffoldHarnessSubject(valid).errors.join('\n'), /already exists/);
});
