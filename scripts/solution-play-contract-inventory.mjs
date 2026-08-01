#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const contractFiles = {
  play_spec: path.join('spec', 'play-spec.json'),
  fai_manifest: path.join('spec', 'fai-manifest.json'),
  evidence_v1: path.join('certification', 'evidence.v1.json'),
};

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function collectFieldTypes(value, prefix = '', fields = new Map()) {
  if (prefix) {
    const types = fields.get(prefix) || new Set();
    types.add(valueType(value));
    fields.set(prefix, types);
  }

  if (Array.isArray(value)) {
    for (const item of value) collectFieldTypes(item, `${prefix}[]`, fields);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectFieldTypes(child, prefix ? `${prefix}.${key}` : key, fields);
    }
  }

  return fields;
}

function readJson(filePath) {
  try {
    return { document: JSON.parse(fs.readFileSync(filePath, 'utf8')), errors: [] };
  } catch (error) {
    return { document: null, errors: [`${filePath}: ${error.message}`] };
  }
}

function serializeFields(fields) {
  return Object.fromEntries(
    [...fields.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, types]) => [field, [...types].sort()]),
  );
}

function identityErrors(slug, documents) {
  const errors = [];
  const identities = {
    play_spec: documents.play_spec?.play || documents.play_spec?.name,
    fai_manifest: documents.fai_manifest?.play,
    evidence_v1: documents.evidence_v1?.subject?.slug,
  };

  for (const [contract, identity] of Object.entries(identities)) {
    if (identity !== slug) errors.push(`${slug}: ${contract} identity is ${JSON.stringify(identity)}`);
  }
  return errors;
}

export function inventoryContracts({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const playDirectories = fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2,3}-[a-z0-9-]+$/.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const fields = Object.fromEntries(Object.keys(contractFiles).map((contract) => [contract, new Map()]));
  const records = [];

  for (const entry of playDirectories) {
    const playRoot = path.join(playsRoot, entry.name);
    const documents = {};
    const errors = [];
    const files = {};

    for (const [contract, relativePath] of Object.entries(contractFiles)) {
      const filePath = path.join(playRoot, relativePath);
      files[contract] = relativePath.split(path.sep).join('/');
      if (!fs.existsSync(filePath)) {
        errors.push(`${entry.name}: missing ${files[contract]}`);
        continue;
      }
      const loaded = readJson(filePath);
      errors.push(...loaded.errors);
      if (loaded.document) {
        documents[contract] = loaded.document;
        collectFieldTypes(loaded.document, '', fields[contract]);
      }
    }

    errors.push(...identityErrors(entry.name, documents));
    records.push({ slug: entry.name, files, errors });
  }

  const duplicateSlugs = records
    .map((record) => record.slug)
    .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);
  const errors = [...records.flatMap((record) => record.errors), ...duplicateSlugs.map((slug) => `duplicate slug: ${slug}`)];

  return {
    schema_version: '1.0.0',
    mode: 'read-only',
    summary: {
      plays: records.length,
      valid: records.filter((record) => record.errors.length === 0).length,
      invalid: records.filter((record) => record.errors.length > 0).length,
      errors: errors.length,
    },
    contracts: Object.fromEntries(
      Object.entries(fields).map(([contract, contractFields]) => [contract, {
        file: contractFiles[contract].split(path.sep).join('/'),
        fields: serializeFields(contractFields),
      }]),
    ),
    records,
    errors,
  };
}

function main() {
  const inventory = inventoryContracts();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(inventory.summary)}\n`);
  }
  if (inventory.summary.invalid > 0 || inventory.summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();