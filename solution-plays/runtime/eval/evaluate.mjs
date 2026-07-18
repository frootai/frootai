#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const get = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const origin = get('origin');
  const dataset = get('dataset');
  const out = get('out');
  if (!origin || !dataset) throw new Error('Provide --origin=<url> and --dataset=<jsonl>');
  return { origin: origin.replace(/\/$/, ''), dataset: path.resolve(dataset), out: out ? path.resolve(out) : null };
}

function compare(actual, expected, prefix = '') {
  const failures = [];
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    for (const [key, value] of Object.entries(expected)) failures.push(...compare(actual?.[key], value, prefix ? `${prefix}.${key}` : key));
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) failures.push(`${prefix} must be an array`);
    else for (const item of expected) if (!actual.some((candidate) => JSON.stringify(candidate).includes(String(item)))) failures.push(`${prefix} missing ${JSON.stringify(item)}`);
  } else if (actual !== expected) failures.push(`${prefix}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return failures;
}

export async function evaluate({ origin, dataset }) {
  const cases = fs.readFileSync(dataset, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch (error) { throw new Error(`Invalid JSONL line ${index + 1}: ${error.message}`); }
  });
  if (!cases.length) throw new Error('Evaluation dataset is empty');
  const results = [];
  for (const item of cases) {
    if (!item.id || !item.scenario || !item.input || !item.expected) throw new Error(`Case ${item.id || 'unknown'} is missing required fields`);
    const started = performance.now();
    const response = await fetch(`${origin}/v1/scenarios/${encodeURIComponent(item.scenario)}/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-correlation-id': `eval-${item.id}` }, body: JSON.stringify(item.input),
    });
    const body = await response.json();
    const latencyMs = performance.now() - started;
    const failures = response.ok ? compare(body.output, item.expected) : [`HTTP ${response.status}: ${body.error?.code}`];
    results.push({ id: item.id, scenario: item.scenario, passed: failures.length === 0, failures, latency_ms: Math.round(latencyMs), output_hash: body.canonicalOutputHash || null });
  }
  return {
    schema_version: '1.0.0', dataset, cases: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    pass_rate: results.filter((item) => item.passed).length / results.length,
    latency_p95_ms: results.map((item) => item.latency_ms).sort((a, b) => a - b)[Math.max(0, Math.ceil(results.length * 0.95) - 1)],
    results,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await evaluate(options);
  const content = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, content, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({ cases: report.cases, passed: report.passed, failed: report.failed, pass_rate: report.pass_rate, latency_p95_ms: report.latency_p95_ms })}\n`);
  if (report.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
