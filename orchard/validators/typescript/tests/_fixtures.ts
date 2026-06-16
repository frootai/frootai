/**
 * Shared fixtures. vitest doesn't have a conftest.py equivalent; each test file
 * imports from here.
 *
 * Path constants resolve to the canonical frootai/orchard/schema/ folder — same
 * source the Python validator + JS smoke test use.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_DIR = join(HERE, '..', '..', '..', 'schema');

const ACCELERATOR_SCHEMA_PATH = join(SCHEMA_DIR, 'fai-accelerator.schema.json');
const MANIFEST_SCHEMA_PATH = join(SCHEMA_DIR, 'fai-manifest.schema.json');
const EXAMPLES_PATH = join(SCHEMA_DIR, 'fai-accelerator.example.json');

function loadJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf-8')) as T;
}

export const ACCELERATOR_SCHEMA = loadJson<Record<string, unknown>>(ACCELERATOR_SCHEMA_PATH);
export const MANIFEST_SCHEMA = loadJson<Record<string, unknown>>(MANIFEST_SCHEMA_PATH);
export const ALL_EXAMPLES = loadJson<Record<string, unknown>[]>(EXAMPLES_PATH);

/** Deep clone of example #1: clean harvested Azure fruit. Mutate freely. */
export function harvestedExample(): Record<string, unknown> {
  return structuredClone(ALL_EXAMPLES[0]!);
}

/** Deep clone of example #4: clean cultivated Azure fruit. Mutate freely. */
export function cultivatedExample(): Record<string, unknown> {
  return structuredClone(ALL_EXAMPLES[3]!);
}

/** Deep clone of example #5: clean first_party Azure fruit. Mutate freely. */
export function firstPartyExample(): Record<string, unknown> {
  return structuredClone(ALL_EXAMPLES[4]!);
}
