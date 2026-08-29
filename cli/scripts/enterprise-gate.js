#!/usr/bin/env node
// @ts-check
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  buildEvidence,
  digestFile,
  digestJson,
  inventoryDigest,
  verifyEvidence,
} = require("../lib/release/enterprise-evidence");
const { POLICY_VERSION } = require("../lib/security/command-policy");

const CLI_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLI_ROOT, "..");
const NPM = "npm";

function parseArgs(argv) {
  const out = { outDir: null, json: false, offline: false, verify: null, tarball: null };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out-dir" && argv[index + 1]) out.outDir = path.resolve(argv[++index]);
    else if (arg === "--verify" && argv[index + 1]) out.verify = path.resolve(argv[++index]);
    else if (arg === "--tarball" && argv[index + 1]) out.tarball = path.resolve(argv[++index]);
    else if (arg === "--json") out.json = true;
    else if (arg === "--offline") out.offline = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function run(executable, args, options = {}) {
  const started = process.hrtime.bigint();
  let command = executable;
  let commandArgs = args;
  if (process.platform === "win32" && executable === NPM) {
    command = process.env.ComSpec || "cmd.exe";
    commandArgs = ["/d", "/s", "/c", "npm", ...args];
  }
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    maxBuffer: 20 * 1024 * 1024,
  });
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "", error: result.error ? result.error.message : null, durationMs: Math.round(durationMs) };
}

function requireSuccess(result, label) {
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}): ${result.error || result.stderr || result.stdout}`);
  return result;
}

function parseJsonOutput(result, label) {
  requireSuccess(result, label);
  try { return JSON.parse(result.stdout); }
  catch (error) { throw new Error(`${label} emitted invalid JSON: ${error.message}`); }
}

function sourceSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const result = run("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function runVerifyMode(args) {
  if (!args.verify || !args.tarball) throw new Error("--verify requires --tarball");
  const evidence = JSON.parse(fs.readFileSync(args.verify, "utf8"));
  const result = verifyEvidence(evidence, args.tarball);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write("Usage: enterprise-gate [--out-dir <dir>] [--offline] [--json]\n       enterprise-gate --verify <evidence.json> --tarball <package.tgz>\n");
    return 0;
  }
  if (args.verify) return runVerifyMode(args);

  const ownedTemp = !args.outDir;
  const outDir = args.outDir || fs.mkdtempSync(path.join(os.tmpdir(), "frootai-enterprise-gate-"));
  const installRoot = path.join(outDir, "isolated-install");
  const runtimeHome = path.join(outDir, "runtime-home");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(runtimeHome, { recursive: true });
  const gates = [];
  const gate = (id, ok, detail) => gates.push({ id, ok: ok === true, detail });

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(CLI_ROOT, "package.json"), "utf8"));
    const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare"].filter((name) => packageJson.scripts && packageJson.scripts[name]);
    const unsupportedProvenance = packageJson.publishConfig?.provenance === true;
    gate("metadata", packageJson.name === "frootai" && unsupportedProvenance === false && lifecycleScripts.length === 0, {
      name: packageJson.name, version: packageJson.version, node: packageJson.engines?.node, provenance_requested: unsupportedProvenance, lifecycle_scripts: lifecycleScripts,
    });

    const pack = parseJsonOutput(run(NPM, ["pack", "--json", "--pack-destination", outDir], { cwd: CLI_ROOT }), "npm pack")[0];
    const tarballPath = path.join(outDir, pack.filename);
    gate("package-size", pack.size <= MAX_PACKED_BYTES && pack.unpackedSize <= MAX_UNPACKED_BYTES, { packed_bytes: pack.size, unpacked_bytes: pack.unpackedSize, max_packed_bytes: MAX_PACKED_BYTES, max_unpacked_bytes: MAX_UNPACKED_BYTES });

    requireSuccess(run(NPM, ["install", "--prefix", installRoot, "--ignore-scripts", "--no-audit", "--no-fund", tarballPath]), "isolated tarball install");
    const installedRoot = path.join(installRoot, "node_modules", "frootai");
    const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, "package.json"), "utf8"));
    const installedBin = path.join(installedRoot, "bin.js");
    gate("isolated-install", installedPackage.version === packageJson.version && fs.existsSync(installedBin), { installed_version: installedPackage.version });
    const protocolFiles = [
      "lib/agent/protocol-client.js",
      "lib/agent/operation-registry.generated.js",
      "lib/agent/contracts/validators.cjs",
      "lib/agent/contracts/manifest.v1.json",
      "lib/agent/contracts/compatibility-current.v1.json",
    ];
    let protocolContract = { operations: 0, client: false, validators: false };
    try {
      const protocolClient = require(path.join(installedRoot, "lib", "agent", "protocol-client.js"));
      const operationRegistry = require(path.join(installedRoot, "lib", "agent", "operation-registry.generated.js"));
      const validators = require(path.join(installedRoot, "lib", "agent", "contract-validators.js")).loadValidators();
      protocolContract = { operations: operationRegistry.operations.length, client: typeof protocolClient.createAgentFaiClient === "function", validators: typeof validators.validateApiCompatibilityResponse === "function" };
    } catch {}
    gate("agent-fai-protocol-artifact", protocolFiles.every((file) => fs.existsSync(path.join(installedRoot, file))) && protocolContract.operations === 20 && protocolContract.client && protocolContract.validators, { files: protocolFiles, ...protocolContract, command_host: "unavailable" });

    const isolatedEnv = {
      CI: "false",
      FROOTAI_APPROVE_EXTERNAL: "",
      FROOTAI_APPROVE_FORCE: "",
      FROOTAI_DRY_RUN: "",
      FROOTAI_POLICY_OPERATION_ID: "",
      FROOTAI_POLICY_TOKEN: "",
      HOME: runtimeHome,
      USERPROFILE: runtimeHome,
      XDG_CONFIG_HOME: path.join(runtimeHome, "config"),
      FROOTAI_AUDIT_LOG: path.join(runtimeHome, "audit", "operations.jsonl"),
      NO_COLOR: "1",
    };
    const commandChecks = [
      [["--version"], /CLI:\s+v\d+\.\d+\.\d+/],
      [["--help"], /Enterprise Controls/],
      [["engine", "--help"], /deployable Solution Play/],
      [["orchard", "help"], /Browse, install, and contribute/],
      [["mcp", "help"], /Federation CLI/],
      [["config", "--help"], /Manage CLI preferences/],
      [["docs", "list"], /frootai orchard/],
      [["e2e", "list"], /happy_path/],
      [["errors", "codes", "--json"], /AUTH_REQUIRED/],
    ];
    const smoke = commandChecks.map(([commandArgs, pattern]) => {
      const result = run(process.execPath, [installedBin, ...commandArgs], { cwd: outDir, env: isolatedEnv });
      return { command: commandArgs.join(" "), ok: result.status === 0 && pattern.test(`${result.stdout}\n${result.stderr}`), exit_code: result.status, duration_ms: result.durationMs };
    });
    gate("packed-command-smoke", smoke.every((result) => result.ok), smoke);
    const totalSmokeMs = smoke.reduce((total, result) => total + result.duration_ms, 0);
    gate("startup-performance", smoke.every((result) => result.duration_ms <= 10_000) && totalSmokeMs <= 45_000, {
      maximum_command_ms: Math.max(...smoke.map((result) => result.duration_ms)),
      total_ms: totalSmokeMs,
      per_command_budget_ms: 10_000,
      total_budget_ms: 45_000,
    });

    const capabilities = parseJsonOutput(run(process.execPath, [installedBin, "capabilities", "--json"], { cwd: outDir, env: isolatedEnv }), "packed capabilities");
    const partialCapabilities = capabilities.capabilities.filter((capability) => capability.status !== "ready");
    const expectedPartial = partialCapabilities.length === 2 && partialCapabilities.every((capability) => capability.status === "partial") && partialCapabilities.map((capability) => capability.id).sort().join(",") === "agent-fai,factory";
    const agentProtocolCapability = partialCapabilities.find((capability) => capability.id === "agent-fai");
    gate("capabilities", (capabilities.summary.unavailable || 0) === 0 && (capabilities.summary.invalid || 0) === 0 && (capabilities.summary.ready || 0) >= 12 && expectedPartial && agentProtocolCapability?.contract?.includes("protocol-client"), {
      ...capabilities.summary,
      workspace_required: partialCapabilities.filter((capability) => capability.id === "factory").map((capability) => capability.id),
      planned: partialCapabilities.filter((capability) => capability.id === "agent-fai").map((capability) => capability.id),
      agent_protocol: "available",
      agent_command_host: "unavailable",
    });
    const factoryStatus = run(process.execPath, [installedBin, "factory", "status"], { cwd: REPO_ROOT, env: isolatedEnv });
    gate("factory-workspace", factoryStatus.status === 0 && /Factory Status|catalog|channel/i.test(`${factoryStatus.stdout}\n${factoryStatus.stderr}`), { exit_code: factoryStatus.status, workspace: "repository-required" });

    const products = parseJsonOutput(run(process.execPath, [installedBin, "products", "--json"], { cwd: outDir, env: isolatedEnv }), "packed products");
    gate("product-contract", products.schemaVersion === 1 && products.products.length >= 20, { schema_version: products.schemaVersion, products: products.products.length });

    const denied = run(process.execPath, [installedBin, "ship", "cli", "patch"], { cwd: outDir, env: isolatedEnv });
    gate("destructive-policy", denied.status === 77 && /blocked by enterprise policy/.test(denied.stderr) && !/FAI Factory/.test(`${denied.stdout}\n${denied.stderr}`), { exit_code: denied.status });
    const audit = parseJsonOutput(run(process.execPath, [installedBin, "audit", "verify", "--json"], { cwd: outDir, env: isolatedEnv }), "packed audit verify");
    gate("audit-chain", audit.ok === true && audit.records === 1, { records: audit.records, head: audit.head });

    const auditArgs = ["audit", "--omit=dev", "--json", "--prefix", installRoot];
    if (args.offline) auditArgs.push("--offline");
    const npmAudit = run(NPM, auditArgs, { cwd: installRoot });
    let auditBody = null;
    try { auditBody = JSON.parse(npmAudit.stdout); } catch {}
    const vulnerabilities = auditBody?.metadata?.vulnerabilities?.total;
    const runtimeDependencies = Object.keys(installedPackage.dependencies || {});
    gate("runtime-dependency-surface", runtimeDependencies.length === 0, { dependencies: runtimeDependencies });
    gate("dependency-audit", npmAudit.status === 0 && vulnerabilities === 0, {
      mode: args.offline ? "offline" : "online",
      exit_code: npmAudit.status,
      vulnerabilities: vulnerabilities ?? null,
      error: npmAudit.error || auditBody?.error?.summary || null,
      stderr: npmAudit.stderr ? npmAudit.stderr.slice(0, 2048) : null,
    });

    const evidence = buildEvidence({
      generatedAt: new Date(Number(process.env.SOURCE_DATE_EPOCH || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      package: {
        name: pack.name,
        version: pack.version,
        filename: pack.filename,
        packed_bytes: pack.size,
        unpacked_bytes: pack.unpackedSize,
        entry_count: pack.entryCount,
        sha256: digestFile(tarballPath),
        sha512: digestFile(tarballPath, "sha512", "base64"),
        npm_integrity: pack.integrity,
        inventory_sha256: inventoryDigest(pack.files),
      },
      source: {
        repository: "https://github.com/frootai/frootai-core",
        sha: sourceSha(),
        ref: process.env.GITHUB_REF || null,
        run_id: process.env.GITHUB_RUN_ID || null,
      },
      environment: { node: process.version, platform: process.platform, arch: process.arch, advisory_mode: args.offline ? "offline" : "online" },
      policy: { version: POLICY_VERSION, external_mutation: "explicit-approval", force_escalation: "separate-approval", audit: "sha256-chain" },
      capabilities: { schema_version: capabilities.schemaVersion, ready: capabilities.summary.ready, workspace_required: ["factory"], planned: ["agent-fai"], report_sha256: digestJson(capabilities) },
      gates,
    });
    const evidencePath = path.join(outDir, "enterprise-release-evidence.json");
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    fs.writeFileSync(`${evidencePath}.sha256`, `${digestFile(evidencePath)}  ${path.basename(evidencePath)}\n`, "utf8");
    const verified = verifyEvidence(evidence, tarballPath);
    if (!verified.ok) throw new Error(`evidence self-verification failed: ${verified.errors.join(", ")}`);

    const summary = { ok: evidence.release_eligible, tarball: tarballPath, evidence: evidencePath, sha256: evidence.package.sha256, gates: gates.length, failed: evidence.failures };
    process.stdout.write(args.json ? `${JSON.stringify(summary, null, 2)}\n` : `[enterprise-gate] ${summary.ok ? "PASS" : "FAIL"} ${pack.name}@${pack.version} · ${gates.length} gates · sha256:${summary.sha256}\n`);
    return summary.ok ? 0 : 1;
  } finally {
    if (ownedTemp) fs.rmSync(outDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { process.stderr.write(`[enterprise-gate] ${error instanceof Error ? error.stack || error.message : String(error)}\n`); process.exitCode = 1; }
}

module.exports = { parseArgs, run, buildEvidence, verifyEvidence };