#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256, stableJson } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(repositoryRoot, 'data', 'mcp', 'transport-validation-policy.v1.json');
let policyValidator;

function readJson(filePath) {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error(`MCP transport validation source must be a regular file: ${path.basename(filePath)}`);
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } finally {
    fs.closeSync(descriptor);
  }
}

function compilePolicyValidator() {
  if (policyValidator) return policyValidator;
  const schema = readJson(path.join(repositoryRoot, 'schemas', 'solution-play-mcp-transport-validation.v1.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  policyValidator = ajv.compile(schema);
  return policyValidator;
}

function installedVersion(packageName) {
  return readJson(path.join(repositoryRoot, 'node_modules', ...packageName.split('/'), 'package.json')).version;
}

function supportedNodeVersion() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  return major === 22 && (minor > 7 || minor === 7 && patch >= 5);
}

export function validateMcpTransportValidationPolicy(document) {
  const validate = compilePolicyValidator();
  const errors = validate(document) ? [] : validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`);
  if (errors.length === 0) {
    if (!supportedNodeVersion()) errors.push(`T226 official tools require Node ${document.execution.node_version_range}; found ${process.versions.node}`);
    const utilities = readJson(path.join(repositoryRoot, 'data', 'mcp', 'utilities-policy.v1.json'));
    if (sha256(stableJson(utilities)) !== document.utilities_policy_sha256) errors.push('MCP transport policy does not bind the canonical utilities policy');
    for (const tool of [document.tooling.inspector, document.tooling.conformance, document.tooling.embedded_sdk, document.tooling.patched_dependency]) {
      try {
        if (installedVersion(tool.package) !== tool.version) errors.push(`installed MCP tool version drifted: ${tool.package}`);
      } catch (error) {
        errors.push(`installed MCP tool is unavailable: ${tool.package} (${error.message})`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildMcpTransportValidationPlan(document) {
  const validation = validateMcpTransportValidationPolicy(document);
  if (!validation.valid) throw new Error(`MCP transport validation policy invalid: ${validation.errors.join('; ')}`);
  const plan = {
    schema_version: document.schema_version,
    task: document.task,
    current: {
      protocol_version: document.protocol_version,
      node_version_range: document.execution.node_version_range,
      transports: [...document.execution.transports],
      methods: [...document.execution.current_protocol_methods],
      evidence: document.boundaries.current_protocol_claim,
    },
    compatibility: {
      protocol_version: document.execution.compatibility_protocol_version,
      inspector: `${document.tooling.inspector.package}@${document.tooling.inspector.version}`,
      conformance: `${document.tooling.conformance.package}@${document.tooling.conformance.version}`,
      scenarios: [...document.execution.official_conformance_scenarios],
      evidence: document.boundaries.official_tool_claim,
    },
    security: structuredClone(document.security),
    boundaries: structuredClone(document.boundaries),
  };
  return { ...plan, policy_sha256: sha256(stableJson(document)), plan_sha256: sha256(stableJson(plan)) };
}

export function loadDefaultMcpTransportValidationPolicy() {
  return readJson(policyPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = buildMcpTransportValidationPlan(loadDefaultMcpTransportValidationPolicy());
    process.stdout.write(stableJson({ status: 'valid', task: plan.task, current_protocol_version: plan.current.protocol_version, current_transports: plan.current.transports, current_methods: plan.current.methods, compatibility_protocol_version: plan.compatibility.protocol_version, inspector: plan.compatibility.inspector, conformance: plan.compatibility.conformance, conformance_scenarios: plan.compatibility.scenarios, full_conformance_claimed: plan.boundaries.full_conformance_claimed, production_server_claimed: plan.boundaries.production_server_claimed, canonical_writes_allowed: plan.boundaries.canonical_writes_allowed, publication_allowed: plan.boundaries.publication_allowed, policy_sha256: plan.policy_sha256, plan_sha256: plan.plan_sha256 }));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}