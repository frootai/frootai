#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ruleNames = [
  'placeholder-marker',
  'copied-metrics',
  'broken-reference',
  'duplicate-id',
  'unsupported-claim',
];
const textExtensions = new Set([
  '.bicep', '.js', '.json', '.jsonl', '.md', '.mjs', '.ps1', '.py', '.sh',
  '.tf', '.ts', '.tsx', '.yaml', '.yml',
]);
const ignoredRelativePaths = new Set([
  'certification/evidence.v1.json',
  'certification/evidence.v2.json',
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function listPlayDirectories(playsRoot) {
  return fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2,3}-[a-z0-9-]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function readJson(filePath) {
  try {
    return { document: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { document: null, error: error.message };
  }
}

function walkTextFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkTextFiles(absolute));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files.sort();
}

function markerFindings(playRoot, slug) {
  const findings = [];
  for (const filePath of walkTextFiles(playRoot)) {
    const relativePath = toPosix(path.relative(playRoot, filePath));
    if (ignoredRelativePaths.has(relativePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      for (const match of line.matchAll(/\b(TODO|TBD|placeholder|customer-specific)\b/gi)) {
        findings.push({
          rule: 'placeholder-marker',
          play: slug,
          path: relativePath,
          marker: match[1].toLowerCase(),
          content: line.trim().replace(/\s+/g, ' '),
        });
      }
    }
  }
  return findings;
}

function manifestReferences(manifest) {
  const references = [];
  for (const category of ['agents', 'instructions', 'skills', 'hooks', 'workflows']) {
    for (const value of manifest.primitives?.[category] || []) references.push({ category, value });
  }
  for (const category of ['infrastructure', 'toolkit']) {
    for (const value of Object.values(manifest[category] || {})) {
      if (typeof value === 'string') references.push({ category, value });
    }
  }
  return references;
}

function referenceFindings(playRoot, slug) {
  const manifestPath = path.join(playRoot, 'spec', 'fai-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return [{ rule: 'broken-reference', play: slug, path: 'spec/fai-manifest.json', reference: 'missing manifest' }];
  }
  const loaded = readJson(manifestPath);
  if (!loaded.document) {
    return [{ rule: 'broken-reference', play: slug, path: 'spec/fai-manifest.json', reference: `invalid JSON: ${loaded.error}` }];
  }
  return manifestReferences(loaded.document)
    .filter(({ value }) => !/^[a-z][a-z0-9+.-]*:/i.test(value) && !fs.existsSync(path.resolve(playRoot, value)))
    .map(({ category, value }) => ({
      rule: 'broken-reference',
      play: slug,
      path: 'spec/fai-manifest.json',
      category,
      reference: value,
    }));
}

function claimFindings(playRoot, slug) {
  const specPath = path.join(playRoot, 'spec', 'play-spec.json');
  if (!fs.existsSync(specPath)) return [];
  const loaded = readJson(specPath);
  if (!loaded.document || loaded.document.schema_version !== '2.0.0') return [];
  const findings = [];
  for (const [index, source] of (loaded.document.official_sources || []).entries()) {
    if (!source.claim?.trim()) {
      findings.push({ rule: 'unsupported-claim', play: slug, source: index, reason: 'claim is missing' });
    }
    if (source.status === 'deprecated') {
      findings.push({ rule: 'unsupported-claim', play: slug, source: index, reason: 'source is deprecated' });
    }
    if (/^(latest|current|unknown|unversioned|n\/?a)$/i.test(source.tested_version || '')) {
      findings.push({ rule: 'unsupported-claim', play: slug, source: index, reason: 'tested_version is not immutable' });
    }
  }
  return findings;
}

function metricSignature(playRoot) {
  const specPath = path.join(playRoot, 'spec', 'play-spec.json');
  if (!fs.existsSync(specPath)) return null;
  const loaded = readJson(specPath);
  if (!loaded.document?.evaluation) return null;
  const evaluation = loaded.document.evaluation;
  return stableJson({ metrics: evaluation.metrics || [], thresholds: evaluation.thresholds || {} });
}

function copiedMetricFindings(metricGroups) {
  return [...metricGroups.entries()]
    .filter(([, plays]) => plays.length > 1)
    .map(([signature, plays]) => ({
      rule: 'copied-metrics',
      signature_sha256: sha256(signature),
      plays: [...plays].sort(),
    }));
}

function duplicateIdFindings(directories) {
  const groups = new Map();
  for (const directory of directories) {
    const numericId = Number(directory.match(/^(\d{2,3})-/)[1]);
    const values = groups.get(numericId) || [];
    values.push(directory);
    groups.set(numericId, values);
  }
  return [...groups.entries()]
    .filter(([, plays]) => plays.length > 1)
    .map(([numericId, plays]) => ({ rule: 'duplicate-id', numeric_id: numericId, plays: [...plays].sort() }));
}

function sortFindings(findings) {
  return findings.sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

export function auditSolutionPlayQuality({ repoRoot = repositoryRoot } = {}) {
  const playsRoot = path.join(repoRoot, 'solution-plays');
  const directories = listPlayDirectories(playsRoot);
  const metricGroups = new Map();
  const findings = [];

  for (const slug of directories) {
    const playRoot = path.join(playsRoot, slug);
    findings.push(...markerFindings(playRoot, slug));
    findings.push(...referenceFindings(playRoot, slug));
    findings.push(...claimFindings(playRoot, slug));
    const signature = metricSignature(playRoot);
    if (signature) {
      const plays = metricGroups.get(signature) || [];
      plays.push(slug);
      metricGroups.set(signature, plays);
    }
  }

  findings.push(...copiedMetricFindings(metricGroups));
  findings.push(...duplicateIdFindings(directories));
  sortFindings(findings);

  return {
    schema_version: '1.0.0',
    rules_version: '1.0.0',
    play_count: directories.length,
    summary: Object.fromEntries(ruleNames.map((rule) => [rule, findings.filter((finding) => finding.rule === rule).length])),
    findings,
  };
}

export function buildQualityBaseline(report) {
  return {
    schema_version: '1.0.0',
    rules_version: report.rules_version,
    play_count: report.play_count,
    categories: Object.fromEntries(ruleNames.map((rule) => {
      const findings = report.findings.filter((finding) => finding.rule === rule);
      return [rule, { count: findings.length, sha256: sha256(stableJson(findings)) }];
    })),
  };
}

export function compareQualityBaseline(report, baseline) {
  const current = buildQualityBaseline(report);
  const violations = [];
  if (baseline?.schema_version !== current.schema_version) violations.push('quality baseline schema_version differs');
  if (baseline?.rules_version !== current.rules_version) violations.push('quality baseline rules_version differs');
  if (baseline?.play_count !== current.play_count) violations.push(`play count changed: baseline=${baseline?.play_count} current=${current.play_count}`);
  for (const rule of ruleNames) {
    const expected = baseline?.categories?.[rule];
    const actual = current.categories[rule];
    if (!expected || expected.count !== actual.count || expected.sha256 !== actual.sha256) {
      violations.push(`${rule} debt changed: baseline=${expected?.count ?? 'missing'} current=${actual.count}`);
    }
  }
  return { current, violations };
}

export function assertSolutionPlayQuality({
  repoRoot = repositoryRoot,
  baselinePath = path.join(repoRoot, 'data', 'solution-play-quality-baseline.v1.json'),
} = {}) {
  if (!fs.existsSync(baselinePath)) throw new Error(`Solution Play quality baseline is missing: ${baselinePath}`);
  const report = auditSolutionPlayQuality({ repoRoot });
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const comparison = compareQualityBaseline(report, baseline);
  if (comparison.violations.length) {
    throw new Error(`Solution Play quality gate failed:\n- ${comparison.violations.join('\n- ')}`);
  }
  return report;
}

function parseArgs(argv) {
  const rootArg = argv.find((argument) => argument.startsWith('--repo-root='));
  return {
    repoRoot: rootArg ? path.resolve(rootArg.slice('--repo-root='.length)) : repositoryRoot,
    strict: argv.includes('--strict'),
    writeBaseline: argv.includes('--write-baseline'),
    json: argv.includes('--json'),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = auditSolutionPlayQuality({ repoRoot: options.repoRoot });
  const baselinePath = path.join(options.repoRoot, 'data', 'solution-play-quality-baseline.v1.json');
  if (options.writeBaseline) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, `${JSON.stringify(buildQualityBaseline(report), null, 2)}\n`, 'utf8');
    process.stdout.write(`Wrote ${baselinePath}\n`);
    return;
  }

  let violations;
  if (options.strict) {
    violations = ruleNames
      .filter((rule) => report.summary[rule] > 0)
      .map((rule) => `${rule}: ${report.summary[rule]}`);
  } else if (!fs.existsSync(baselinePath)) {
    violations = [`quality baseline is missing: ${baselinePath}`];
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    violations = compareQualityBaseline(report, baseline).violations;
  }

  process.stdout.write(`${JSON.stringify(options.json ? report : { play_count: report.play_count, summary: report.summary, violations }, null, options.json ? 2 : 0)}\n`);
  if (violations.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();