// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CLI_ROOT = path.resolve(__dirname, "..", "..");

function commandNames(mod) {
  if (Array.isArray(mod.SUBCOMMAND_NAMES)) return [...mod.SUBCOMMAND_NAMES];
  if (Array.isArray(mod.SUBCOMMANDS)) {
    return mod.SUBCOMMANDS.map((entry) => typeof entry === "string" ? entry : entry.name).filter(Boolean);
  }
  if (mod.COMMANDS && typeof mod.COMMANDS === "object") return Object.keys(mod.COMMANDS);
  if (Array.isArray(mod.AUTH_COMMANDS)) return [...mod.AUTH_COMMANDS];
  if (Array.isArray(mod.TELEMETRY_COMMANDS)) return [...mod.TELEMETRY_COMMANDS];
  return [];
}

function inspectModule(id, label, relativePath, contract, extraCommands = []) {
  const absolutePath = path.join(CLI_ROOT, relativePath);
  try {
    const mod = require(absolutePath);
    const commands = [...new Set([...commandNames(mod), ...extraCommands])];
    const callable = contract.some((name) => typeof mod[name] === "function");
    return {
      id,
      label,
      status: callable ? "ready" : "invalid",
      commands,
      contract: contract.filter((name) => typeof mod[name] === "function"),
      evidence: path.relative(CLI_ROOT, absolutePath).replaceAll("\\", "/"),
    };
  } catch (error) {
    return {
      id,
      label,
      status: "unavailable",
      commands: [],
      contract: [],
      evidence: path.relative(CLI_ROOT, absolutePath).replaceAll("\\", "/"),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function inspectFactory() {
  const scripts = ["index.js", "status.js", "watch.js", "ship.js", "validate.js", "harvest.js", "catalog.js", "diff.js", "transform.js"];
  const root = path.resolve(CLI_ROOT, "..", "scripts", "factory");
  const present = scripts.filter((name) => fs.existsSync(path.join(root, name)));
  return {
    id: "factory",
    label: "FAI Factory",
    status: present.length === scripts.length ? "ready" : "partial",
    commands: ["run", "status", "watch", "ship", "validate", "harvest", "catalog", "diff", "transform"],
    contract: [`${present.length}/${scripts.length} scripts`],
    evidence: "../scripts/factory",
  };
}

function inspectAgent() {
  const registry = require("../agent/command-registry.generated.js");
  const { dispatchAgent } = require("../agent/dispatch.js");
  return {
    ...registry.capability,
    status: typeof dispatchAgent === "function" ? registry.capability.status : "invalid",
    commands: registry.commands.map((command) => command.name),
    contract: ["dispatchAgent", ...registry.capability.implementedOperations],
    evidence: registry.capability.evidence.join(" | "),
  };
}

function inspectCapabilities() {
  const capabilities = [
    inspectFactory(),
    inspectAgent(),
    inspectModule("orchard", "Orchard catalog", "lib/orchard/dispatch.js", ["dispatch"], ["list", "search", "show", "install", "diff", "pollinate", "bushel"]),
    inspectModule("engine", "Harvest engine", "commands/orchard/index.js", ["run", "main"]),
    inspectModule("mcp", "MCP federation", "lib/mcp/dispatch.js", ["dispatch"]),
    inspectModule("config", "Operator config", "commands/config/config.js", ["run", "runWithDeps"]),
    inspectModule("docs", "CLI docs engine", "commands/docs/docs.js", ["run", "runWithDeps"]),
    inspectModule("e2e", "Hermetic scenario engine", "commands/e2e/e2e.js", ["run", "runWithDeps"]),
    inspectModule("errors", "Structured error engine", "commands/errors/errors.js", ["run", "runWithDeps"]),
    inspectModule("update", "CLI updater", "commands/update/update.js", ["run", "runWithDeps"], ["check", "apply"]),
    inspectModule("auth", "Account authentication", "lib/auth/dispatch.js", ["dispatchAuth"], ["login", "logout", "whoami"]),
    inspectModule("telemetry", "Privacy controls", "lib/telemetry/dispatch.js", ["dispatchTelemetry"], ["on", "off", "status", "reset", "export"]),
    inspectModule("products", "Product coverage", "lib/products/catalog.js", ["productCoverage", "renderProducts"], ["list"]),
    inspectModule("lean", "Lean compiler", "lib/lean/compile.js", ["compileLean"], ["compile", "install"]),
  ];
  const summary = capabilities.reduce((counts, capability) => {
    counts[capability.status] = (counts[capability.status] || 0) + 1;
    return counts;
  }, {});
  return { schemaVersion: 1, cliVersion: require(path.join(CLI_ROOT, "package.json")).version, summary, capabilities };
}

function renderCapabilities(options = {}) {
  const report = inspectCapabilities();
  if (options.json) return JSON.stringify(report, null, 2);
  const lines = ["", `FrootAI CLI ${report.cliVersion} capability evidence`, ""];
  for (const capability of report.capabilities) {
    lines.push(`[${capability.status.toUpperCase()}] ${capability.label}`);
    lines.push(`  ${capability.commands.join(" | ") || "No commands exported"}`);
    lines.push(`  Evidence: ${capability.evidence}`);
  }
  lines.push("");
  lines.push(`Ready: ${report.summary.ready || 0} | Partial: ${report.summary.partial || 0} | Unavailable: ${report.summary.unavailable || 0} | Invalid: ${report.summary.invalid || 0}`);
  return lines.join("\n");
}

module.exports = { commandNames, inspectModule, inspectCapabilities, renderCapabilities };