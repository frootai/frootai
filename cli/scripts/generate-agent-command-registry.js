#!/usr/bin/env node
// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CLI_ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(CLI_ROOT, "commands", "agent", "command-registry.v1.json");
const OUTPUT_PATH = path.join(CLI_ROOT, "lib", "agent", "command-registry.generated.js");
const PACKAGE_PATH = path.join(CLI_ROOT, "package.json");
const TOP_FIELDS = ["aliases", "canonical", "capability", "commands", "directBin", "implementation", "internalRoute", "package", "policy", "root", "schemaVersion"];
const COMMAND_FIELDS = ["aliases", "authority", "children", "completion", "implemented", "name", "owner", "risk", "stderr", "stdout", "summary", "usage"];
const TOKEN = /^(?:[a-z][a-z0-9-]*|--?[a-z][a-z0-9-]*)$/u;
const DISALLOWED_STRING = /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\u{e0100}-\u{e01ef}]/u;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const RISKS = Object.freeze(["read", "local-write", "external-mutation"]);
const EXPECTED_EVIDENCE = Object.freeze([
  "commands/agent/command-registry.v1.json",
  "lib/agent/command-registry.generated.js",
  "lib/agent/dispatch.js",
  "lib/agent/protocol-client.js",
  "lib/agent/event-reducer.js",
  "lib/agent/renderers.js",
  "lib/agent/renderer-registry.generated.js",
  "commands/agent/render-result.v1.schema.json",
  "lib/agent/operation-registry.generated.js",
  "lib/agent/contracts/validators.cjs",
  "lib/agent/identity-coordinator.js",
  "lib/agent/config-v2.js",
  "lib/agent/organization-context.js",
  "lib/agent/session-metadata-store.js",
  "lib/agent/identity-state-store.js",
  "lib/agent/atomic-json-store.js",
  "commands/agent/source-authority-t017.v1.json",
  "commands/agent/source-authority-t017.js",
  "lib/agent/headless-host.js",
  "commands/agent/source-authority-t018.v1.json",
  "commands/agent/source-authority-t018.js",
  "lib/agent/interactive-host.js",
  "lib/agent/line-queue.js",
  "commands/agent/source-authority-t019.v1.json",
  "commands/agent/source-authority-t019.js",
  "lib/agent/offline-host.js",
  "lib/agent/offline-knowledge.generated.json",
  "commands/agent/offline-knowledge.v1.schema.json",
  "commands/agent/offline-result.v1.schema.json",
  "commands/agent/source-authority-t020.v1.json",
  "commands/agent/source-authority-t020.js",
]);
const REQUIRED_ROUTES = Object.freeze([
  "help", "version", "ask", "run", "resume",
  "sessions", "sessions list", "sessions show", "sessions resume", "sessions export",
  "jobs", "jobs list", "jobs show", "jobs watch", "jobs cancel",
  "artifacts", "artifacts list", "artifacts show", "artifacts verify",
  "context", "sources", "tools", "mcp", "usage", "status", "cancel", "export",
]);

function assertSafeString(value, label, maximumLength = 512) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength || DISALLOWED_STRING.test(value)) {
    throw new Error(`${label} must be a bounded string without control or confusable characters`);
  }
}

function inspectStructuredValue(value, label = "registry", active = new WeakSet()) {
  if (typeof value === "string") {
    assertSafeString(value, label);
    return;
  }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (!value || typeof value !== "object") throw new Error(`${label} contains an unsupported value`);
  if (active.has(value)) throw new Error(`${label} contains a cycle or reused active object`);
  active.add(value);
  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    const invalidKey = ownKeys.some((key) => typeof key !== "string" || (key !== "length" && (!/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length)));
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 256 || Object.keys(value).length !== value.length || invalidKey) {
      throw new Error(`${label} must contain a dense plain array with bounded length`);
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error(`${label}[${index}] must be a plain data property`);
      inspectStructuredValue(descriptor.value, `${label}[${index}]`, active);
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} must be a plain object`);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) throw new Error(`${label} contains a forbidden property key`);
      assertSafeString(key, `${label} property key`, 64);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error(`${label}.${key} must be a plain data property`);
      inspectStructuredValue(descriptor.value, `${label}.${key}`, active);
    }
  }
  active.delete(value);
}

function parseStrictJson(text, label = "JSON") {
  if (typeof text !== "string" || text.length > 131072) throw new Error(`${label} exceeds the maximum source length`);
  let index = 0;
  const fail = (message) => { throw new Error(`${label} ${message} at offset ${index}`); };
  const whitespace = () => { while (/[\u0020\u000a\u000d\u0009]/u.test(text[index] || "")) index += 1; };
  const string = () => {
    if (text[index] !== '"') fail("expected string");
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (!escaped && character === '"') {
        const raw = text.slice(start, index);
        let value;
        try { value = JSON.parse(raw); } catch (error) { fail(`contains an invalid string: ${error instanceof Error ? error.message : String(error)}`); }
        assertSafeString(value, `${label} string`);
        return value;
      }
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
    }
    fail("contains an unterminated string");
  };
  const value = (depth = 0) => {
    if (depth > 32) fail("exceeds maximum nesting depth");
    whitespace();
    if (text[index] === '"') return string();
    if (text[index] === "{") {
      index += 1;
      whitespace();
      const result = {};
      const keys = new Set();
      if (text[index] === "}") { index += 1; return result; }
      while (index < text.length) {
        const key = string();
        if (keys.has(key)) fail(`contains duplicate key ${JSON.stringify(key)}`);
        if (FORBIDDEN_KEYS.has(key)) fail(`contains forbidden key ${JSON.stringify(key)}`);
        keys.add(key);
        whitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        const child = value(depth + 1);
        Object.defineProperty(result, key, { value: child, enumerable: true, configurable: true, writable: true });
        whitespace();
        if (text[index] === "}") { index += 1; return result; }
        if (text[index] !== ",") fail("expected comma");
        index += 1;
        whitespace();
      }
      fail("contains an unterminated object");
    }
    if (text[index] === "[") {
      index += 1;
      whitespace();
      const result = [];
      if (text[index] === "]") { index += 1; return result; }
      while (index < text.length) {
        result.push(value(depth + 1));
        whitespace();
        if (text[index] === "]") { index += 1; return result; }
        if (text[index] !== ",") fail("expected comma");
        index += 1;
      }
      fail("contains an unterminated array");
    }
    for (const [literal, parsed] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, index)) { index += literal.length; return parsed; }
    }
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) fail("contains an invalid value");
    index += match[0].length;
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) fail("contains a non-finite number");
    return parsed;
  };
  const parsed = value();
  whitespace();
  if (index !== text.length) fail("contains trailing content");
  inspectStructuredValue(parsed, label);
  return parsed;
}

function exactFields(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} must be a plain object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join("|") !== wanted.join("|")) throw new Error(`${label} has unknown or missing fields: ${actual.join(", ")}`);
}

function validateCommand(command, parentPath, active, seen, flat) {
  exactFields(command, COMMAND_FIELDS, `command ${parentPath || "root"}`);
  if (active.has(command)) throw new Error(`command cycle at ${parentPath || "root"}`);
  if (seen.has(command)) throw new Error(`command object reused at ${parentPath || "root"}`);
  active.add(command);
  seen.add(command);
  if (!TOKEN.test(command.name)) throw new Error(`invalid command token: ${command.name}`);
  if (!Array.isArray(command.aliases) || !command.aliases.every((alias) => TOKEN.test(alias))) throw new Error(`invalid aliases for ${command.name}`);
  if (new Set(command.aliases).size !== command.aliases.length || command.aliases.includes(command.name)) throw new Error(`duplicate aliases for ${command.name}`);
  for (const field of ["summary", "usage", "stdout", "stderr"]) assertSafeString(command[field], `${field} text for ${command.name}`);
  if (!command.usage.startsWith("fai agent")) throw new Error(`noncanonical usage for ${command.name}`);
  if (typeof command.completion !== "boolean" || typeof command.implemented !== "boolean") throw new Error(`invalid booleans for ${command.name}`);
  if (!RISKS.includes(command.risk) || command.authority !== command.risk) throw new Error(`risk or authority inconsistency for ${command.name}`);
  const expectedOwner = command.name === "root" ? "AFCLI-T019" : ["help", "version"].includes(command.name) ? "AFCLI-T014" : ["ask", "run"].includes(command.name) ? "AFCLI-T018" : ["resume", "list", "show", "export"].includes(command.name) && command.implemented ? "AFCLI-T019" : "AFCLI-T015";
  if (command.owner !== expectedOwner) throw new Error(`ownership inconsistency for ${command.name}`);
  if (!Array.isArray(command.children)) throw new Error(`children must be an array for ${command.name}`);
  const pathTokens = parentPath ? [...parentPath, command.name] : command.name === "root" ? [] : [command.name];
  if (command.name !== "root") flat.push({ ...command, route: pathTokens.join(" "), path: pathTokens, children: undefined });
  const siblingTokens = new Set();
  for (const child of command.children) {
    for (const token of [child.name, ...(Array.isArray(child.aliases) ? child.aliases : [])]) {
      if (siblingTokens.has(token)) throw new Error(`duplicate command name or alias at ${pathTokens.join(" ") || "root"}: ${token}`);
      siblingTokens.add(token);
    }
    validateCommand(child, pathTokens, active, seen, flat);
  }
  active.delete(command);
}

function validateDefinition(definition) {
  inspectStructuredValue(definition);
  exactFields(definition, TOP_FIELDS, "registry");
  if (definition.schemaVersion !== "agent-fai-command-registry.v1") throw new Error("unsupported registry schemaVersion");
  exactFields(definition.package, ["name", "version"], "package");
  exactFields(definition.implementation, ["protocolOwner", "state", "task"], "implementation");
  exactFields(definition.policy, ["authority", "effects", "maximumRisk"], "policy");
  exactFields(definition.capability, ["evidence", "id", "implementedOperations", "label", "metadataCommands", "status"], "capability");
  const packageMetadata = parseStrictJson(fs.readFileSync(PACKAGE_PATH, "utf8"), "cli/package.json");
  if (definition.package.name !== packageMetadata.name || definition.package.version !== packageMetadata.version || definition.package.name !== "frootai" || definition.internalRoute !== "agent" || definition.canonical !== "fai agent") throw new Error("package or canonical route mismatch");
  if (!Array.isArray(definition.aliases) || definition.aliases.join("|") !== "frootai agent" || definition.directBin !== "agent-fai") throw new Error("invocation aliases mismatch");
  if (definition.implementation.state !== "offline-profile-available-terminal-preview-partial" || definition.implementation.task !== "AFCLI-T020" || definition.implementation.protocolOwner !== "AFCLI-T015") throw new Error("implementation ownership mismatch");
  if (definition.policy.maximumRisk !== "read" || definition.policy.authority !== "registry" || definition.policy.effects !== "none") throw new Error("registry policy must remain read-only and effect-free");
  if (definition.capability.id !== "agent-fai" || definition.capability.label !== "Agent FAI" || definition.capability.status !== "partial" || definition.capability.implementedOperations.join("|") !== "help|protocol-client|event-reducer|renderers|identity|config|organization-context|session-metadata|headless-execution|interactive-line-mode|session-commands|offline-profile" || definition.capability.metadataCommands.join("|") !== "version" || definition.capability.evidence.join("|") !== EXPECTED_EVIDENCE.join("|")) throw new Error("capability truth mismatch");
  const realCliRoot = fs.realpathSync(CLI_ROOT);
  for (const evidence of definition.capability.evidence) {
    const resolved = fs.realpathSync(path.resolve(CLI_ROOT, evidence));
    const relative = path.relative(realCliRoot, resolved);
    if (!relative || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error(`capability evidence escapes CLI root: ${evidence}`);
  }
  if (!Array.isArray(definition.commands)) throw new Error("commands must be an array");
  const expectedRoot = { name: "root", aliases: [], summary: "Start an observe-only Agent FAI interactive line session.", usage: "fai agent [--mode answer|architecture|plan|review] | fai agent --offline [--format text|markdown|json]", completion: false, implemented: true, risk: "read", authority: "read", stdout: "Streamed model content only.", stderr: "Interactive prompts, status, sources, usage, and redacted diagnostics.", owner: "AFCLI-T019", children: [] };
  if (JSON.stringify(definition.root) !== JSON.stringify(expectedRoot)) throw new Error("registry root identity is invalid");
  const flat = [];
  validateCommand(definition.root, [], new WeakSet(), new WeakSet(), []);
  const active = new WeakSet();
  const seen = new WeakSet();
  for (const command of definition.commands) validateCommand(command, [], active, seen, flat);
  const routes = new Set();
  for (const command of flat) {
    if (routes.has(command.route)) throw new Error(`duplicate command route: ${command.route}`);
    routes.add(command.route);
    const expectedImplemented = ["help", "version", "ask", "run", "resume", "sessions list", "sessions show", "sessions resume", "sessions export"].includes(command.route);
    const expectedOwner = ["help", "version"].includes(command.route) ? "AFCLI-T014" : ["ask", "run"].includes(command.route) ? "AFCLI-T018" : ["resume", "sessions list", "sessions show", "sessions resume", "sessions export"].includes(command.route) ? "AFCLI-T019" : "AFCLI-T015";
    if (command.implemented !== expectedImplemented || command.owner !== expectedOwner) throw new Error(`command implementation truth mismatch: ${command.route}`);
  }
  if (JSON.stringify([...routes]) !== JSON.stringify(REQUIRED_ROUTES)) throw new Error("required Agent FAI command route set mismatch");
  const maximumRisk = flat.reduce((maximum, command) => Math.max(maximum, RISKS.indexOf(command.risk)), 0);
  if (RISKS[maximumRisk] !== definition.policy.maximumRisk) throw new Error("policy maximumRisk does not match command maximum");
  return definition;
}

function readDefinition(sourcePath = SOURCE_PATH) {
  let parsed;
  try { parsed = parseStrictJson(fs.readFileSync(sourcePath, "utf8"), "Agent FAI registry JSON"); }
  catch (error) { throw new Error(`invalid Agent FAI registry JSON: ${error instanceof Error ? error.message : String(error)}`); }
  return validateDefinition(parsed);
}

function createRuntimeRegistry(definition) {
  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) return value;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) deepFreeze(descriptor.value, seen);
    }
    return Object.freeze(value);
  }

  function flatten(nodes, parent = [], result = []) {
    for (const node of nodes) {
      const commandPath = [...parent, node.name];
      const aliases = node.aliases.map((alias) => [...parent, alias].join(" "));
      result.push({ ...node, name: commandPath.join(" "), token: node.name, path: commandPath, aliases, children: undefined });
      flatten(node.children, commandPath, result);
    }
    return result;
  }

  const invocations = deepFreeze([definition.canonical, ...definition.aliases, definition.directBin]);
  const commands = deepFreeze(flatten(definition.commands));
  const rootCompletionWords = deepFreeze([definition.internalRoute]);
  const unavailableOperations = deepFreeze(commands.filter((command) => !command.implemented).map((command) => command.name));
  const capability = deepFreeze({ ...definition.capability, state: definition.implementation.state, unavailableOperations });
  const policy = deepFreeze({ ...definition.policy });

  function lookup(route) {
    const key = Array.isArray(route) ? route.join(" ") : String(route || "");
    return commands.find((command) => command.name === key || command.aliases.includes(key)) || null;
  }

  function childFor(parent, token) {
    const depth = parent.length + 1;
    return commands.find((command) => command.path.length === depth && command.path.slice(0, -1).join(" ") === parent.join(" ") && (command.token === token || command.aliases.some((alias) => alias.split(" ").at(-1) === token))) || null;
  }

  function completionWordsFor(route) {
    const routeTokens = Array.isArray(route) ? [...route] : String(route || "").trim().split(/\s+/u).filter(Boolean);
    if (routeTokens.length === 0) return rootCompletionWords;
    if (routeTokens[0] === definition.internalRoute) routeTokens.shift();
    const parent = routeTokens.length === 0 ? [] : (lookup(routeTokens) || {}).path;
    if (!parent) return deepFreeze([]);
    return deepFreeze(commands
      .filter((command) => command.completion && command.path.length === parent.length + 1 && command.path.slice(0, -1).join(" ") === parent.join(" "))
      .flatMap((command) => [command.token, ...command.aliases.map((alias) => alias.split(" ").at(-1))]));
  }

  function resolve(argv) {
    if (!Array.isArray(argv) || !argv.every((arg) => typeof arg === "string")) throw new TypeError("Agent FAI argv must be an array of strings");
    if (argv.length === 0 || ["help", "-h", "--help"].includes(argv[0])) return { kind: "help", command: null, args: [] };
    let command = childFor([], argv[0]);
    if (!command) return { kind: "unknown", token: argv[0], args: argv.slice(1) };
    let index = 1;
    while (index < argv.length) {
      const token = argv[index];
      if (["help", "-h", "--help"].includes(token)) return { kind: "help", command, args: argv.slice(index + 1) };
      const hasChildren = commands.some((entry) => entry.path.length === command.path.length + 1 && entry.path.slice(0, -1).join(" ") === command.name);
      if (!hasChildren || token.startsWith("-")) break;
      const child = childFor(command.path, token);
      if (!child) return { kind: "unknown", token, parent: command.name, args: argv.slice(index + 1) };
      command = child;
      index += 1;
    }
    return command.name === "help" ? { kind: "help", command: null, args: argv.slice(index) } : { kind: "command", command, args: argv.slice(index) };
  }

  function renderHelp(route) {
    const command = route ? lookup(route) : null;
    const parent = command ? command.path : [];
    const children = commands.filter((entry) => entry.path.length === parent.length + 1 && entry.path.slice(0, -1).join(" ") === parent.join(" "));
    const lines = ["Agent FAI", "", command ? command.summary : definition.root.summary, "", "Usage: " + (command ? command.usage : definition.root.usage), "", "Canonical: " + definition.canonical, "Equivalent: " + [...definition.aliases, definition.directBin].join(", ")];
    if (children.length) {
      lines.push("", "Commands:");
      const width = Math.max(...children.map((entry) => entry.token.length));
      for (const child of children) lines.push("  " + child.token.padEnd(width) + "  " + child.summary);
    }
    lines.push("", "Status: " + definition.implementation.state + "; explicit packaged offline discovery is available; jobs, tools, context transmission, MCP, operate, and mutation remain unavailable.", "");
    return lines.join("\n");
  }

  function renderRootSection() {
    const top = commands.filter((command) => command.path.length === 1 && command.completion);
    const width = Math.max(...top.map((command) => command.token.length));
    return ["\x1b[1mAgent FAI Commands:\x1b[0m", ...top.map((command) => "  fai agent " + command.token.padEnd(width) + "  " + command.summary)].join("\n");
  }

  function classify(argv) {
    const resolved = resolve(Array.isArray(argv) ? argv : []);
    const operation = resolved.kind === "command" ? resolved.command.name.replaceAll(" ", ".") : resolved.kind;
    const risk = resolved.kind === "command" ? resolved.command.risk : "read";
    return { risk, operation: "agent." + operation };
  }

  deepFreeze(definition);
  return deepFreeze({
    schemaVersion: definition.schemaVersion,
    packageMetadata: definition.package,
    internalRoute: definition.internalRoute,
    canonical: definition.canonical,
    aliases: definition.aliases,
    directBin: definition.directBin,
    invocations,
    commands,
    rootCompletionWords,
    completionWordsFor,
    capability,
    policy,
    lookup,
    resolve,
    renderHelp,
    renderRootSection,
    classify,
  });
}

function generateCommandRegistry(candidate) {
  const definition = validateDefinition(candidate || readDefinition());
    return [
      "// Generated by scripts/generate-agent-command-registry.js. Do not edit.",
      "// @ts-check",
      '"use strict";',
      "",
      `const definition = ${JSON.stringify(definition, null, 2)};`,
      "",
      `const createRuntimeRegistry = ${createRuntimeRegistry.toString()};`,
      "",
      "module.exports = createRuntimeRegistry(definition);",
      "",
    ].join("\n");
}

function main(argv = process.argv.slice(2)) {
  const output = generateCommandRegistry();
  if (argv.includes("--write")) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, output, "utf8");
    return 0;
  }
  if (argv.includes("--check")) {
    if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, "utf8") !== output) {
      process.stderr.write("Agent FAI command registry drift detected; run generate:agent-registry.\n");
      return 1;
    }
    return 0;
  }
  process.stdout.write(output);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { SOURCE_PATH, OUTPUT_PATH, createRuntimeRegistry, generateCommandRegistry, parseStrictJson, readDefinition, validateDefinition, main };