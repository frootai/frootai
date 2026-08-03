#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Website Adapter
 * Generates all public/data/*.json files for frootai.dev from fai-catalog.json.
 *
 * Outputs to WEBSITE_ROOT (c:\CodeSpace\frootai.dev by default):
 *   - public/data/agents.json      (agents)
 *   - public/data/instructions.json (instructions)
 *   - public/data/skills.json      (skills)
 *   - public/data/hooks.json       (hooks)
 *   - public/data/plugins.json     (plugins)
 *   - public/data/workflows.json   (workflows)
 *   - public/data/cookbook.json     (recipes)
 *   - public/data/stats.json       (aggregate counts)
 *   - public/search-index.json     (comprehensive search index)
 *
 * Usage:
 *   node scripts/factory/adapters/website.js
 *   WEBSITE_ROOT=/path/to/frootai.dev node scripts/factory/adapters/website.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const REPO_ROOT =
  process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");
const WEBSITE_ROOT =
  process.env.WEBSITE_ROOT || path.resolve(REPO_ROOT, "..", "frootai.dev");

const solutionPlayArtifactPaths = [
  "public/search-index.json",
  "src/data/generated/solution-play-details.ts",
  "src/data/generated/solution-plays.ts",
];

const solutionPlaySourcePaths = [
  "solution-plays",
  "orchard/registry/solution-play-index.json",
  "orchard/registry/solution-play-certification-index.v1.json",
];

function repositoryCommitSha({ repoRoot = REPO_ROOT, expectedCommitSha = process.env.FROOTAI_SOURCE_COMMIT_SHA } = {}) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const commitSha = result.stdout?.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(commitSha)) throw new Error("Solution Play projection generation requires a full canonical Git commit SHA");
  if (expectedCommitSha !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(expectedCommitSha)) throw new Error("FROOTAI_SOURCE_COMMIT_SHA must be a full lowercase Git commit SHA");
    if (expectedCommitSha !== commitSha) throw new Error(`FROOTAI_SOURCE_COMMIT_SHA does not match the canonical checkout HEAD: expected ${commitSha}, received ${expectedCommitSha}`);
  }
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", ...solutionPlaySourcePaths], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (status.status !== 0) throw new Error("Solution Play projection generation could not verify canonical source state");
  if (status.stdout.trim() !== "") throw new Error("Solution Play projection generation requires clean canonical source inputs");
  return commitSha;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildSolutionPlayArtifactManifest(sourceCommitSha, artifacts) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommitSha)) throw new Error("Solution Play artifact manifest requires a full lowercase source commit SHA");
  const artifactEntries = {};
  for (const relativePath of solutionPlayArtifactPaths) {
    const content = artifacts[relativePath];
    if (!Buffer.isBuffer(content) || content.length === 0) throw new Error(`Solution Play artifact is missing or empty: ${relativePath}`);
    artifactEntries[relativePath] = { sha256: sha256(content), bytes: content.length };
  }
  if (Object.keys(artifacts).some((relativePath) => !solutionPlayArtifactPaths.includes(relativePath))) throw new Error("Solution Play artifact manifest received an unknown artifact");
  return {
    schemaVersion: "1.0.0",
    source: { repository: "frootai/frootai", commitSha: sourceCommitSha, path: "solution-plays" },
    artifacts: artifactEntries,
  };
}

function readSolutionPlayArtifact(absolutePath, relativePath) {
  const descriptor = fs.openSync(absolutePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const openedMetadata = fs.fstatSync(descriptor);
    const pathMetadata = fs.lstatSync(absolutePath);
    if (!openedMetadata.isFile() || !pathMetadata.isFile() || pathMetadata.isSymbolicLink() || openedMetadata.dev !== pathMetadata.dev || openedMetadata.ino !== pathMetadata.ino) {
      throw new Error(`Solution Play artifact must be an unchanged non-symlink regular file: ${relativePath}`);
    }
    const content = fs.readFileSync(descriptor);
    if (content.length === 0 || content.length !== openedMetadata.size) throw new Error(`Solution Play artifact changed while reading: ${relativePath}`);
    return content;
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeSolutionPlayArtifactManifest(sourceCommitSha = repositoryCommitSha()) {
  const artifacts = {};
  for (const relativePath of solutionPlayArtifactPaths) {
    const absolutePath = path.join(WEBSITE_ROOT, ...relativePath.split("/"));
    artifacts[relativePath] = readSolutionPlayArtifact(absolutePath, relativePath);
  }
  const manifest = buildSolutionPlayArtifactManifest(sourceCommitSha, artifacts);
  writeJson(path.join(WEBSITE_ROOT, "public", "solution-play-projection-manifest.json"), manifest);
  return manifest;
}

const solutionPlayCategories = [
  ["agriculture", /agriculture|food-safety/],
  ["realestate", /property|construction|building-energy/],
  ["government", /citizen|policy-impact|public-safety/],
  ["telecom", /telecom|network-optimization|customer-churn/],
  ["retail", /pricing|product-search|retail-inventory/],
  ["education", /training-curriculum|tutor|exam|accessibility-learning|research-paper/],
  ["climate", /carbon|esg|energy-grid|climate|waste|biodiversity/],
  ["healthcare", /healthcare|clinical/],
  ["finance", /financial|fraud/],
  ["voice", /voice|call-center/],
  ["document", /document|docproc|legal/],
  ["mlops", /model-governance|fine-tun|prompt-management|federated-learning/],
  ["security", /security|moderation|compliance|red-team|responsible-ai|governance/],
  ["rag", /rag|search|knowledge-management|research-paper/],
  ["iot", /digital-twin|maintenance|edge-ai|on-device/],
  ["creative", /video|creative|translation|podcast/],
  ["devops", /observability|code-review|testing|devops|coding-agent|evaluation-platform|pester/],
  ["data", /anomaly|data-|event-ai|synthetic|supply-chain/],
  ["infra", /landing-zone|serving|gateway|infrastructure|aks/],
  ["customer", /ticket|copilot|meeting|customer|recruiter|sales|low-code/],
  ["agent", /agent|multi-agent|browser-automation|conversation-memory|swarm/],
];

const solutionPlayIcons = {
  agriculture: "Leaf", agent: "Bot", climate: "Leaf", creative: "Layers", customer: "MessageCircle",
  data: "Factory", devops: "Wrench", document: "FileText", education: "GraduationCap", finance: "BarChart3",
  government: "Building2", healthcare: "Shield", infra: "Mountain", iot: "Monitor", mlops: "Microscope",
  rag: "Search", realestate: "Building2", retail: "DollarSign", security: "Shield", telecom: "Globe", voice: "Phone",
};

// ══════════════════════════════════════════════════════════════
// ENRICHMENT — read full data from repo files when catalog is sparse
// ══════════════════════════════════════════════════════════════

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Parse YAML frontmatter from a markdown file.
 * @param {string} content - File content
 * @returns {{ [key: string]: string }}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*"?(.+?)"?\s*$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

/**
 * Extract first H1 title and first paragraph from markdown.
 * @param {string} content
 * @returns {{ title: string, description: string }}
 */
function extractMarkdownMeta(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_`]/g, "").trim() : "";
  // First non-empty, non-heading line after title
  const lines = content.split("\n");
  let desc = "";
  let pastTitle = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      pastTitle = true;
      continue;
    }
    if (pastTitle && line.trim() && !line.startsWith("#") && !line.startsWith("---")) {
      desc = line.replace(/[*_`>]/g, "").trim();
      break;
    }
  }
  return { title, description: desc };
}

function classifySolutionPlay(play) {
  const text = `${play.slug} ${play.name}`.toLowerCase();
  return solutionPlayCategories.find(([, pattern]) => pattern.test(text))?.[0] || "agent";
}

function buildSolutionPlayProjection(index) {
  if (!index || index.schema_version !== "1.0.0" || index.count !== 101 || !Array.isArray(index.plays) || index.plays.length !== 101) {
    throw new Error("Canonical Solution Play index must contain exactly 101 version 1.0.0 records");
  }
  const ids = new Set();
  const slugs = new Set();
  const plays = index.plays.map((play, offset) => {
    if (!play || typeof play !== "object") throw new Error(`Solution Play record ${offset + 1} must be an object`);
    const expectedId = String(offset + 1).padStart(2, "0");
    if (play.id !== expectedId || play.numeric_id !== offset + 1) throw new Error(`Solution Play identity is not contiguous at record ${offset + 1}`);
    if (!/^(?:0[1-9]|[1-9]\d|10[01])-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(play.slug)) throw new Error(`Solution Play ${play.id} slug is invalid`);
    if (ids.has(play.id) || slugs.has(play.slug)) throw new Error(`Duplicate Solution Play identity: ${play.id}`);
    ids.add(play.id);
    slugs.add(play.slug);
    for (const field of ["slug", "name", "description", "spec_version", "github_url", "detail_url"]) {
      if (typeof play[field] !== "string" || !play[field].trim()) throw new Error(`Solution Play ${play.id} is missing ${field}`);
    }
    if (/(?:^\s*>|\b(?:actual costs vary|production[- ](?:ready|grade)|enterprise[- ]grade|operated|deployed|compliance[- ]ready|compliant|guarantees?|satisfying)\b|\b(?:sub-?\d+\s*ms|\d+\s*%))/i.test(play.description)) throw new Error(`Solution Play ${play.id} description contains unsupported public claims`);
    if (!play.slug.startsWith(`${play.id}-`) || play.github_url !== `https://github.com/frootai/frootai/tree/main/solution-plays/${play.slug}` || play.detail_url !== `https://frootai.dev/solution-plays/${play.slug}`) {
      throw new Error(`Solution Play ${play.id} links do not match its canonical slug`);
    }
    const category = classifySolutionPlay(play);
    return {
      id: play.id,
      numericId: play.numeric_id,
      slug: play.slug,
      name: play.name,
      description: play.description,
      category,
      icon: solutionPlayIcons[category],
      specVersion: play.spec_version,
      githubUrl: play.github_url,
      detailUrl: play.detail_url,
    };
  });
  return { schemaVersion: "1.0.0", source: index.source, count: plays.length, plays };
}

function renderSolutionPlayProjection(projection) {
  const categories = [...new Set(projection.plays.map((play) => play.category))].sort();
  const icons = [...new Set(projection.plays.map((play) => play.icon))].sort();
  return `// Generated by frootai/scripts/factory/adapters/website.js. Do not edit.\n` +
    `export type SolutionPlayCategory = ${categories.map((value) => JSON.stringify(value)).join(" | ")};\n` +
    `export type SolutionPlayIcon = ${icons.map((value) => JSON.stringify(value)).join(" | ")};\n\n` +
    `export interface GeneratedSolutionPlay {\n` +
    `  readonly id: string;\n  readonly numericId: number;\n  readonly slug: string;\n  readonly name: string;\n` +
    `  readonly description: string;\n  readonly category: SolutionPlayCategory;\n  readonly icon: SolutionPlayIcon;\n` +
    `  readonly specVersion: string;\n  readonly githubUrl: string;\n  readonly detailUrl: string;\n}\n\n` +
    `export const solutionPlayProjection = ${JSON.stringify(projection, null, 2)} as const satisfies {\n` +
    `  readonly schemaVersion: "1.0.0";\n  readonly source: string;\n  readonly count: number;\n  readonly plays: readonly GeneratedSolutionPlay[];\n};\n\n` +
    `export const solutionPlays = solutionPlayProjection.plays;\n`;
}

function writeSolutionPlayProjection() {
  const indexPath = path.join(REPO_ROOT, "orchard", "registry", "solution-play-index.json");
  const projection = buildSolutionPlayProjection(readJsonSafe(indexPath));
  const outputPath = path.join(WEBSITE_ROOT, "src", "data", "generated", "solution-plays.ts");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderSolutionPlayProjection(projection), "utf8");
  return projection;
}

function buildSolutionPlayDetails(index, catalog) {
  const projection = buildSolutionPlayProjection(index);
  const catalogBySlug = new Map(catalog.plays.map((play) => [play.slug, play]));
  const playsRoot = path.resolve(REPO_ROOT, "solution-plays");
  const expectedRuntimeScenarios = new Map([
    ["01-enterprise-rag", "rag.query"],
    ["03-deterministic-agent", "deterministic.execute"],
    ["06-document-intelligence", "document.process"],
    ["07-multi-agent-service", "agents.execute"],
    ["33-voice-ai-agent", "voice.simulate-turn"],
  ]);
  const details = projection.plays.map((play) => {
    if (!/^(?:0[1-9]|[1-9]\d|10[01])-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(play.slug)) throw new Error(`Solution Play detail slug is invalid: ${play.slug}`);
    const catalogPlay = catalogBySlug.get(play.slug);
    if (!catalogPlay) throw new Error(`Solution Play detail catalog record is missing: ${play.slug}`);
    const playRoot = path.resolve(playsRoot, play.slug);
    if (!playRoot.startsWith(`${playsRoot}${path.sep}`)) throw new Error(`Solution Play detail path escapes the canonical root: ${play.slug}`);
    const specPath = path.join(playRoot, "spec", "play-spec.json");
    const spec = readJsonSafe(specPath);
    if (!spec || spec.name !== play.slug || spec.version !== play.specVersion) throw new Error(`Solution Play detail spec drifted: ${play.slug}`);
    const runtimePath = path.join(playRoot, "spec", "runtime-contract.json");
    const runtime = readJsonSafe(runtimePath);
    if (runtime && (runtime.play !== play.slug || runtime.schema_version !== "1.0.0")) throw new Error(`Solution Play runtime contract drifted: ${play.slug}`);
    const expectedScenario = expectedRuntimeScenarios.get(play.slug);
    if (expectedScenario && (!runtime || runtime.scenario?.id !== expectedScenario)) throw new Error(`Required Solution Play runtime contract is missing or drifted: ${play.slug}`);
    if (!expectedScenario && runtime) throw new Error(`Unexpected Solution Play runtime contract: ${play.slug}`);
    const wafPillars = Object.keys(spec.waf_alignment || {}).map((key) => key.replace(/_/g, "-")).sort(compareText);
    const evidenceFlags = runtime ? Object.entries(runtime.evidence || {}).filter(([, enabled]) => enabled === true).map(([key]) => key.replace(/_/g, "-")).sort(compareText) : [];
    const detail = {
      ...play,
      architecturePattern: typeof spec.architecture?.pattern === "string" && spec.architecture.pattern.trim() ? spec.architecture.pattern.trim() : "documented-solution",
      wafPillars,
      sourceInventory: {
        manifest: catalogPlay.hasManifest === true,
        rootAgent: catalogPlay.hasRootAgent === true,
        configuration: catalogPlay.infrastructure?.config === true,
        infrastructure: catalogPlay.infrastructure?.bicep === true,
        evaluation: catalogPlay.infrastructure?.evaluation === true,
        agents: Number(catalogPlay.devkit?.agents || 0),
        skills: Number(catalogPlay.devkit?.skills || 0),
        instructions: Number(catalogPlay.devkit?.instructions || 0),
        hooks: Number(catalogPlay.devkit?.hooks || 0),
      },
      guardrails: catalogPlay.speckit?.guardrails || {},
      runtime: runtime ? {
        schemaVersion: runtime.schema_version,
        profile: runtime.profile,
        scenarioId: runtime.scenario?.id,
        scenarioVersion: runtime.scenario?.version,
        inputSchema: runtime.scenario?.input_schema,
        outputSchema: runtime.scenario?.output_schema,
        endpoints: runtime.endpoints,
        offlineAdapter: runtime.adapters?.offline,
        azurePorts: [...(runtime.adapters?.azure_ports || [])].sort(compareText),
        requiredResourceTypes: [...(runtime.infrastructure?.required_resource_types || [])].sort(compareText),
        requiredResourceKinds: runtime.infrastructure?.required_resource_kinds || {},
        evidenceFlags,
      } : null,
    };
    validateSolutionPlayDetail(detail);
    return detail;
  });
  if (details.length !== 101 || details.filter((detail) => detail.runtime !== null).length !== expectedRuntimeScenarios.size) throw new Error("Solution Play details require exactly 101 records and the five canonical runtime contracts");
  return { schemaVersion: "1.0.0", source: index.source, count: details.length, runtimeContractCount: 5, details };
}

function validateSolutionPlayDetail(detail) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) throw new Error("Solution Play detail must be an object");
  for (const field of ["status", "complexity", "services", "devkit", "tunekit", "tuningParams", "costDev", "costProd"]) if (Object.hasOwn(detail, field)) throw new Error(`Solution Play detail contains prohibited field ${field}: ${detail.slug || "unknown"}`);
  if (!/^(?:0[1-9]|[1-9]\d|10[01])$/.test(detail.id) || !new RegExp(`^${detail.id}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(detail.slug) || typeof detail.name !== "string" || !detail.name || typeof detail.description !== "string" || !detail.description) throw new Error(`Solution Play detail identity is invalid: ${detail.slug || "unknown"}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(detail.architecturePattern) || !Array.isArray(detail.wafPillars) || !detail.wafPillars.every((pillar) => /^[a-z0-9][a-z0-9-]*$/.test(pillar))) throw new Error(`Solution Play detail architecture metadata is invalid: ${detail.slug}`);
  const inventory = detail.sourceInventory;
  if (!inventory || !["manifest", "rootAgent", "configuration", "infrastructure", "evaluation"].every((key) => typeof inventory[key] === "boolean") || !["agents", "skills", "instructions", "hooks"].every((key) => Number.isSafeInteger(inventory[key]) && inventory[key] >= 0 && inventory[key] <= 1000)) throw new Error(`Solution Play detail inventory is invalid: ${detail.slug}`);
  if (!detail.guardrails || typeof detail.guardrails !== "object" || Array.isArray(detail.guardrails) || JSON.stringify(detail.guardrails).length > 2000) throw new Error(`Solution Play detail guardrails are invalid: ${detail.slug}`);
  if (detail.runtime !== null) {
    const runtime = detail.runtime;
    if (runtime.schemaVersion !== "1.0.0" || typeof runtime.profile !== "string" || typeof runtime.scenarioId !== "string" || typeof runtime.scenarioVersion !== "string" || !runtime.inputSchema || typeof runtime.inputSchema !== "object" || !runtime.outputSchema || typeof runtime.outputSchema !== "object" || !runtime.endpoints || typeof runtime.offlineAdapter !== "string" || !runtime.requiredResourceKinds || typeof runtime.requiredResourceKinds !== "object" || Array.isArray(runtime.requiredResourceKinds)) throw new Error(`Solution Play detail runtime is invalid: ${detail.slug}`);
    for (const values of [runtime.azurePorts, runtime.requiredResourceTypes, runtime.evidenceFlags]) if (!Array.isArray(values) || !values.every((value) => typeof value === "string" && value.length > 0)) throw new Error(`Solution Play detail runtime arrays are invalid: ${detail.slug}`);
    if (JSON.stringify(runtime.inputSchema).length > 4000 || JSON.stringify(runtime.outputSchema).length > 4000 || JSON.stringify(runtime.requiredResourceKinds).length > 4000) throw new Error(`Solution Play detail runtime payload is oversized: ${detail.slug}`);
  }
  const serialized = JSON.stringify(detail);
  if (serialized.length > 12000 || /production[- ](?:ready|grade)|(?:^|\s)#{1,6}\s|```/i.test(serialized)) throw new Error(`Solution Play detail contains prohibited or oversized content: ${detail.slug}`);
  return true;
}

function renderSolutionPlayDetails(data) {
  const metadata = data.details.map(({ slug, architecturePattern, wafPillars, sourceInventory, guardrails, runtime }) => ({ slug, architecturePattern, wafPillars, sourceInventory, guardrails, runtime }));
  return `// Generated by frootai/scripts/factory/adapters/website.js. Do not edit.\n` +
    `import { solutionPlays, type GeneratedSolutionPlay } from "./solution-plays.ts";\n\n` +
    `export type GeneratedJsonValue = string | number | boolean | null | readonly GeneratedJsonValue[] | { readonly [key: string]: GeneratedJsonValue };\n\n` +
    `export interface GeneratedSolutionPlaySourceInventory {\n  readonly manifest: boolean;\n  readonly rootAgent: boolean;\n  readonly configuration: boolean;\n  readonly infrastructure: boolean;\n  readonly evaluation: boolean;\n  readonly agents: number;\n  readonly skills: number;\n  readonly instructions: number;\n  readonly hooks: number;\n}\n\n` +
    `export interface GeneratedSolutionPlayRuntime {\n  readonly schemaVersion: "1.0.0";\n  readonly profile: string;\n  readonly scenarioId: string;\n  readonly scenarioVersion: string;\n  readonly inputSchema: Readonly<Record<string, GeneratedJsonValue>>;\n  readonly outputSchema: Readonly<Record<string, GeneratedJsonValue>>;\n  readonly endpoints: Readonly<Record<string, string>>;\n  readonly offlineAdapter: string;\n  readonly azurePorts: readonly string[];\n  readonly requiredResourceTypes: readonly string[];\n  readonly requiredResourceKinds: Readonly<Record<string, readonly string[]>>;\n  readonly evidenceFlags: readonly string[];\n}\n\n` +
    `interface GeneratedSolutionPlayDetailMetadata {\n  readonly slug: string;\n  readonly architecturePattern: string;\n  readonly wafPillars: readonly string[];\n  readonly sourceInventory: GeneratedSolutionPlaySourceInventory;\n  readonly guardrails: Readonly<Record<string, GeneratedJsonValue>>;\n  readonly runtime: GeneratedSolutionPlayRuntime | null;\n}\n\n` +
    `export interface GeneratedSolutionPlayDetail extends GeneratedSolutionPlay, Omit<GeneratedSolutionPlayDetailMetadata, "slug"> {}\n\n` +
    `const solutionPlayDetailMetadata = ${JSON.stringify(metadata, null, 2)} as const satisfies readonly GeneratedSolutionPlayDetailMetadata[];\n\n` +
    `const metadataBySlug = new Map(solutionPlayDetailMetadata.map((detail) => [detail.slug, detail]));\n` +
    `export const solutionPlayDetails: readonly GeneratedSolutionPlayDetail[] = solutionPlays.map((play) => {\n  const metadata = metadataBySlug.get(play.slug);\n  if (!metadata) throw new Error(\`Generated Solution Play detail is missing: \${play.slug}\`);\n  return { ...play, ...metadata };\n});\n\n` +
    `export const solutionPlayDetailProjection = { schemaVersion: "1.0.0", source: ${JSON.stringify(data.source)}, count: 101, runtimeContractCount: 5, details: solutionPlayDetails } as const;\n`;
}

function writeSolutionPlayDetails(catalog) {
  const index = readJsonSafe(path.join(REPO_ROOT, "orchard", "registry", "solution-play-index.json"));
  const data = buildSolutionPlayDetails(index, catalog);
  const outputPath = path.join(WEBSITE_ROOT, "src", "data", "generated", "solution-play-details.ts");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderSolutionPlayDetails(data), "utf8");
  return data;
}

function writeSearchIndex(catalog) {
  const searchIndex = buildSearchIndex(catalog);
  writeJsonCompact(path.join(WEBSITE_ROOT, "public", "search-index.json"), searchIndex);
  return searchIndex;
}

// ══════════════════════════════════════════════════════════════
// TRANSFORMERS — catalog → website JSON schema
// ══════════════════════════════════════════════════════════════

/**
 * Transform catalog agents → website agents.json
 * Website schema: { id, name, description, waf[], file, size }
 */
function transformAgents(catalog) {
  return catalog.agents.map((a) => ({
    id: a.id,
    name: a.name || formatName(a.id),
    description: a.description || "",
    waf: a.waf || [],
    file: a.file,
    size: a.lines ? a.lines * 60 : 0, // approximate bytes from line count
  }));
}

/**
 * Transform catalog instructions → website instructions.json
 * Website schema: { id, description, applyTo, file, size }
 */
function transformInstructions(catalog) {
  return catalog.instructions.map((i) => ({
    id: i.id,
    description: i.description || "",
    applyTo: i.applyTo || "",
    file: i.file,
    size: i.lines ? i.lines * 60 : 0,
  }));
}

/**
 * Transform catalog skills → website skills.json
 * Website schema: { id, name, description, folder, size }
 */
function transformSkills(catalog) {
  return catalog.skills.map((s) => ({
    id: s.id,
    name: s.name || s.id,
    description: s.description || "",
    folder: s.folder ? s.folder + "/" : `skills/${s.id}/`,
    size: s.lines ? s.lines * 60 : 0,
  }));
}

/**
 * Transform catalog hooks → website hooks.json
 * Website schema: { id, name, description, events[], folder, size }
 * Enriches from hooks.json files on disk since catalog only has sparse data.
 */
function transformHooks(catalog) {
  return catalog.hooks.map((h) => {
    // Read the actual hooks.json for rich metadata
    const hookDir = path.join(REPO_ROOT, h.folder);
    const hooksJsonPath = path.join(hookDir, "hooks.json");
    const hooksJson = readJsonSafe(hooksJsonPath);

    // Read README.md or the main script for description
    let name = formatName(h.id);
    let description = "";
    let size = 0;

    // Get name/description from hooks.json if available
    if (hooksJson && Array.isArray(hooksJson.hooks)) {
      const firstHook = hooksJson.hooks[0];
      if (firstHook) {
        description = firstHook.description || "";
      }
    }

    // Try README for better description
    const readmePath = path.join(hookDir, "README.md");
    const readmeContent = readFileSafe(readmePath);
    if (readmeContent) {
      const meta = extractMarkdownMeta(readmeContent);
      if (meta.title) name = meta.title;
      if (meta.description && meta.description.length > description.length) {
        description = meta.description;
      }
    }

    // Calculate folder size
    try {
      const files = fs.readdirSync(hookDir);
      for (const f of files) {
        const stat = fs.statSync(path.join(hookDir, f));
        if (stat.isFile()) size += stat.size;
      }
    } catch { /* folder doesn't exist */ }

    return {
      id: h.id,
      name,
      description,
      events: h.events || [],
      folder: h.folder + "/",
      size,
    };
  });
}

/**
 * Transform catalog plugins → website plugins.json
 * Website schema: { id, description, version, keywords[], plays[], items, folder }
 */
function transformPlugins(catalog) {
  return catalog.plugins.map((p) => {
    // Compute items count from plugin.json on disk
    let items = typeof p.items === "number" ? p.items : 0;
    if (!items) {
      const pluginJsonPath = path.join(REPO_ROOT, p.folder || `plugins/${p.id}`, "plugin.json");
      const pluginJson = readJsonSafe(pluginJsonPath);
      if (pluginJson) {
        // Count all primitive arrays in plugin.json
        items =
          (pluginJson.agents || []).length +
          (pluginJson.instructions || []).length +
          (pluginJson.skills || []).length +
          (pluginJson.hooks || []).length +
          (pluginJson.workflows || []).length +
          (pluginJson.prompts || []).length;
      }
    }

    return {
      id: p.id,
      description: p.description || "",
      version: p.version || "1.0.0",
      keywords: p.keywords || [],
      plays: p.plays || [],
      items,
      folder: p.folder ? p.folder + "/" : `plugins/${p.id}/`,
    };
  });
}

/**
 * Transform catalog workflows → website workflows.json
 * Website schema: { id, name, description, steps, file }
 */
function transformWorkflows(catalog) {
  return catalog.workflows.map((w) => {
    // Count steps (numbered items) from the actual file
    const content = readFileSafe(path.join(REPO_ROOT, w.file));
    const stepCount = (content.match(/^\d+\.\s+\*\*/gm) || []).length ||
                      (content.match(/^###?\s+Step\s+\d+/gm) || []).length ||
                      Math.max(0, Math.floor((w.lines || 0) / 25));

    return {
      id: w.id,
      name: w.name || w.id,
      description: w.description || "",
      steps: stepCount || 10,
      file: w.file,
    };
  });
}

/**
 * Transform catalog cookbook → website cookbook.json
 * Website schema: { id, title, steps, file, size }
 */
function transformCookbook(catalog) {
  return catalog.cookbook.map((c) => {
    const content = readFileSafe(path.join(REPO_ROOT, c.file));
    const meta = extractMarkdownMeta(content);
    const stepCount = (content.match(/^\d+\.\s+\*\*/gm) || []).length ||
                      (content.match(/^## Step\s+\d+/gm) || []).length || 0;

    return {
      id: c.id,
      title: meta.title || formatName(c.id),
      steps: stepCount,
      file: c.file,
      size: c.lines ? c.lines * 60 : 0,
    };
  });
}

/**
 * Generate stats.json from catalog stats.
 * Website schema: { generated, counts, marketplace, competitor }
 */
function transformStats(catalog) {
  const s = catalog.stats;
  return {
    generated: catalog.generated,
    counts: {
      agents: s.agents || 0,
      instructions: s.instructions || 0,
      skills: s.skills || 0,
      hooks: s.hooks || 0,
      plugins: s.plugins || 0,
      workflows: s.workflows || 0,
      cookbook: s.cookbook || 0,
      solutionPlays: s.plays || 0,
      schemas: 7,
      engineModules: 8,
      cicdWorkflows: 15,
      mcpTools: s.mcpTools || 25,
    },
    marketplace: {
      plugins: s.plugins || 0,
      totalItems: catalog.plugins
        ? catalog.plugins.reduce((sum, p) => sum + (p.items || 0), 0)
        : 0,
      avgItemsPerPlugin: catalog.plugins
        ? +(
            catalog.plugins.reduce((sum, p) => sum + (p.items || 0), 0) /
            Math.max(1, s.plugins)
          ).toFixed(1)
        : 0,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// SEARCH INDEX — comprehensive full-text search index
// ══════════════════════════════════════════════════════════════

function toHash(text) {
  return (
    "#" +
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "")
      .replace(/^-+/, "")
  );
}

function clean(text) {
  return (text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>|_~]/g, "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str, max) {
  return str && str.length > max ? str.substring(0, max) : str || "";
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted(items, selector) {
  return [...items].sort((left, right) => compareText(selector(left), selector(right)));
}

const searchEntryTypes = new Set([
  "agent", "doc", "heading", "hook", "instruction", "learning", "mcp-tool", "page", "play",
  "play-category", "plugin", "recipe", "skill", "user-guide", "waf-pillar", "workflow",
]);

function validateSearchIndex(entries) {
  if (!Array.isArray(entries) || entries.length < 1) throw new Error("Search index must contain entries");
  const identities = new Set();
  for (const [offset, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Search entry ${offset} must be an object`);
    const allowed = new Set(["t", "u", "b", "type", "parent"]);
    for (const key of Object.keys(entry)) if (!allowed.has(key)) throw new Error(`Search entry ${offset} contains unknown field: ${key}`);
    if (typeof entry.t !== "string" || !entry.t.trim() || entry.t.length > 256) throw new Error(`Search entry ${offset} title is invalid`);
    if (typeof entry.u !== "string" || !entry.u.startsWith("/") || entry.u.startsWith("//") || entry.u.includes("..") || /\\|%(?:2f|5c)/i.test(entry.u) || entry.u.length > 512) throw new Error(`Search entry ${offset} URL is invalid`);
    if (new URL(entry.u, "https://frootai.dev").origin !== "https://frootai.dev") throw new Error(`Search entry ${offset} URL escapes the website origin`);
    if (typeof entry.b !== "string" || entry.b.length > 400) throw new Error(`Search entry ${offset} body is invalid`);
    if (typeof entry.type !== "string" || !searchEntryTypes.has(entry.type)) throw new Error(`Search entry ${offset} type is invalid`);
    if (entry.parent !== undefined && (typeof entry.parent !== "string" || !entry.parent.trim() || entry.parent.length > 256)) throw new Error(`Search entry ${offset} parent is invalid`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(`${entry.t}${entry.u}${entry.b}${entry.parent || ""}`)) throw new Error(`Search entry ${offset} contains control characters`);
    const identity = `${entry.type}\u0000${entry.t}\u0000${entry.u}`;
    if (identities.has(identity)) throw new Error(`Duplicate search entry: ${entry.type} ${entry.t} ${entry.u}`);
    identities.add(identity);
  }
  return { valid: true, count: entries.length };
}

function finalizeSearchIndex(entries) {
  const byIdentity = new Map();
  for (const entry of entries) {
    const normalized = {
      t: clean(entry.t),
      u: entry.u.trim(),
      b: truncate(clean(entry.b), 400),
      type: entry.type,
      ...(entry.parent ? { parent: clean(entry.parent) } : {}),
    };
    const identity = `${normalized.type}\u0000${normalized.t}\u0000${normalized.u}`;
    const existing = byIdentity.get(identity);
    if (!existing) byIdentity.set(identity, normalized);
    else if (JSON.stringify(existing) === JSON.stringify(normalized)) continue;
    else throw new Error(`Conflicting duplicate search entry: ${normalized.type} ${normalized.t} ${normalized.u}`);
  }
  const result = sorted([...byIdentity.values()], (entry) => `${entry.type}\u0000${entry.u}\u0000${entry.t}\u0000${entry.parent || ""}\u0000${entry.b}`);
  validateSearchIndex(result);
  return result;
}

/**
 * Build comprehensive search index from catalog + docs + learning pages.
 */
function buildSearchIndex(catalog) {
  const index = [];

  // 1. Static pages
  const pages = [
    { t: "Home — FrootAI", u: "/", b: "FrootAI from the roots to the fruits BIY build it yourself AI LEGO kit infrastructure platform application teams ecosystem FAI Protocol engine factory packages toolkit marketplace", type: "page" },
    { t: "Solution Configurator", u: "/configurator", b: "configurator wizard 3 questions recommend solution play RAG agent document voice content moderation landing zone", type: "page" },
    { t: `Solution Plays (${catalog.stats.plays})`, u: "/solution-plays", b: `${catalog.stats.plays} solution plays DevKit TuneKit SpecKit enterprise RAG agentic multi-agent voice AI code review document intelligence copilot content moderation landing zone model serving fine-tuning gateway`, type: "page" },
    { t: "FROOT Packages", u: "/packages", b: "packages modules download foundations reasoning orchestration operations transformation MCP tools knowledge", type: "page" },
    { t: "Ecosystem Overview", u: "/ecosystem", b: "ecosystem overview primitives agents instructions skills hooks plugins workflows cookbook MCP VS Code Docker CLI solution plays packages FAI Protocol engine", type: "page" },
    { t: "FAI VS Code Extension", u: "/vscode-extension", b: "VS Code extension sidebar plays primitives protocol MCP views open solution play browse agents skills hooks instructions", type: "page" },
    { t: "FAI MCP Server", u: "/mcp-tooling", b: "MCP model context protocol server tools agent knowledge search lookup architecture Claude Copilot Cursor Windsurf Foundry", type: "page" },
    { t: "FAI CLI (npx frootai)", u: "/cli", b: "CLI command line terminal scaffold search cost deploy doctor validate init primitives protocol npx frootai", type: "page" },
    { t: "FAI Docker Image", u: "/docker", b: "Docker container multi-arch arm64 amd64 kubernetes sidecar zero install ghcr.io/frootai/mcp-server", type: "page" },
    { t: "Setup Guide", u: "/setup-guide", b: "setup install configure MCP VS Code CLI Docker Claude Cursor Foundry getting started quick start", type: "page" },
    { t: "Hi FAI — 5-Minute Quickstart", u: "/hi-fai", b: "quickstart 5 minutes getting started welcome DevKit TuneKit auto-chain extension MCP hello world", type: "page" },
    { t: "Agent FAI Chatbot", u: "/chatbot", b: "chatbot AI assistant agent GPT streaming cost estimation play search recommendation ask question", type: "page" },
    { t: "Partner Integrations", u: "/partners", b: "partners ServiceNow Salesforce SAP Datadog PagerDuty Jira MCP enterprise ITSM CRM ERP", type: "page" },
    { t: `FAI Plugin Marketplace (${catalog.stats.plugins})`, u: "/marketplace", b: `marketplace ${catalog.stats.plugins} plugins community publish agent skill prompt discover RAG code review security`, type: "page" },
    { t: "Open Source Community", u: "/community", b: "community open source MIT free forever contribute star GitHub discussions", type: "page" },
    { t: "Contribute to FrootAI", u: "/contribute", b: "contribute contributing open source how to add agent instruction skill hook plugin workflow play pull request", type: "page" },
    { t: "FrootAI Adoption", u: "/adoption", b: "adoption metrics stats ecosystem health integration VS Code Claude Cursor Windsurf Foundry", type: "page" },
    { t: "Knowledge Modules", u: "/docs", b: "knowledge modules FROOT foundations reasoning orchestration operations transformation AI glossary GenAI LLM RAG prompt engineering semantic kernel agents MCP fine-tuning responsible AI production", type: "page" },
    { t: "Learning Hub", u: "/learning-hub", b: "learning hub modules quick start primitive primer agent patterns skills workshop hooks deep dive instructions authoring context wiring MCP integration plugins marketplace workflows configuration end-to-end", type: "page" },
    { t: "FAI Protocol", u: "/fai-protocol", b: "FAI Protocol fai-manifest.json fai-context.json context wiring primitives play specification infrastructure toolkit guardrails knowledge WAF alignment schemas", type: "page" },
    { t: "FAI Engine", u: "/fai-engine", b: "FAI Engine runtime manifest loader context wirer guardrail evaluator toolkit assembler factory pipeline play resolver", type: "page" },
    { t: `Primitives Catalog (${catalog.stats.totalPrimitives}+)`, u: "/primitives", b: `primitives catalog ${catalog.stats.totalPrimitives}+ agents instructions skills hooks plugins workflows cookbook FAI Protocol LEGO blocks`, type: "page" },
    { t: `Agents (${catalog.stats.agents})`, u: "/primitives/agents", b: `${catalog.stats.agents} agents .agent.md copilot customization persona tools model WAF alignment`, type: "page" },
    { t: `Instructions (${catalog.stats.instructions})`, u: "/primitives/instructions", b: `${catalog.stats.instructions} instructions .instructions.md applyTo glob patterns coding standards WAF pillar`, type: "page" },
    { t: `Skills (${catalog.stats.skills})`, u: "/primitives/skills", b: `${catalog.stats.skills} skills SKILL.md LEGO blocks reusable capabilities step-by-step procedures`, type: "page" },
    { t: `Hooks (${catalog.stats.hooks})`, u: "/primitives/hooks", b: `${catalog.stats.hooks} hooks hooks.json lifecycle events sessionStart security scanning governance`, type: "page" },
    { t: `Workflows (${catalog.stats.workflows})`, u: "/workflows", b: `${catalog.stats.workflows} workflows GitHub Actions CI/CD automation pipeline`, type: "page" },
    { t: `Cookbook (${catalog.stats.cookbook} Recipes)`, u: "/cookbook", b: `${catalog.stats.cookbook} cookbook recipes step-by-step tutorials hands-on`, type: "page" },
    { t: "Evaluation Dashboard", u: "/eval-dashboard", b: "evaluation dashboard groundedness coherence relevance fluency safety cost quality metrics", type: "page" },
    { t: "REST API", u: "/api-docs", b: "REST API endpoints chat stream search-plays estimate-cost health POST GET", type: "page" },
  ];
  pages.forEach((p) => index.push(p));

  // 2. Solution Plays — safe canonical listing projection from T227
  const canonicalIndex = readJsonSafe(path.join(REPO_ROOT, "orchard", "registry", "solution-play-index.json"));
  const projection = buildSolutionPlayProjection(canonicalIndex);
  for (const play of projection.plays) {

    // Play overview entry
    index.push({
      t: `Play ${play.id}: ${play.name}`,
      u: `/solution-plays/${play.slug}`,
      b: `${play.name} ${play.description} ${play.category} solution play ${play.slug}`,
      type: "play",
    });

    // User guide entry
    index.push({
      t: `${play.name} — User Guide`,
      u: `/solution-plays/${play.slug}#user-guide`,
      b: `${play.name} user guide reference architecture ${play.description}`,
      type: "user-guide",
    });
  }

  for (const category of sorted([...new Set(projection.plays.map((play) => play.category))], (value) => value)) {
    const categoryPlays = projection.plays.filter((play) => play.category === category);
    index.push({
      t: `${formatName(category)} Solution Plays`,
      u: `/solution-plays?cat=${category}`,
      b: `${category} solution plays ${categoryPlays.map((play) => `${play.id} ${play.name}`).join(" ")}`,
      type: "play-category",
    });
  }

  // 3. Agents — each agent as search entry
  for (const agent of sorted(catalog.agents, (item) => item.id)) {
    index.push({
      t: agent.name || formatName(agent.id),
      u: `/primitives/agents${toHash(agent.id)}`,
      b: truncate(clean(`${agent.name || ""} ${agent.description || ""} ${(agent.waf || []).join(" ")} agent`), 300),
      type: "agent",
    });
  }

  // 4. Instructions
  for (const instr of sorted(catalog.instructions, (item) => item.id)) {
    index.push({
      t: formatName(instr.id),
      u: `/primitives/instructions${toHash(instr.id)}`,
      b: truncate(clean(`${instr.id} ${instr.description || ""} ${instr.applyTo || ""} instruction`), 300),
      type: "instruction",
    });
  }

  // 5. Skills
  for (const skill of sorted(catalog.skills, (item) => item.id)) {
    index.push({
      t: skill.name || formatName(skill.id),
      u: `/primitives/skills${toHash(skill.id)}`,
      b: truncate(clean(`${skill.name || ""} ${skill.description || ""} skill`), 300),
      type: "skill",
    });
  }

  // 6. Hooks
  for (const hook of sorted(catalog.hooks, (item) => item.id)) {
    index.push({
      t: formatName(hook.id),
      u: `/primitives/hooks${toHash(hook.id)}`,
      b: truncate(clean(`${hook.id} ${(hook.events || []).join(" ")} hook lifecycle`), 200),
      type: "hook",
    });
  }

  // 7. Plugins
  for (const plugin of sorted(catalog.plugins, (item) => item.id)) {
    index.push({
      t: formatName(plugin.id),
      u: `/marketplace${toHash(plugin.id)}`,
      b: truncate(clean(`${plugin.id} ${plugin.description || ""} ${(plugin.keywords || []).join(" ")} plugin marketplace`), 300),
      type: "plugin",
    });
  }

  // 8. Workflows
  for (const wf of sorted(catalog.workflows, (item) => item.id)) {
    index.push({
      t: formatName(wf.id),
      u: "/workflows",
      b: truncate(clean(`${wf.id} ${wf.description || ""} workflow automation CI/CD`), 300),
      type: "workflow",
    });
  }

  // 9. Cookbook
  const cookbookIds = new Set(catalog.cookbook.map((item) => item.id));
  const searchableCookbook = catalog.cookbook.filter((item) => !item.id.endsWith(".lean") || !cookbookIds.has(item.id.slice(0, -5)));
  for (const recipe of sorted(searchableCookbook, (item) => item.id)) {
    const content = readFileSafe(path.join(REPO_ROOT, recipe.file));
    const meta = extractMarkdownMeta(content);
    index.push({
      t: meta.title || formatName(recipe.id),
      u: "/cookbook",
      b: truncate(clean(`${meta.title || ""} ${meta.description || ""} recipe tutorial cookbook`), 300),
      type: "recipe",
    });
  }

  // 10. Docs pages — index from docs/ markdown files
  const DOCS_DIR = path.join(REPO_ROOT, "docs");
  if (fs.existsSync(DOCS_DIR)) {
    const docFiles = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md")).sort(compareText);
    for (const file of docFiles) {
      const content = readFileSafe(path.join(DOCS_DIR, file));
      const meta = extractMarkdownMeta(content);
      const slug = file.replace(".md", "");
      index.push({
        t: meta.title || slug,
        u: `/docs/${slug}`,
        b: truncate(clean(content.substring(0, 1000)), 400),
        type: "doc",
      });

      // Index headings
      const headings = content.match(/^#{2,4}\s+.+$/gm) || [];
      for (const heading of headings) {
        const text = heading.replace(/^#+\s+/, "").trim();
        index.push({
          t: text,
          u: `/docs/${slug}${toHash(text)}`,
          b: truncate(clean(`${meta.title || slug} ${text}`), 200),
          type: "heading",
        });
      }
    }
  }

  // 11. Learning pages
  const learningDir = path.join(WEBSITE_ROOT, "src", "app", "learning-hub");
  if (fs.existsSync(learningDir)) {
    const learningPages = fs.readdirSync(learningDir, { withFileTypes: true }).sort((left, right) => compareText(left.name, right.name));
    for (const entry of learningPages) {
      if (entry.isDirectory() && !entry.name.startsWith("[")) {
        const pageTsx = path.join(learningDir, entry.name, "page.tsx");
        if (fs.existsSync(pageTsx)) {
          const content = readFileSafe(pageTsx);
          const titleMatch = content.match(/title[=:]\s*["']([^"']+)["']/);
          const title = titleMatch ? titleMatch[1] : formatName(entry.name);
          index.push({
            t: title,
            u: `/learning-hub/${entry.name}`,
            b: truncate(clean(`${title} learning hub tutorial guide`), 200),
            type: "learning",
          });
        }
      }
    }
  }

  // 12. WAF pillars
  const wafPillars = [
    { name: "Reliability", desc: "retry circuit-breaker health-checks graceful-degradation data-resilience timeouts" },
    { name: "Security", desc: "managed-identity key-vault RBAC private-endpoints TLS encryption content-safety" },
    { name: "Cost Optimization", desc: "right-sizing model-routing token-budgets caching auto-scaling spot-instances" },
    { name: "Operational Excellence", desc: "CI/CD observability IaC incident-management automation structured-logging" },
    { name: "Performance Efficiency", desc: "streaming caching async parallel bundle-optimization CDN semantic-ranker" },
    { name: "Responsible AI", desc: "content-safety groundedness fairness transparency privacy human-oversight bias-detection" },
  ];
  for (const pillar of wafPillars) {
    index.push({
      t: `WAF: ${pillar.name}`,
      u: "/primitives",
      b: `Well-Architected Framework ${pillar.name} ${pillar.desc}`,
      type: "waf-pillar",
    });
  }

  // 13. MCP tools from catalog (if available as array)
  if (Array.isArray(catalog.mcpTools)) {
    for (const tool of sorted(catalog.mcpTools, (item) => item.name || item.id)) {
      index.push({
        t: tool.name || tool.id,
        u: `/mcp-tooling${toHash(tool.name || tool.id)}`,
        b: truncate(clean(`${tool.name || ""} ${tool.description || ""} MCP tool`), 200),
        type: "mcp-tool",
      });
    }
  }

  return finalizeSearchIndex(index);
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * Convert kebab-case ID to Title Case display name.
 * "fai-rag-architect" → "FAI RAG Architect"
 * @param {string} id
 * @returns {string}
 */
function formatName(id) {
  return id
    .replace(/^fai-/, "FAI ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bFai\b/g, "FAI")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bMcp\b/g, "MCP")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bAks\b/g, "AKS")
    .replace(/\bWaf\b/g, "WAF")
    .replace(/\bIac\b/g, "IaC")
    .replace(/\bCi\b/g, "CI")
    .replace(/\bCd\b/g, "CD")
    .replace(/\bApi\b/g, "API")
    .replace(/\bSdk\b/g, "SDK")
    .replace(/\bLlm\b/g, "LLM")
    .replace(/\bOcr\b/g, "OCR")
    .replace(/\bStt\b/g, "STT")
    .replace(/\bTts\b/g, "TTS")
    .replace(/\bIot\b/g, "IoT")
    .replace(/\bPii\b/g, "PII")
    .replace(/\bGdpr\b/g, "GDPR")
    .trim();
}

/**
 * Write JSON to file with consistent formatting.
 * @param {string} filePath
 * @param {unknown} data
 */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Write JSON array compactly (one entry per line for large arrays).
 * @param {string} filePath
 * @param {unknown[]} data
 */
function writeJsonCompact(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // For arrays > 50 entries, use compact format to keep file size down
  if (Array.isArray(data) && data.length > 50) {
    const lines = data.map((item) => "  " + JSON.stringify(item));
    fs.writeFileSync(filePath, "[\n" + lines.join(",\n") + "\n]\n");
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN ADAPTER
// ══════════════════════════════════════════════════════════════

function adapt(catalog) {
  const results = { channel: "website", updates: [] };
  const dataDir = path.join(WEBSITE_ROOT, "public", "data");

  if (!fs.existsSync(WEBSITE_ROOT)) {
    results.updates.push(`⚠️  Website root not found: ${WEBSITE_ROOT}`);
    return results;
  }

  fs.mkdirSync(dataDir, { recursive: true });

  const solutionPlays = writeSolutionPlayProjection();
  results.updates.push(`src/data/generated/solution-plays.ts — ${solutionPlays.count} plays`);
  const solutionPlayDetails = writeSolutionPlayDetails(catalog);
  results.updates.push(`src/data/generated/solution-play-details.ts — ${solutionPlayDetails.count} details, ${solutionPlayDetails.runtimeContractCount} runtime contracts`);

  // 1. agents.json
  const agents = transformAgents(catalog);
  writeJsonCompact(path.join(dataDir, "agents.json"), agents);
  results.updates.push(`agents.json — ${agents.length} agents`);

  // 2. instructions.json
  const instructions = transformInstructions(catalog);
  writeJsonCompact(path.join(dataDir, "instructions.json"), instructions);
  results.updates.push(`instructions.json — ${instructions.length} instructions`);

  // 3. skills.json
  const skills = transformSkills(catalog);
  writeJsonCompact(path.join(dataDir, "skills.json"), skills);
  results.updates.push(`skills.json — ${skills.length} skills`);

  // 4. hooks.json
  const hooks = transformHooks(catalog);
  writeJson(path.join(dataDir, "hooks.json"), hooks);
  results.updates.push(`hooks.json — ${hooks.length} hooks`);

  // 5. plugins.json
  const plugins = transformPlugins(catalog);
  writeJsonCompact(path.join(dataDir, "plugins.json"), plugins);
  results.updates.push(`plugins.json — ${plugins.length} plugins`);

  // 6. workflows.json
  const workflows = transformWorkflows(catalog);
  writeJson(path.join(dataDir, "workflows.json"), workflows);
  results.updates.push(`workflows.json — ${workflows.length} workflows`);

  // 7. cookbook.json
  const cookbook = transformCookbook(catalog);
  writeJson(path.join(dataDir, "cookbook.json"), cookbook);
  results.updates.push(`cookbook.json — ${cookbook.length} recipes`);

  // 8. stats.json
  const stats = transformStats(catalog);
  writeJson(path.join(dataDir, "stats.json"), stats);
  results.updates.push(`stats.json — ${stats.counts.agents} agents, ${stats.counts.skills} skills, ${stats.counts.solutionPlays} plays`);

  // 9. search-index.json
  const searchIndex = writeSearchIndex(catalog);
  results.updates.push(`search-index.json — ${searchIndex.length} entries`);

  const solutionPlayManifest = writeSolutionPlayArtifactManifest();
  results.updates.push(`solution-play-projection-manifest.json — core@${solutionPlayManifest.source.commitSha.slice(0, 8)}, ${Object.keys(solutionPlayManifest.artifacts).length} artifacts`);

  // 10. Preserve versions.json (fetched from live registries, not from catalog)
  // versions.json is generated by scripts/fetch-versions.js — we don't overwrite it

  return results;
}

if (require.main === module) {
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory:catalog first.");
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log(`🌐 FAI Factory — Website Adapter`);
  console.log(`   Source: ${catalogPath}`);
  console.log(`   Target: ${WEBSITE_ROOT}`);
  console.log(`══════════════════════════════════════`);
  const r = adapt(catalog);
  console.log(`\n  📦 ${r.channel}:`);
  r.updates.forEach((u) => console.log(`     ✅ ${u}`));
  console.log(`\n  Done.`);
}

module.exports = { adapt, buildSearchIndex, buildSolutionPlayArtifactManifest, buildSolutionPlayDetails, buildSolutionPlayProjection, classifySolutionPlay, finalizeSearchIndex, readSolutionPlayArtifact, renderSolutionPlayDetails, renderSolutionPlayProjection, repositoryCommitSha, validateSearchIndex, validateSolutionPlayDetail, writeSearchIndex, writeSolutionPlayArtifactManifest, writeSolutionPlayDetails, writeSolutionPlayProjection };
