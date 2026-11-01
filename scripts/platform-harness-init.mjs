#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldHarnessSubject } from '../engine/harness-subject-scaffold.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const result = scaffoldHarnessSubject({
  repoRoot,
  subject: value('id'),
  kind: value('kind'),
  root: value('root'),
  owner: value('owner'),
  description: value('description'),
  write: args.includes('--write')
});
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`x ${error}`);
  console.error('Usage: npm run platform:harness:init -- --id <id> --kind <agent|product|platform> --root <path> --owner <owner> --description <text> [--write]');
  process.exit(1);
}
console.log(JSON.stringify(result.descriptor, null, 2));
console.log(result.written ? `Wrote ${path.relative(repoRoot, result.descriptorPath)}` : 'Preview only; add --write to register this subject.');
