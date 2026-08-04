import test from 'node:test';
import assert from 'node:assert/strict';

import { auditDocuments, labelUnlabeledCodeBlocks } from './audit-froot-docs-quality.mjs';

const report = auditDocuments();

test('quality report covers every authored canonical learning document', () => {
  assert.equal(report.documents.length, 19);
  assert.deepEqual(
    report.summary.types,
    { assessment: 1, reference: 2, specialty: 1, teaching: 15 },
  );
});

test('current hard quality guarantees remain regression-free', () => {
  assert.equal(report.summary.errors, 0);
  for (const document of report.documents) {
    assert.equal(document.hasLastUpdated, true, `${document.id} must retain Last Updated metadata`);
    assert.equal(document.hasVerification, true, `${document.id} must retain dated verification`);
    assert.equal(document.unlabeledCodeBlocks, 0, `${document.id} code fences must identify a language`);
    assert.ok(document.externalSources > 0, `${document.id} must cite at least one external authority`);
  }
});

test('quality report confirms the modernization queue is closed', () => {
  for (const field of ['learningOutcomes', 'prerequisites', 'diagrams', 'codeBlocks', 'scenarios', 'knowledgeChecks']) {
    assert.equal(typeof report.summary.coverage[field], 'number');
  }
  assert.equal(report.summary.warnings, 0);
});

test('code-fence formatter labels only unlabeled opening fences', () => {
  const input = 'Before\n```\nplain formula\n```\n\n```python\nprint("ok")\n```\n';
  assert.equal(
    labelUnlabeledCodeBlocks(input),
    'Before\n```text\nplain formula\n```\n\n```python\nprint("ok")\n```\n',
  );
});