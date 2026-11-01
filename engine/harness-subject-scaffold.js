import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const KINDS = new Set(['agent', 'product', 'platform']);
const DEFAULT_WAF = {
  agent: ['security', 'responsible-ai'],
  product: ['security', 'operational-excellence'],
  platform: ['security', 'reliability', 'operational-excellence']
};

function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function scaffoldHarnessSubject({ repoRoot, subject, kind, root, owner, description, write = false }) {
  const absoluteRoot = resolve(repoRoot);
  const errors = [];
  if (typeof subject !== 'string' || !/^[a-z][a-z0-9-]*$/.test(subject)) errors.push('subject must be kebab-case');
  if (!KINDS.has(kind)) errors.push('kind must be agent, product, or platform');
  if (typeof root !== 'string' || !root || root.split(/[\\/]/).includes('..') || isAbsolute(root)) errors.push('root must be repository-relative without parent traversal');
  const subjectRoot = resolve(absoluteRoot, root || '.');
  if (!within(absoluteRoot, subjectRoot) || !existsSync(subjectRoot)) errors.push(`subject root does not exist: ${root}`);
  if (!existsSync(resolve(subjectRoot, 'README.md'))) errors.push(`subject root requires README.md: ${root}`);
  if (typeof owner !== 'string' || owner.trim().length < 2) errors.push('owner must have at least 2 characters');
  if (typeof description !== 'string' || description.trim().length < 10) errors.push('description must have at least 10 characters');

  const descriptorPath = resolve(absoluteRoot, 'harness', 'subjects', `${subject}.json`);
  if (!within(absoluteRoot, descriptorPath)) errors.push('descriptor path escapes repository');
  if (!write) {
    try {
      const existing = openSync(descriptorPath, 'r');
      closeSync(existing);
      errors.push(`subject descriptor already exists: harness/subjects/${subject}.json`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const descriptor = {
    $schema: '../../schemas/fai-harness-subject.schema.json',
    subject,
    display_name: subject.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    kind,
    version: '1.0.0',
    root: root.replaceAll('\\', '/'),
    owner: owner.trim(),
    description: description.trim(),
    context: { knowledge: ['F1-GenAI-Foundations'], waf: DEFAULT_WAF[kind] ?? ['security'] },
    primitives: {},
    requires: { paths: ['README.md'] }
  };
  if (write && errors.length === 0) {
    mkdirSync(resolve(absoluteRoot, 'harness', 'subjects'), { recursive: true });
    let descriptorFile;
    try {
      descriptorFile = openSync(descriptorPath, 'wx', 0o600);
      writeFileSync(descriptorFile, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      errors.push(`subject descriptor already exists: harness/subjects/${subject}.json`);
    } finally {
      if (descriptorFile !== undefined) closeSync(descriptorFile);
    }
  }
  return { descriptor, descriptorPath, errors, written: write && errors.length === 0 };
}

export { scaffoldHarnessSubject };
