// @ts-check
"use strict";

const PRODUCTS = Object.freeze([
  {
    id: "orchard",
    name: "Orchard",
    coverage: "native",
    summary: "Discover, inspect, install, diff, pollinate, and save accelerators.",
    commands: ["frootai orchard list", "frootai orchard search", "frootai orchard install"],
    url: "https://frootai.dev/orchard",
  },
  {
    id: "mcp",
    name: "MCP Federation",
    coverage: "native",
    summary: "Discover, trust, test, attach, invoke, and publish federated MCP areas.",
    commands: ["frootai mcp discover", "frootai mcp attach", "frootai mcp invoke"],
    url: "https://frootai.dev/mcp-tooling",
  },
  {
    id: "protocol",
    name: "FAI Protocol",
    coverage: "native",
    summary: "Run the zero-dependency L0 conformance suite against any project.",
    commands: ["frootai conformance"],
    url: "https://frootai.dev/fai-protocol",
  },
  {
    id: "lean",
    name: "Lean",
    coverage: "native",
    summary: "Compile Markdown and install fidelity-verified Lean primitives.",
    commands: ["frootai lean", "frootai install <id> --lean"],
    url: "https://frootai.dev/lean",
  },
  {
    id: "primitives",
    name: "AI Primitives",
    coverage: "native",
    summary: "Browse, scaffold, and validate agents, skills, instructions, and hooks.",
    commands: ["frootai primitives", "frootai scaffold", "frootai validate"],
    url: "https://frootai.dev/primitives",
  },
  {
    id: "factory",
    name: "FAI Factory",
    coverage: "native",
    summary: "Build, diff, transform, validate, and ship distribution channels.",
    commands: ["frootai factory", "frootai factory status", "frootai ship"],
    url: "https://frootai.dev/fai-engine",
  },
  {
    id: "account",
    name: "FrootAI Account",
    coverage: "native",
    summary: "Sign in and inspect local tier and entitlement state.",
    commands: ["frootai login", "frootai whoami", "frootai logout"],
    url: "https://frootai.dev/account",
  },
  {
    id: "plays",
    name: "Solution Plays",
    coverage: "bridge",
    summary: "Discover and install accelerator-backed plays through Orchard; browse the full catalog online.",
    commands: ["frootai orchard search", "frootai orchard install"],
    url: "https://frootai.dev/solution-plays",
  },
  {
    id: "solution-accelerator",
    name: "Solution Accelerator",
    coverage: "bridge",
    summary: "Browse harvested open-source accelerators on the web and use Orchard for terminal discovery and installation.",
    commands: ["frootai orchard list", "frootai orchard install"],
    url: "https://frootai.dev/solution-accelerator",
  },
  {
    id: "marketplace",
    name: "Plugin Marketplace",
    coverage: "bridge",
    summary: "Discover and validate MCP providers from the CLI; browse and install the wider plugin catalog online.",
    commands: ["frootai mcp discover", "frootai mcp publish"],
    url: "https://frootai.dev/marketplace",
  },
  {
    id: "engine",
    name: "FAI Engine",
    coverage: "bridge",
    summary: "Validate protocol inputs locally; runtime execution and evidence are exposed through MCP and the web.",
    commands: ["frootai conformance", "npx frootai-mcp@latest"],
    url: "https://frootai.dev/fai-engine",
  },
  {
    id: "hosted-mcp",
    name: "Hosted MCP",
    coverage: "bridge",
    summary: "Use the packaged MCP runtime locally or connect clients to the managed hosted service.",
    commands: ["npx frootai-mcp@latest"],
    url: "https://frootai.dev/mcp",
  },
  {
    id: "docker",
    name: "Docker Image",
    coverage: "bridge",
    summary: "Run the FrootAI MCP runtime as a reproducible multi-architecture container.",
    commands: ["docker run -i ghcr.io/frootai/frootai-mcp"],
    url: "https://frootai.dev/docker",
  },
  {
    id: "agent-fai",
    name: "Agent FAI",
    coverage: "web",
    summary: "Grounded product guidance, play recommendations, and repository review.",
    commands: [],
    url: "https://frootai.dev/chatbot",
  },
  {
    id: "studio",
    name: "Studio",
    coverage: "web",
    summary: "Visual workflow, agent, and memory design experience.",
    commands: [],
    url: "https://frootai.dev/studio",
  },
  {
    id: "lab",
    name: "Lab",
    coverage: "web",
    summary: "Benchmarks, datasets, experiments, and signed evidence.",
    commands: [],
    url: "https://frootai.dev/lab",
  },
  {
    id: "configurator",
    name: "Configurator",
    coverage: "web",
    summary: "Guided play selection and cost estimation.",
    commands: [],
    url: "https://frootai.dev/configurator",
  },
  {
    id: "vscode",
    name: "VS Code Extension",
    coverage: "web",
    summary: "Workbench, command palette, project workflows, and offline catalog inside VS Code.",
    commands: [],
    url: "https://frootai.dev/vscode-extension",
  },
  {
    id: "npm-sdk",
    name: "JavaScript SDK (preview)",
    coverage: "web",
    summary: "Private pre-release Node.js and TypeScript SDK; not yet published to npm.",
    commands: [],
    url: "https://frootai.dev/packages",
  },
  {
    id: "python",
    name: "Python SDK and MCP",
    coverage: "web",
    summary: "Python SDK and MCP packages for Python-native applications and agents.",
    commands: [],
    url: "https://frootai.dev/python",
  },
]);

function productCoverage() {
  const counts = { native: 0, bridge: 0, web: 0 };
  for (const product of PRODUCTS) counts[product.coverage] += 1;
  return { schemaVersion: 1, products: PRODUCTS, counts };
}

function renderProducts(options = {}) {
  const coverage = productCoverage();
  if (options.json) return JSON.stringify(coverage, null, 2);

  const lines = [
    "",
    "FrootAI product coverage",
    `CLI-native: ${coverage.counts.native} | CLI bridge: ${coverage.counts.bridge} | Web/MCP: ${coverage.counts.web}`,
    "",
  ];

  for (const product of PRODUCTS) {
    lines.push(`[${product.coverage.toUpperCase()}] ${product.name}`);
    lines.push(`  ${product.summary}`);
    if (product.commands.length > 0) lines.push(`  Try: ${product.commands.join(" | ")}`);
    lines.push(`  ${product.url}`);
    lines.push("");
  }

  lines.push("Coverage labels describe the CLI surface, not product maturity.");
  return lines.join("\n");
}

module.exports = { PRODUCTS, productCoverage, renderProducts };