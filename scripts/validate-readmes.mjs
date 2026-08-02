#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sourceFiles = {
  package: path.join('npm-mcp', 'package.json'),
  index: path.join('npm-mcp', 'index.js'),
};

const readmeFiles = [
  'README.md',
  path.join('npm-mcp', 'README.md'),
  path.join('vscode-extension', 'README.md'),
  path.join('docs', 'README.md'),
  path.join('solution-plays', 'README.md'),
];

function readOptional(root, relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

export function validateReadmes({ root = repositoryRoot } = {}) {
  const packageSource = readOptional(root, sourceFiles.package);
  const indexSource = readOptional(root, sourceFiles.index);
  const mcpPackage = packageSource === null ? null : JSON.parse(packageSource);
  const mcpVersion = mcpPackage?.version || null;
  const toolCount = indexSource === null ? null : (indexSource.match(/server\.tool\(/g) || []).length;
  const warnings = [];
  const checked = [];

  for (const relativePath of readmeFiles) {
    const content = readOptional(root, relativePath);
    if (content === null) continue;
    checked.push(relativePath.split(path.sep).join('/'));

    if (mcpVersion !== null) {
      for (const reference of content.match(/frootai-mcp@(\d+\.\d+\.\d+)/g) || []) {
        const version = reference.split('@')[1];
        if (version !== mcpVersion) warnings.push(`${relativePath}: stale version ${reference} (current: @${mcpVersion})`);
      }
    }

    if (toolCount !== null) {
      for (const reference of content.match(/(\d+)\s+tools/g) || []) {
        const count = Number.parseInt(reference, 10);
        if (count > 10 && count !== toolCount) warnings.push(`${relativePath}: tool count ${reference} (actual: ${toolCount} tools)`);
      }
    }
  }

  return {
    schema_version: '1.0.0',
    checked,
    sources: {
      mcp_package: mcpVersion === null ? 'unavailable' : 'available',
      mcp_index: toolCount === null ? 'unavailable' : 'available',
    },
    mcp_version: mcpVersion,
    tool_count: toolCount,
    warnings,
  };
}

function main() {
  const result = validateReadmes();
  for (const warning of result.warnings) process.stderr.write(`::warning::${warning}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();