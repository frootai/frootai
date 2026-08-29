// @ts-check
"use strict";

const registry = require("./command-registry.generated.js");

function requestsOffline(args) {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--") return false;
    if (["--prompt", "--format", "--deadline"].includes(token)) { index += 1; continue; }
    if (token === "--offline") return true;
  }
  return false;
}

function dispatchAgent(args) {
  const resolved = registry.resolve(args);
  if (resolved.kind === "help") {
    return { exitCode: 0, output: registry.renderHelp(resolved.command && resolved.command.name), error: "" };
  }
  if (resolved.kind === "unknown") {
    const location = resolved.parent ? ` under ${resolved.parent}` : "";
    return { exitCode: 64, output: "", error: `Agent FAI usage error: unknown command '${resolved.token}'${location}. Run 'fai agent --help'.` };
  }
  if (resolved.command.name === "version") {
    return { exitCode: 0, output: `frootai ${registry.packageMetadata.version} Agent FAI ${registry.capability.state}`, error: "" };
  }
  return { exitCode: 69, output: "", error: `Agent FAI command '${resolved.command.name}' is unavailable in AFCLI-T015; the packed protocol client is library-only and command hosting is not implemented.` };
}

async function runAgent(args, dependencies = {}) {
  if (requestsOffline(args)) return require("./offline-host.js").executeOffline(args, dependencies);
  if (args.length === 0 || args[0] === "--mode") return require("./interactive-host.js").executeInteractive(args, dependencies);
  const resolved = registry.resolve(args);
  if (resolved.kind === "command" && ["ask", "run"].includes(resolved.command.name)) return require("./headless-host.js").executeHeadless(resolved.command.name, resolved.args, dependencies);
  if (resolved.kind === "command" && resolved.command.name === "resume") return require("./interactive-host.js").executeInteractive(["--resume", ...resolved.args], dependencies);
  if (resolved.kind === "command" && resolved.command.name === "sessions resume") return require("./interactive-host.js").executeInteractive(["--resume", ...resolved.args], dependencies);
  if (resolved.kind === "command" && ["sessions list", "sessions show", "sessions export"].includes(resolved.command.name)) return require("./interactive-host.js").executeSessionCommand(resolved.command.name, resolved.args, dependencies);
  return dispatchAgent(args);
}

module.exports = { dispatchAgent, requestsOffline, runAgent };