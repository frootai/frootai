// FrootAI VS Code Extension v6.2.1
// Legacy extension.js handles tree views + 25 commands.
// This TS entry point adds React webview panel commands on top.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { gunzipSync } from "node:zlib";
import { searchAll } from "./commands/search";
import { createDefaultFederationClient, registerFederationCommands } from "./commands/federation";
import { registerFederatedMcpProvider } from "./providers/FederatedMcpProvider";
import { registerFederatedMcpMarketplaceProvider } from "./providers/FederatedMcpMarketplaceProvider";
import { SidebarProvider } from "./providers/SidebarProvider";
import { V68_COMMANDS } from "./commands/v68-tools";
import { LEAN_COMMANDS } from "./commands/lean-compile";
import { ORCHARD_REAL_COMMANDS } from "./commands/orchard-real";
import { OrchardTreeProvider } from "./providers/OrchardTreeProvider";
import { createReactPanel } from "./webviews/reactHost";
import { SOLUTION_PLAYS } from "./data/plays";
import { loadBM25Index, searchPlays as bm25SearchPlays } from "./utils/bm25";
import type { BM25Index } from "./utils/bm25";
import { parseGitHubRepositoryUrl } from "./repository-uri";
import { downloadPlayKit, fetchArchitecture, fetchPlayKitPlan, type PlayKit } from "./play-detail/workflow";
import { approvedExternalUrl, isCanonicalFrootAiHost } from "./external-links";
import { AccountService, isFaiApiKey } from "./account/service";
import { AgentConversationStore } from "./agent-fai/conversationStore";
import { AgentFaiClientError, askAgentFai } from "./agent-fai/client";
import { analyzeRepository } from "./repository-intelligence/analyzer";
import { scanRepository } from "./repository-intelligence/scanner";
import { activateTokenOps, deactivateTokenOps } from "./tokenops";
import type { AcceleratorView, KnowledgeModuleView, PrimitiveItem } from "./types";
import { assertGitBlob, assertGitCommitSha, commitPreparedAssets } from "./accelerator-assets";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require("./legacy.js");

let _activated = false;

/** Shape of a parsed fai-manifest.json */
interface FaiManifest {
  play?: string;
  version?: string;
  context?: { waf?: string[]; knowledge?: string[];[key: string]: unknown };
  primitives?: Record<string, string[]>;
  guardrails?: Record<string, number>;
  [key: string]: unknown;
}

/** Shape of knowledge.json modules */
interface KnowledgeData {
  modules?: Record<string, { title?: string; layer?: string; content?: string }>;
  [key: string]: unknown;
}

/** Messages received from webview panels */
interface WebviewMessage {
  command: string;
  url?: string;
  text?: string;
  toolName?: string;
  playId?: string;
  primitiveType?: string;
  primitiveId?: string;
  file?: string;
  folder?: string;
  panel?: string;
  play?: { id: string; name: string;[key: string]: unknown };
  schema?: string;
  [key: string]: unknown;
}

// Simple LRU cache for @fai search results
interface FaiSearchResult {
  scoredPlays: { play: typeof SOLUTION_PLAYS[number]; score: number; ratio: number }[];
  scoredModules: { id: string; name: string; snippet: string; score: number }[];
  glossaryMatches: { term: string; definition: string }[];
}

const faiSearchCache = new Map<string, { result: FaiSearchResult; timestamp: number }>();
const FAI_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FAI_CACHE_MAX = 50;

function getCachedFaiResult(query: string): FaiSearchResult | null {
  const entry = faiSearchCache.get(query);
  if (entry && Date.now() - entry.timestamp < FAI_CACHE_TTL) return entry.result;
  if (entry) faiSearchCache.delete(query);
  return null;
}

function setCachedFaiResult(query: string, result: FaiSearchResult): void {
  if (faiSearchCache.size >= FAI_CACHE_MAX) {
    const oldest = faiSearchCache.keys().next().value;
    if (oldest) faiSearchCache.delete(oldest);
  }
  faiSearchCache.set(query, { result, timestamp: Date.now() });
}

// Pre-built glossary index (lazy-initialized)
let _glossaryIndex: Map<string, string> | null = null;

function getGlossaryIndex(glossaryData: string): Map<string, string> {
  if (_glossaryIndex) return _glossaryIndex;
  _glossaryIndex = new Map();
  const termRegex = /^##\s+(.{3,})$/gm;
  let match;
  const termPositions: { term: string; start: number }[] = [];
  while ((match = termRegex.exec(glossaryData)) !== null) {
    termPositions.push({ term: match[1].trim(), start: match.index });
  }
  for (let i = 0; i < termPositions.length; i++) {
    const { term, start } = termPositions[i];
    const end = i + 1 < termPositions.length ? termPositions[i + 1].start : glossaryData.length;
    const defText = glossaryData.substring(start, Math.min(end, start + 500));
    const defLines = defText.split("\n").filter(l => l.trim() && !l.startsWith("#")).slice(0, 3).join(" ");
    _glossaryIndex.set(term.toLowerCase(), defLines.substring(0, 200));
  }
  return _glossaryIndex;
}

/**
 * Pre-built inverted index for knowledge modules (built once at activation).
 * Maps each significant word → list of { moduleId, title, snippet, frequency }.
 * Enables O(1) word-level lookup instead of O(n) linear scan per query.
 */
interface KnowledgeIndexEntry {
  moduleId: string;
  title: string;
  snippet: string;
  freq: number;
}
let _knowledgeInvertedIndex: Map<string, KnowledgeIndexEntry[]> | null = null;
let _knowledgeModuleMeta: Map<string, { title: string; contentLen: number }> | null = null;

const KNOWLEDGE_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "was", "are", "were", "be", "been", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "that", "this", "it", "its", "not", "also", "if", "then", "when", "where",
  "which", "how", "what", "all", "each", "more", "most", "other", "some", "such",
  "than", "too", "very", "just", "about", "can", "so", "only", "into", "through",
]);

function buildKnowledgeIndex(modules: KnowledgeData): void {
  if (_knowledgeInvertedIndex) return;
  _knowledgeInvertedIndex = new Map();
  _knowledgeModuleMeta = new Map();

  if (!modules.modules) return;

  for (const [id, mod] of Object.entries(modules.modules) as [string, { title?: string; content?: string }][]) {
    if (id === "F3") continue; // Glossary indexed separately
    const title = mod.title || id;
    const content = (mod.content || "").substring(0, 5000);
    _knowledgeModuleMeta.set(id, { title, contentLen: (mod.content || "").length });

    // Extract best paragraph for this module (first non-heading paragraph > 40 chars)
    const paras = content.split(/\n\n/).filter(p => p.length > 40 && !p.startsWith("#"));
    const bestSnippet = (paras[0] || content.substring(0, 300)).substring(0, 400);

    // Tokenize title + content
    const text = `${title} ${title} ${content}`.toLowerCase(); // title weighted 2x
    const words = text.replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(w));

    // Count word frequencies
    const wordFreq = new Map<string, number>();
    for (const w of words) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }

    // Index each word → this module entry
    for (const [word, freq] of wordFreq) {
      if (!_knowledgeInvertedIndex.has(word)) {
        _knowledgeInvertedIndex.set(word, []);
      }
      _knowledgeInvertedIndex.get(word)!.push({ moduleId: id, title, snippet: bestSnippet, freq });
    }
  }
}

/**
 * Search knowledge modules using the pre-built inverted index.
 * Returns modules ranked by aggregate word-hit frequency.
 */
function searchKnowledgeIndex(queryWords: string[]): { id: string; name: string; snippet: string; score: number }[] {
  if (!_knowledgeInvertedIndex || !_knowledgeModuleMeta) return [];

  const moduleScores = new Map<string, { score: number; hits: number; snippet: string }>();

  for (const word of queryWords) {
    const entries = _knowledgeInvertedIndex.get(word);
    if (!entries) continue;
    for (const entry of entries) {
      const existing = moduleScores.get(entry.moduleId);
      if (existing) {
        existing.score += entry.freq;
        existing.hits += 1;
      } else {
        moduleScores.set(entry.moduleId, { score: entry.freq, hits: 1, snippet: entry.snippet });
      }
    }
  }

  // Require at least 40% of query words to match
  const threshold = Math.max(1, Math.floor(queryWords.length * 0.4));
  return Array.from(moduleScores.entries())
    .filter(([, v]) => v.hits >= threshold)
    .map(([id, v]) => ({
      id,
      name: _knowledgeModuleMeta!.get(id)?.title || id,
      snippet: v.snippet,
      score: v.score,
    }))
    .sort((a, b) => b.score - a.score);
}

/** E2: Scan workspace for evaluation data files */
function scanWorkspaceEvalData(): {
  hasRealData: boolean;
  scores: Record<string, number>;
  thresholds: Record<string, number>;
  history: Array<{ label: string; date?: string; scores: Record<string, number> }>;
  configPath?: string;
  hasEvalPy?: boolean;
  hasTestSet?: boolean;
  resultFiles?: string[];
} {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return { hasRealData: false, scores: {}, thresholds: {}, history: [] };

  const wsRoot = ws.uri.fsPath;
  const evalDir = path.join(wsRoot, "evaluation");
  const configPath = path.join(evalDir, "eval-config.json");
  const resultsPath = path.join(evalDir, "eval-results.json");
  const evalPy = path.join(evalDir, "eval.py");
  const testSet = path.join(evalDir, "test-set.jsonl");
  const resultsDir = path.join(evalDir, "results");

  // Load config
  let thresholds: Record<string, number> = { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0 };
  let hasConfig = false;
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.thresholds) thresholds = cfg.thresholds;
      hasConfig = true;
    } catch { }
  }

  // Collect result files
  const resultFiles: string[] = [];
  const allResults: Array<{ label: string; date?: string; scores: Record<string, number> }> = [];

  // Check eval-results.json (latest)
  if (fs.existsSync(resultsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      if (data.scores && typeof data.scores === "object") {
        resultFiles.push("eval-results.json");
        allResults.push({ label: "Latest", date: data.timestamp, scores: data.scores });
      }
    } catch { }
  }

  // Check results/ subdirectory for historical runs
  if (fs.existsSync(resultsDir)) {
    try {
      const files = fs.readdirSync(resultsDir).filter((f: string) => f.endsWith(".json")).sort().reverse();
      for (const f of files.slice(0, 20)) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf-8"));
          if (data.scores && typeof data.scores === "object") {
            resultFiles.push(`results/${f}`);
            const label = f.replace(".json", "").replace(/^run-/, "Run ");
            allResults.push({ label, date: data.timestamp, scores: data.scores });
          }
        } catch { }
      }
    } catch { }
  }

  const hasRealData = allResults.length > 0;
  const latestScores = hasRealData ? allResults[0].scores : {};

  return {
    hasRealData,
    scores: latestScores,
    thresholds,
    history: allResults,
    configPath: hasConfig ? "evaluation/eval-config.json" : undefined,
    hasEvalPy: fs.existsSync(evalPy),
    hasTestSet: fs.existsSync(testSet),
    resultFiles,
  };
}

let workbenchAcceleratorCache: AcceleratorView[] | null = null;

function loadWorkbenchModules(extensionPath: string): KnowledgeModuleView[] {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(extensionPath, "knowledge.json"), "utf8")) as KnowledgeData;
    return Object.entries(value.modules ?? {}).map(([id, module]) => ({ id, title: module.title ?? id, layer: module.layer ?? moduleLayer(id), content: typeof module.content === "string" ? module.content.slice(0, 500_000) : "" }));
  } catch { return []; }
}

function loadWorkbenchPrimitives(extensionPath: string): Record<string, PrimitiveItem[]> {
  const read = (name: string): PrimitiveItem[] => {
    try { const value = JSON.parse(fs.readFileSync(path.join(extensionPath, "data", `${name}.json`), "utf8")); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  return { agents: read("agents"), skills: read("skills"), instructions: read("instructions"), hooks: read("hooks"), plugins: read("plugins") };
}

async function loadWorkbenchAccelerators(): Promise<AcceleratorView[]> {
  if (workbenchAcceleratorCache) return workbenchAcceleratorCache;
  try {
    const response = await fetch("https://www.frootai.dev/accelerator-catalog.runtime.json.gz?catalog=v1", { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/gzip", "User-Agent": "FrootAI-VSCode" } });
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    const compressed = new Uint8Array(await response.arrayBuffer());
    if (compressed.byteLength > 8_000_000) throw new Error("catalog exceeds compressed limit");
    const parsed = JSON.parse(gunzipSync(compressed, { maxOutputLength: 20_000_000 }).toString("utf8")) as { projection_version?: unknown; count?: unknown; entries?: unknown[] };
    if (parsed.projection_version !== "1.0.0" || !Array.isArray(parsed.entries) || parsed.count !== parsed.entries.length) throw new Error("invalid catalog contract");
    workbenchAcceleratorCache = parsed.entries.slice(0, 1_500).flatMap(normalizeAccelerator);
    if (workbenchAcceleratorCache.length) return workbenchAcceleratorCache;
  } catch { /* deterministic bundled fallback below */ }
  workbenchAcceleratorCache = SOLUTION_PLAYS.map((play) => ({ id: play.dir, name: play.name, fullName: `frootai/${play.dir}`, description: play.tagline ?? play.desc ?? "Canonical FrootAI Solution Play implementation source.", sourceUrl: `https://github.com/frootai/frootai/tree/main/solution-plays/${play.dir}`, guideUrl: `https://www.frootai.dev/solution-plays/${play.dir}`, stars: null, forks: null, language: "Multi-language", topics: [play.cat ?? "ai", ...(play.infra ?? "").split("·").map((item) => item.trim()).filter(Boolean).slice(0, 5)], updatedAt: null, owner: "FrootAI", license: "MIT", publisher: "frootai", category: acceleratorCategory(play.cat ?? ""), verificationState: play.certification?.level ?? play.status ?? "designed", playId: play.id }));
  return workbenchAcceleratorCache;
}

function normalizeAccelerator(value: unknown): AcceleratorView[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const fullName = typeof item.fn === "string" ? item.fn : "";
  const sourceUrl = typeof item.gu === "string" && /^https:\/\/github\.com\//i.test(item.gu) ? item.gu : typeof item.u === "string" && /^https:\/\/github\.com\//i.test(item.u) ? item.u : "";
  if (!fullName || !sourceUrl) return [];
  const rawPublisher = typeof item.publisher === "string" ? item.publisher : item.src === "frootai" ? "frootai" : "microsoft";
  const publisher: AcceleratorView["publisher"] = ["frootai", "microsoft", "google", "aws", "community"].includes(rawPublisher) ? rawPublisher as AcceleratorView["publisher"] : "community";
  const playId = typeof item.pid === "string" && /^\d{1,3}$/.test(item.pid) ? item.pid.padStart(2, "0") : undefined;
  const guideUrl = typeof item.u === "string" && item.u.startsWith("/solution-accelerator/") ? `https://www.frootai.dev${item.u}` : null;
  return [{ id: fullName.replace(/[^a-zA-Z0-9._/-]/g, "").slice(0, 180), name: typeof item.n === "string" ? item.n.slice(0, 180) : fullName.split("/").at(-1) ?? fullName, fullName: fullName.slice(0, 220), description: typeof item.d === "string" ? item.d.slice(0, 1_000) : "Source-backed AI implementation accelerator.", sourceUrl: sourceUrl.slice(0, 2_048), guideUrl, stars: typeof item.s === "number" ? item.s : null, forks: typeof item.f === "number" ? item.f : null, language: typeof item.l === "string" ? item.l.slice(0, 80) : "", topics: Array.isArray(item.t) ? item.t.filter((topic): topic is string => typeof topic === "string").slice(0, 12).map((topic) => topic.slice(0, 80)) : [], updatedAt: typeof item.ua === "string" ? item.ua : null, owner: typeof item.on === "string" ? item.on.slice(0, 120) : fullName.split("/")[0], license: typeof item.li === "string" ? item.li.slice(0, 80) : "", publisher, category: acceleratorCategory(typeof item.cat === "string" ? item.cat : ""), verificationState: typeof item.verification_state === "string" ? item.verification_state.slice(0, 80) : "discovered", ...(playId ? { playId } : {}) }];
}

function acceleratorCategory(value: string): string {
  const category = value.toLowerCase();
  if (/rag|search/.test(category)) return "rag"; if (/agent/.test(category)) return "agents"; if (/mcp|tool/.test(category)) return "mcp"; if (/chat|copilot/.test(category)) return "chat"; if (/document/.test(category)) return "document"; if (/security|govern/.test(category)) return "security"; if (/data|mlops/.test(category)) return "data"; if (/infra|cloud|platform/.test(category)) return "infra"; return category || "industry";
}

function moduleLayer(id: string): string {
  if (id.startsWith("F")) return "Foundations"; if (id.startsWith("R")) return "Reasoning"; if (["O1", "O2", "O3"].includes(id)) return "Orchestration"; if (id.startsWith("O")) return "Operations"; return "Transformation";
}

async function installAcceleratorGithubAssets(entry: AcceleratorView, panel: vscode.WebviewPanel): Promise<void> {
  const source = parseGitHubRepositorySource(entry.sourceUrl);
  if (!source) { await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "failed", message: "This accelerator does not expose an installable GitHub repository." }); return; }
  const { owner, repository } = source;
  const folders = vscode.workspace.workspaceFolders ?? [];
  const targetFolder = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${entry.name} .github assets`, placeHolder: "Choose the target workspace" }).then((item) => item?.folder);
  if (!targetFolder) { await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "cancelled", message: "Open or choose a workspace before downloading repository assets." }); return; }
  await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "loading", message: "Inspecting the repository .github tree…" });
  try {
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "FrootAI-VSCode", "X-GitHub-Api-Version": "2022-11-28" };
    const metadataResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!metadataResponse.ok) throw new Error(`GitHub repository metadata returned ${metadataResponse.status}.`);
    const metadata = await metadataResponse.json() as { default_branch?: unknown };
    const branch = source.ref ?? (typeof metadata.default_branch === "string" ? metadata.default_branch : "main");
    const commitResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits/${encodeURIComponent(branch)}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!commitResponse.ok) throw new Error(`GitHub commit resolution returned ${commitResponse.status}.`);
    const commit = await commitResponse.json() as { sha?: unknown };
    const commitSha = assertGitCommitSha(commit.sha);
    const treeResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${commitSha}?recursive=1`, { headers, signal: AbortSignal.timeout(20_000) });
    if (!treeResponse.ok) throw new Error(`GitHub repository tree returned ${treeResponse.status}.`);
    const tree = await treeResponse.json() as { truncated?: boolean; tree?: Array<{ path?: unknown; type?: unknown; size?: unknown; sha?: unknown }> };
    if (tree.truncated) throw new Error("The GitHub repository tree is truncated; installation stopped rather than copying incomplete assets.");
    const assetPrefix = source.subpath ? `${source.subpath}/.github/` : ".github/";
    const declaredAssets = (tree.tree ?? []).filter((item) => item.type === "blob" && typeof item.path === "string" && item.path.startsWith(assetPrefix) && !item.path.split("/").includes("..")).map((item) => ({ ...item, sourcePath: item.path, path: (item.path as string).slice(source.subpath ? source.subpath.length + 1 : 0) }));
    if (!declaredAssets.length) throw new Error("This repository does not contain downloadable .github assets.");
    if (declaredAssets.length > 200) throw new Error(`This repository contains ${declaredAssets.length} .github files, exceeding the 200-file safety limit; no partial installation was performed.`);
    if (declaredAssets.some((item) => typeof item.size !== "number" || item.size < 0 || typeof item.sha !== "string" || !/^[a-f0-9]{40}$/i.test(item.sha))) throw new Error("The repository does not report trustworthy sizes and immutable hashes for every .github asset; installation stopped.");
    if (declaredAssets.some((item) => (item.size as number) > 512_000)) throw new Error("At least one repository .github asset exceeds the 512 KB per-file safety limit; no partial installation was performed.");
    const assets = declaredAssets as Array<{ path: string; sourcePath: string; type: string; size: number; sha: string }>;
    const declaredBytes = assets.reduce((total, item) => total + (typeof item.size === "number" ? item.size : 0), 0);
    if (declaredBytes > 5_000_000) throw new Error("The repository .github assets exceed the 5 MB safety limit.");
    const confirmation = await vscode.window.showInformationMessage(`Download ${assets.length} .github files from ${owner}/${repository} at commit ${commitSha.slice(0, 12)} into ${targetFolder.name}? Existing files will be preserved.`, { modal: true }, "Download .github");
    if (confirmation !== "Download .github") { await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "cancelled", message: "Repository asset download cancelled." }); return; }
    let copied: string[] = []; const skipped: string[] = []; const pending: Array<{ relative: string; target: string; bytes: Buffer }> = []; let actualBytes = 0;
    let cancelled = false;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: downloading ${entry.name} .github assets`, cancellable: true }, async (progress, token) => {
      const downloadController = new AbortController();
      const cancellation = token.onCancellationRequested(() => { cancelled = true; downloadController.abort(); });
      try {
      for (let index = 0; index < assets.length; index += 1) {
        if (token.isCancellationRequested) throw new Error("Repository asset download cancelled.");
        const asset = assets[index];
        const target = safeWorkspaceAssetTarget(targetFolder.uri.fsPath, asset.path, false);
        if (fs.existsSync(target)) { skipped.push(asset.path); continue; }
        const rawPath = asset.sourcePath.split("/").map(encodeURIComponent).join("/");
        const timeoutController = new AbortController(); const timeout = setTimeout(() => timeoutController.abort(), 15_000);
        const signal = AbortSignal.any([downloadController.signal, timeoutController.signal]);
        const response = await fetch(`https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${commitSha}/${rawPath}`, { headers: { "User-Agent": "FrootAI-VSCode" }, signal });
        if (!response.ok) { clearTimeout(timeout); throw new Error(`Could not download ${asset.path} (${response.status}).`); }
        let bytes: Buffer;
        try { bytes = await readBoundedResponse(response, 512_000, 5_000_000 - actualBytes, asset.path); }
        finally { clearTimeout(timeout); }
        assertGitBlob(bytes, asset.sha, asset.path);
        actualBytes += bytes.byteLength;
        pending.push({ relative: asset.path, target, bytes });
        progress.report({ message: `${index + 1}/${assets.length} · ${asset.path}`, increment: 100 / assets.length });
      }
      } finally { cancellation.dispose(); }
    });
    if (cancelled) throw new Error("Repository asset download cancelled; no files were installed.");
    const transactionOwnedTargets = new Set<string>();
    const removeTransactionOwnedTarget = (relative: string, target: string) => {
      if (!transactionOwnedTargets.has(target)) return;
      const verified = safeWorkspaceAssetTarget(targetFolder.uri.fsPath, relative, false);
      if (verified === target && fs.existsSync(verified) && fs.lstatSync(verified).isFile()) fs.rmSync(verified, { force: true });
      transactionOwnedTargets.delete(target);
    };
    copied = commitPreparedAssets(pending.map((item) => ({ ...item, target: safeWorkspaceAssetTarget(targetFolder.uri.fsPath, item.relative, true) })), {
      writeExclusive(target, bytes) {
        const descriptor = fs.openSync(target, "wx");
        transactionOwnedTargets.add(target);
        try { fs.writeFileSync(descriptor, bytes); }
        finally { fs.closeSync(descriptor); }
      },
      rollbackFailed: removeTransactionOwnedTarget,
      rollback: removeTransactionOwnedTarget,
    });
    await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "succeeded", message: `${copied.length} .github files downloaded from immutable commit ${commitSha.slice(0, 12)}; ${skipped.length} existing files preserved.` });
  } catch (error) { await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: entry.id, status: "failed", message: error instanceof Error ? error.message : String(error) }); }
}

function safeWorkspaceAssetTarget(root: string, relative: string, createParents: boolean): string {
  const rootPath = path.resolve(root);
  const rootReal = fs.realpathSync(rootPath);
  if (relative.includes("\\") || path.isAbsolute(relative)) throw new Error("Unsafe repository path rejected.");
  const segments = relative.split("/");
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":") || /[. ]$/.test(segment) || reserved.test(segment) || /[\x00-\x1f<>"|?*]/.test(segment))) throw new Error("Unsafe repository path rejected.");
  let parent = rootPath;
  for (const segment of segments.slice(0, -1)) {
    parent = path.join(parent, segment);
    if (!fs.existsSync(parent)) {
      if (!createParents) continue;
      fs.mkdirSync(parent);
    }
    const stat = fs.lstatSync(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Repository asset parent is not a trusted directory: ${segment}`);
    const real = fs.realpathSync(parent);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) throw new Error("Repository asset path escapes the selected workspace.");
  }
  const target = path.join(parent, segments.at(-1)!);
  if (target !== rootPath && !target.startsWith(`${rootPath}${path.sep}`)) throw new Error("Unsafe repository path rejected.");
  return target;
}

function parseGitHubRepositorySource(value: string): { owner: string; repository: string; ref?: string; subpath?: string; cloneUrl: string } | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.search || url.hash) return null;
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments.length < 2 || segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))) return null;
  const [owner, repositoryWithSuffix] = segments;
  const repository = repositoryWithSuffix.replace(/\.git$/i, "");
  if (!repository) return null;
  if (segments.length === 2) return { owner, repository, cloneUrl: `https://github.com/${owner}/${repository}` };
  if (segments[2] !== "tree" || segments.length < 4) return null;
  const ref = segments[3];
  const subpath = segments.slice(4).join("/") || undefined;
  return { owner, repository, ref, subpath, cloneUrl: `https://github.com/${owner}/${repository}` };
}

async function readBoundedResponse(response: Response, perFileLimit: number, remainingTotal: number, label: string): Promise<Buffer> {
  if (!response.body) throw new Error(`${label} returned an empty response.`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > perFileLimit) { await reader.cancel("per-file limit"); throw new Error(`${label} exceeds the per-file safety limit.`); }
      if (length > remainingTotal) { await reader.cancel("total limit"); throw new Error("Downloaded repository assets exceed the 5 MB safety limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), length);
}

function internalWorkbenchRoute(value: string): string | null {
  try {
    const url = new URL(value, "https://www.frootai.dev");
    if (!isCanonicalFrootAiHost(url.hostname) || url.username || url.password) return null;
    const pathName = url.pathname.replace(/\/$/, "") || "/";
    if (pathName === "/" || pathName === "/hi-fai") return "/";
    if (pathName === "/solution-accelerator" || pathName.startsWith("/solution-accelerator/")) return pathName;
    if (pathName === "/solution-plays") return pathName;
    if (pathName.startsWith("/solution-plays/")) {
      const slug = pathName.split("/")[2]; const play = SOLUTION_PLAYS.find((candidate) => candidate.dir === slug || candidate.id === slug);
      return play ? `/solution-plays/${play.id}` : "/solution-plays";
    }
    if (pathName === "/mcp-tooling" || pathName === "/mcp-server") return "/mcp-tooling";
    if (pathName === "/docs") return "/docs";
    if (pathName.startsWith("/docs/")) return pathName;
    if (pathName === "/glossary") return "/glossary";
    if (pathName === "/configurator") return "/configurator";
    if (pathName.startsWith("/primitives")) return `${pathName}${url.hash ? `/${url.hash.slice(1)}` : ""}`;
    if (pathName === "/marketplace") return "/marketplace";
    if (pathName === "/orchard") return "/orchard";
    if (pathName === "/studio" || pathName.startsWith("/app")) return "/studio";
    if (pathName === "/lab") return "/lab";
    if (pathName === "/lean" || pathName.startsWith("/primitives/leanhub")) return "/lean";
    if (pathName === "/whatisfrootai" || pathName === "/ecosystem" || pathName === "/fai-protocol") return "/about";
    return null;
  } catch { return null; }
}

async function openApprovedExternal(value: string): Promise<void> {
  const url = approvedExternalUrl(value);
  await vscode.env.openExternal(vscode.Uri.parse(url.toString(), true));
}

export function activate(context: vscode.ExtensionContext): void {
  if (_activated) return;
  _activated = true;

  // DIAGNOSTIC v5.1.9 — prove the new version is actually loaded
  const ver = context.extension.packageJSON.version;

  // Persistent log channel — survives toast dismissal, never silenced
  const logChannel = vscode.window.createOutputChannel("FrootAI");
  context.subscriptions.push(logChannel);
  (globalThis as any).__frootaiLog = logChannel;
  logChannel.appendLine(`[${new Date().toISOString()}] FrootAI v${ver} activate() called`);
  logChannel.appendLine(`[${new Date().toISOString()}] Extension path: ${context.extensionPath}`);

  console.log(`[FrootAI v${ver}] activate() called at ${new Date().toISOString()}`);
  const accountService = new AccountService(context.secrets, context.globalState);
  context.subscriptions.push(accountService);
  const conversationStore = new AgentConversationStore(context.secrets);
  const accountReady = accountService.initialize();

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, new SidebarProvider(context.extensionUri), { webviewOptions: { retainContextWhenHidden: true } }));

  // TokenOps owns its webview, evidence store, model registry, and FinOps commands.
  activateTokenOps(context);

  // Legacy handles tree views + existing commands
  try {
    legacy.activate(context);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`FrootAI: legacy activation error — ${msg}`);
    logChannel.appendLine(`[ERROR] legacy activation: ${msg}`);
    vscode.window.showWarningMessage(`FrootAI: Partial activation — ${msg}`);
  }

  // New React panel commands — safe registration (skip if already exists)
  const safeRegister = (id: string, fn: (...args: unknown[]) => unknown) => {
    try { context.subscriptions.push(vscode.commands.registerCommand(id, fn)); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); console.warn(`FrootAI: skipped ${id} — ${msg}`); }
  };
  let openWorkbenchRoute: ((route?: string) => Promise<void>) | undefined;
  let analyzeWorkbenchRepository: (() => Promise<void>) | undefined;

  safeRegister("frootai.secureInitPlayKit", async (requestedKit?: unknown, requestedPlay?: unknown) => {
    if (!(["devkit", "tunekit", "speckit"] as unknown[]).includes(requestedKit)) throw new Error("Unsupported Play kit requested.");
    const kit = requestedKit as PlayKit;
    const requestedId = typeof requestedPlay === "string" ? requestedPlay : requestedPlay && typeof requestedPlay === "object" ? String((requestedPlay as { id?: unknown; dir?: unknown }).id ?? (requestedPlay as { dir?: unknown }).dir ?? "") : "";
    let play = SOLUTION_PLAYS.find((candidate) => candidate.id === requestedId || candidate.dir === requestedId);
    if (!play) {
      const picked = await vscode.window.showQuickPick(SOLUTION_PLAYS.map((candidate) => ({ label: `${candidate.id} — ${candidate.name}`, description: candidate.status, candidate })), { title: `Initialize ${kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit"}`, placeHolder: "Choose a canonical Solution Play" });
      play = picked?.candidate;
    }
    if (!play) return;
    const label = kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit";
    const folders = vscode.workspace.workspaceFolders ?? [];
    const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${play.name} ${label}`, placeHolder: "Choose the target workspace folder" }).then((picked) => picked?.folder);
    if (!selected) { void vscode.window.showWarningMessage(folders.length ? `${label} installation cancelled.` : `Open a workspace folder before initializing ${label}.`); return; }
    const plan = await fetchPlayKitPlan(play.dir, kit);
    const commitSha = plan[0].commitSha!;
    const declaredBytes = plan.reduce((total, file) => total + (file.size ?? 0), 0);
    const confirmation = await vscode.window.showInformationMessage(`Download ${plan.length} hash-verified ${label} files (${declaredBytes.toLocaleString()} bytes) for ${play.name} from immutable commit ${commitSha.slice(0, 12)} into ${selected.name}? Existing files will be preserved.`, { modal: true }, `Download ${label}`);
    if (confirmation !== `Download ${label}`) return;
    const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: downloading ${play.name} ${label}`, cancellable: true }, async (progress, cancellation) => {
      const controller = new AbortController(); const subscription = cancellation.onCancellationRequested(() => controller.abort());
      try { return await downloadPlayKit({ targetRoot: selected.uri.fsPath, plan, signal: controller.signal, onProgress: (completed, total, file) => progress.report({ message: `${completed}/${total} · ${file}`, increment: 100 / total }) }); }
      finally { subscription.dispose(); }
    });
    logChannel.appendLine(`[secure-play-kit] kit=${kit} play=${play.id} commit=${commitSha} target=${selected.name} copied=${result.copied.length} skipped=${result.skipped.length}`);
    void vscode.window.showInformationMessage(`${label} ready from ${commitSha.slice(0, 12)}: ${result.copied.length} verified file(s) downloaded, ${result.skipped.length} existing file(s) preserved.`);
  });

  const promptForApiKey = async (): Promise<boolean> => {
    const value = await vscode.window.showInputBox({ title: "Connect FrootAI Account", prompt: "Paste the complete revocable fai_live_ key shown once in your FrootAI account. Bearer prefixes and surrounding quotes are removed safely.", placeHolder: "fai_live_…", password: true, ignoreFocusOut: true, validateInput: (input) => isFaiApiKey(input) ? null : "Expected fai_live_ followed by 48 lowercase hexadecimal characters." });
    if (!value) return false;
    await accountService.setApiKey(value);
    void vscode.window.showInformationMessage("FrootAI API key saved securely. Agent FAI will verify it on the first request.");
    return true;
  };
  const openAccountPanel = () => {
    const panel = createReactPanel(context.extensionUri, "frootai.account", "FrootAI Account", { panel: "account", account: accountService.getSnapshot() });
    const subscription = accountService.subscribe((account) => { void panel.webview.postMessage({ type: "update", data: { panel: "account", account } }); });
    panel.onDidDispose(() => subscription.dispose());
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.command === "accountSignIn") await vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/sign-in?from=/account/api-keys"));
      if (msg.command === "accountSetKey") await promptForApiKey();
      if (msg.command === "accountRemoveKey") { const choice = await vscode.window.showWarningMessage("Disconnect this VS Code profile from FrootAI?", { modal: true }, "Disconnect"); if (choice === "Disconnect") await accountService.removeApiKey(); }
      if (msg.command === "openAgentFai") await vscode.commands.executeCommand("frootai.openAgentFai");
    });
  };
  safeRegister("frootai.account.open", openAccountPanel);
  safeRegister("frootai.account.setApiKey", promptForApiKey);
  safeRegister("frootai.account.removeApiKey", () => accountService.removeApiKey());

  const openRepositoryIntelligence = async (): Promise<void> => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((item) => ({ label: item.name, description: item.uri.fsPath, folder: item })), { title: "Repository Intelligence", placeHolder: "Choose the workspace to analyze" }).then((item) => item?.folder);
    if (!folder) { void vscode.window.showWarningMessage("Open a workspace folder before running Repository Intelligence."); return; }
    const report = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: analyzing ${folder.name}`, cancellable: false }, async () => analyzeRepository(await scanRepository(folder), SOLUTION_PLAYS));
    const panel = createReactPanel(context.extensionUri, "frootai.repositoryIntelligence", `Repository Intelligence · ${folder.name}`, { panel: "repositoryIntelligence", repositoryReport: report });
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.command === "openPlay" && msg.playId) { const play = SOLUTION_PLAYS.find((candidate) => candidate.id === msg.playId); if (play) await vscode.commands.executeCommand("frootai.openPlayDetail", play); }
      if (msg.command === "openConfigurator") await vscode.commands.executeCommand("frootai.openConfigurator");
      if (msg.command === "analyzeRepository") await vscode.commands.executeCommand("frootai.repository.analyze");
    });
  };
  safeRegister("frootai.repository.analyze", openRepositoryIntelligence);

  void accountReady.then(async (account) => {
    if (account.configured || accountService.hasCompletedOnboarding()) return;
    const choice = await vscode.window.showInformationMessage("Connect your FrootAI account to save Agent FAI conversations and use hosted reasoning.", "Sign in", "Enter API key", "Later");
    if (choice === "Sign in") { await accountService.completeOnboarding(); await vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/sign-in?from=/account/api-keys")); openAccountPanel(); }
    else if (choice === "Enter API key") await promptForApiKey();
    else if (choice === "Later") await accountService.completeOnboarding();
  });

  safeRegister("frootai.searchAll", () => searchAll(loadWorkbenchAccelerators));

  // M5.4: register the federation command surface. registerFederationCommands
  // installs every M5 command shipped so far (currently `frootai.federation.attach`;
  // M5.5-M5.9 + M5.14/M5.15 extend the registration block inside the helper).
  try {
    const federationClient = createDefaultFederationClient();
    registerFederationCommands(context, { client: federationClient, output: logChannel });
    registerFederatedMcpProvider(context, { client: federationClient, output: logChannel });
    registerFederatedMcpMarketplaceProvider(context, { client: federationClient, output: logChannel });
    logChannel.appendLine(`[${new Date().toISOString()}] federation commands and tree providers registered`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logChannel.appendLine(`[ERROR] federation registration: ${msg}`);
    // Best-effort — don't fail extension activation on a federation registration error.
  }

  // ────────────────────────────────────────────────────────────────────────
  // URI Handler — deep-link from frootai.dev (v5.1.7+)
  // Format: vscode://frootai.frootai-vscode/<route>?<params>
  //
  // Routes:
  //   /openRepository?url=URL      — confirm and clone a public GitHub repository
  //   /openPlay?id=NN              — open Play Detail panel for that play
  //   /installPlay?id=NN           — install play as plugin (writes files)
  //   /initDevKit?play=NN          — initialize DevKit for play
  //   /initTuneKit?play=NN         — initialize TuneKit for play
  //   /initSpecKit?play=NN         — initialize SpecKit for play
  //   /installHook?play=NN         — initialize hooks for play
  //   /installPrompt?play=NN       — initialize prompts for play
  //   /installAgent?id=NAME        — install agent (delegates to installAgent w/ pre-selected id)
  //   /installInstruction?id=NAME  — install instruction (delegates to installInstruction w/ pre-selected id)
  //   /installSkill?id=NAME        — opens Primitives Catalog focused on skills
  //   /openPrimitives              — open Primitives Catalog
  //   /openMarketplace             — open Marketplace
  //   /openCookbook                — open cookbook (via web for now)
  //   /openWorkflow?id=NAME        — open workflow (via web for now)
  //
  // All routes log to FrootAI Output channel for diagnostics.
  // ────────────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        const log = (globalThis as any).__frootaiLog as vscode.OutputChannel | undefined;
        const params = new URLSearchParams(uri.query);
        const route = uri.path;

        log?.appendLine(`[${new Date().toISOString()}] [URI v${context.extension.packageJSON.version}] received: ${uri.toString()}`);
        log?.appendLine(`  route: "${route}"  params: ${JSON.stringify(Object.fromEntries(params))}`);

        const findPlay = (idOrDir?: string | null) => {
          if (!idOrDir) return undefined;
          return SOLUTION_PLAYS.find((p) => p.id === idOrDir || p.dir === idOrDir);
        };

        const showWelcomeToast = (msg: string) => {
          vscode.window.showInformationMessage(`FrootAI: ${msg}`);
        };
        const execute = (command: string, ...args: unknown[]): Thenable<void> =>
          vscode.commands.executeCommand(command, ...args).then(() => undefined);

        try {
          switch (route) {
            case "/openRepository": {
              const repository = parseGitHubRepositoryUrl(params.get("url"));
              if (!repository) {
                return vscode.window.showErrorMessage("FrootAI: A valid public GitHub repository URL is required.").then(() => undefined);
              }
              return vscode.window
                .showInformationMessage(
                  `Clone ${repository.fullName} into a new local project?`,
                  { modal: true, detail: "VS Code will ask you to choose a destination folder before cloning." },
                  "Choose folder and clone",
                )
                .then(async (selection) => {
                  if (selection === "Choose folder and clone") await vscode.commands.executeCommand("git.clone", repository.url);
                });
            }

            case "/openPlay":
            case "/play": {
              const id = params.get("id");
              const play = findPlay(id);
              if (!play) {
                showWelcomeToast(`Play "${id}" not found — opening browser`);
                return execute("frootai.browsePlays");
              }
              return execute("frootai.openPlayDetail", play);
            }

            case "/installPlay": {
              const play = findPlay(params.get("id"));
              return execute("frootai.installPlugin", play);
            }

            case "/initDevKit":
              return execute("frootai.initDevKit", findPlay(params.get("play") || params.get("id")));
            case "/initTuneKit":
              return execute("frootai.initTuneKit", findPlay(params.get("play") || params.get("id")));
            case "/initSpecKit":
              return execute("frootai.initSpecKit", findPlay(params.get("play") || params.get("id")));
            // Legacy play-scoped hook/prompt init (downloads guardrails.json or prompt scaffolds for a PLAY)
            case "/initHooks":
              return execute("frootai.initHooks", findPlay(params.get("play") || params.get("id")));
            case "/initPrompts":
              return execute("frootai.initPrompts", findPlay(params.get("play") || params.get("id")));

            case "/installAgent":
              return execute("frootai.installAgent", params.get("id") || params.get("name"));
            case "/installInstruction":
              return execute("frootai.installInstruction", params.get("id") || params.get("name"));

            // Primitive installers — download a single primitive folder (skill/hook/prompt) into the user's workspace
            case "/installSkill":
              return execute("frootai.installSkill", params.get("id") || params.get("name"));
            case "/installHook":
              return execute("frootai.installHook", params.get("id") || params.get("name"));
            case "/installPrompt":
              return execute("frootai.installPrompt", params.get("id") || params.get("name"));

            case "/installHookList":
            case "/installPromptList":
              showWelcomeToast(`Opening Primitives Catalog (looking for "${params.get("id") || params.get("name") || ""}")`);
              return execute("frootai.openPrimitivesCatalog");

            case "/openPrimitives":
            case "/primitives":
              return execute("frootai.openPrimitivesCatalog");

            case "/openMarketplace":
            case "/marketplace":
              return execute("frootai.openMarketplace");

            case "/openCookbook":
            case "/openWorkflow":
            case "/cookbook":
            case "/workflow":
              showWelcomeToast(`${route.replace(/^\/(open)?/, "")} direct-open coming soon — opening welcome panel`);
              return execute("frootai.openWelcome");

            case "":
            case "/":
              return execute("frootai.openWelcome");

            default:
              log?.appendLine(`[WARN] unknown URI route "${route}" — opening Welcome panel`);
              showWelcomeToast(`Unknown link "${route}" — opening Welcome`);
              return execute("frootai.openWelcome");
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          const stack = e instanceof Error ? e.stack : "";
          log?.appendLine(`[ERROR] URI handler failed for "${route}": ${errMsg}\n${stack}`);
          log?.show(true);
          vscode.window.showErrorMessage(`FrootAI URI handler error: ${errMsg}`);
        }
      },
    })
  );

  // Health Check — verifies all 9 PlayDetail buttons can dispatch correctly.
  // Run from Command Palette: "FrootAI: Health Check"
  safeRegister("frootai.healthCheck", async () => {
    const log = (globalThis as any).__frootaiLog as vscode.OutputChannel | undefined;
    log?.show(true);
    log?.appendLine("");
    log?.appendLine(`════════════════════════════════════════════════════════════════`);
    log?.appendLine(`FrootAI HEALTH CHECK — v${context.extension.packageJSON.version}`);
    log?.appendLine(`Time: ${new Date().toISOString()}`);
    log?.appendLine(`════════════════════════════════════════════════════════════════`);

    const buttons = [
      { group: "Full Packages", btn: "Initialize DevKit", cmd: "frootai.initDevKit" },
      { group: "Full Packages", btn: "Initialize TuneKit", cmd: "frootai.initTuneKit" },
      { group: "Full Packages", btn: "Initialize SpecKit", cmd: "frootai.initSpecKit" },
      { group: "Standalone   ", btn: "Initialize Hooks", cmd: "frootai.initHooks" },
      { group: "Standalone   ", btn: "Initialize Prompts", cmd: "frootai.initPrompts" },
      { group: "Standalone   ", btn: "Install as Plugin", cmd: "frootai.installPlugin" },
      { group: "Analyze&Eval ", btn: "Estimate Cost", cmd: "frootai.estimateCostForPlay" },
      { group: "Analyze&Eval ", btn: "Architecture Diagram", cmd: "frootai.showArchitectureDiagram" },
      { group: "Analyze&Eval ", btn: "Run Evaluation", cmd: "frootai.runEvaluation" },
    ];

    const allCommands = await vscode.commands.getCommands(true);
    let pass = 0, fail = 0;
    for (const b of buttons) {
      const registered = allCommands.includes(b.cmd);
      if (registered) pass++; else fail++;
      const status = registered ? "✅ REGISTERED" : "❌ NOT FOUND";
      log?.appendLine(`  [${status}] [${b.group}] ${b.btn.padEnd(22)} → ${b.cmd}`);
    }
    log?.appendLine(`────────────────────────────────────────────────────────────────`);
    log?.appendLine(`Result: ${pass}/9 commands registered, ${fail}/9 missing`);
    if (fail === 0) {
      log?.appendLine(`✅ ALL 9 BUTTONS SHOULD WORK. If they don't, the OPEN PlayDetail panel was created by an older extension version.`);
      log?.appendLine(`   FIX: Close the PlayDetail tab and re-open the play.`);
    } else {
      log?.appendLine(`❌ ${fail} commands missing — extension didn't activate properly. Reload window: Ctrl+Shift+P → "Developer: Reload Window"`);
    }
    log?.appendLine(`════════════════════════════════════════════════════════════════`);
    log?.appendLine(`URI Handler routes (vscode://frootai.frootai-vscode/<route>?<params>):`);
    const uriRoutes = [
      `  /openPlay?id=NN              → frootai.openPlayDetail`,
      `  /installPlay?id=NN           → frootai.installPlugin`,
      `  /initDevKit?play=NN          → frootai.initDevKit`,
      `  /initTuneKit?play=NN         → frootai.initTuneKit`,
      `  /initSpecKit?play=NN         → frootai.initSpecKit`,
      `  /initHooks?play=NN           → frootai.initHooks (legacy: per-play guardrails.json)`,
      `  /initPrompts?play=NN         → frootai.initPrompts (legacy: per-play prompt scaffolds)`,
      `  /installAgent?id=NAME        → frootai.installAgent (skips picker, installs in Copilot Chat)`,
      `  /installInstruction?id=NAME  → frootai.installInstruction (skips picker)`,
      `  /installSkill?id=NAME        → frootai.installSkill (NEW v5.1.8 — downloads folder to workspace)`,
      `  /installHook?id=NAME         → frootai.installHook (NEW v5.1.8 — downloads folder to workspace)`,
      `  /installPrompt?id=NAME       → frootai.installPrompt (NEW v5.1.8 — downloads folder to workspace)`,
      `  /openPrimitives              → frootai.openPrimitivesCatalog`,
      `  /openMarketplace             → frootai.openMarketplace`,
    ];
    uriRoutes.forEach(r => log?.appendLine(r));
    log?.appendLine(`Test from any browser: vscode://frootai.frootai-vscode/openPlay?id=01`);
    log?.appendLine(`════════════════════════════════════════════════════════════════`);
    vscode.window.showInformationMessage(`FrootAI Health Check: ${pass}/9 commands + URI handler ready (see Output panel)`);
  });

  // ─── v6.8 commands (Plan E) — surface analyze_workspace, scaffold_component,
  //     get_play_config, get_dependencies, generate_bicep, run_eval_live ───
  for (const c of V68_COMMANDS) {
    safeRegister(c.id, () => c.handler());
  }

  // ─── [Z8.5] Lean Mode commands — compile the active editor to its lossless
  //     Lean form + toggle the Full <-> Lean view. ───
  for (const c of LEAN_COMMANDS) {
    safeRegister(c.id, () => c.handler());
  }

  // ─── FAI Orchard (A5.19–A5.22) — in-process CLI wrapper + tree view +
  //     real install/installWithPlay/diff/bushel/show/browse/signIn handlers.
  //     The CLI's `cli/lib/orchard/dispatch.js` is invoked in-process via
  //     `vscode-extension/src/orchard-client/index.js`. Shared auth state
  //     comes from `~/.frootai/.token` (CLI A4.9 contract) so `frootai login`
  //     in a terminal transparently signs in the extension on next refresh. ───
  for (const c of ORCHARD_REAL_COMMANDS) {
    safeRegister(c.id, (...args: unknown[]) => c.handler(...args));
  }
  try {
    const orchardTree = new OrchardTreeProvider({
      log: (line: string) => logChannel.appendLine(`[orchard] ${line}`),
      err: (line: string) => logChannel.appendLine(`[orchard:err] ${line}`),
    });
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider("frootai.orchard.tree", orchardTree),
      vscode.commands.registerCommand("frootai.orchard.tree.refresh", () => orchardTree.refresh()),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logChannel.appendLine(`[ERROR] failed to register orchard tree: ${msg}`);
  }

  safeRegister("frootai.openPlayDetail", (playOrId?: unknown) => {
    let play = playOrId as typeof SOLUTION_PLAYS[number] | undefined;
    if (typeof playOrId === "string") {
      play = SOLUTION_PLAYS.find(p => p.id === playOrId) ?? SOLUTION_PLAYS[0];
    }
    if (!play) play = SOLUTION_PLAYS[0];
    if (openWorkbenchRoute) return openWorkbenchRoute(`/solution-plays/${play.id}`);
    const panel = createReactPanel(context.extensionUri, "frootai.playDetail", `Play ${play.id} — ${play.name}`, { panel: "playDetail", play });
    const installPlayKit = async (kit: PlayKit): Promise<void> => {
      const label = kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit";
      const folders = vscode.workspace.workspaceFolders ?? [];
      const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${play.name} ${label}`, placeHolder: "Choose the target workspace folder" }).then((picked) => picked?.folder);
      if (!selected) {
        const message = folders.length ? `${label} installation cancelled.` : `Open a workspace folder before initializing ${label}.`;
        await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "cancelled", message });
        if (!folders.length) void vscode.window.showWarningMessage(message);
        return;
      }
      await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "planning", message: `Resolving canonical ${label} files…` });
      const plan = await fetchPlayKitPlan(play.dir, kit);
      const confirmation = await vscode.window.showInformationMessage(`Download ${plan.length} canonical ${label} files for ${play.name} into ${selected.name}? Existing files will be preserved.`, { modal: true }, `Download ${label}`);
      if (confirmation !== `Download ${label}`) { await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "cancelled", message: `${label} installation cancelled.` }); return; }
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: downloading ${play.name} ${label}`, cancellable: true }, async (progress, cancellation) => {
        const controller = new AbortController(); cancellation.onCancellationRequested(() => controller.abort());
        return downloadPlayKit({ targetRoot: selected.uri.fsPath, plan, signal: controller.signal, onProgress: (completed, total, file) => progress.report({ message: `${completed}/${total} · ${file}`, increment: 100 / total }) });
      });
      const message = `${label} ready: ${result.copied.length} downloaded, ${result.skipped.length} existing file(s) preserved.`;
      logChannel.appendLine(`[play-kit] kit=${kit} play=${play.id} target=${selected.name} copied=${result.copied.length} skipped=${result.skipped.length}`);
      await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "succeeded", message, copied: result.copied, skipped: result.skipped });
      void vscode.window.showInformationMessage(message);
    };
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      const log = (globalThis as any).__frootaiLog as vscode.OutputChannel | undefined;

      log?.appendLine(`[${new Date().toISOString()}] PlayDetail received: command="${msg.command}" playId="${msg.playId}" playDir="${msg.playDir}"`);

      try {
        switch (msg.command) {
          case "navigate":
            if (msg.panel === "playBrowser") {
              panel.dispose();
              await vscode.commands.executeCommand("frootai.browsePlays");
            }
            break;
          case "initDevKit": await installPlayKit("devkit"); break;
          case "initTuneKit": await installPlayKit("tunekit"); break;
          case "initSpecKit": await installPlayKit("speckit"); break;

          // ─── Standalone (now uses SAME pattern as Full Packages) ───
          case "initHooks": await vscode.commands.executeCommand("frootai.initHooks", play); break;
          case "initPrompts": await vscode.commands.executeCommand("frootai.initPrompts", play); break;
          case "installPlugin": await vscode.commands.executeCommand("frootai.installPlugin", play); break;

          // ─── Analyze & Evaluate (now uses SAME pattern as Full Packages) ───
          case "cost": await vscode.commands.executeCommand("frootai.estimateCostForPlay", play); break;
          case "diagram": {
            await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "loading" });
            try {
              const architecture = await fetchArchitecture(play.dir);
              await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "succeeded", ...architecture });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              const declaredServices = (play.infra ?? "Application · AI Runtime · Data · Observability").split("·").map((service) => service.trim()).filter(Boolean);
              const fallback = [
                `# ${play.name} architecture`,
                "",
                play.tagline ?? play.desc ?? "Bundled Solution Play architecture contract.",
                "",
                "## Declared service flow",
                "",
                ...declaredServices.map((service, index) => `- ${index + 1}. ${service}`),
                "",
                "## Architecture pattern",
                "",
                play.pattern ?? "Use the declared services as a bounded implementation contract and validate deployment evidence before promotion.",
              ].join("\n");
              await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "degraded", markdown: fallback, message: `${message} Showing the bundled Play contract instead.` });
            }
            break;
          }
          case "runEvaluation": await vscode.commands.executeCommand("frootai.runEvaluation"); break;

          // ─── Misc ───
          case "createManifest": await vscode.commands.executeCommand("frootai.createManifest"); break;
          case "openUrl": if (msg.url) await openApprovedExternal(msg.url); break;

          default:
            console.warn(`FrootAI PlayDetail: unhandled command="${msg.command}"`);
            log?.appendLine(`[WARN] unhandled command: ${msg.command}`);
            break;
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : "";
        console.error(`FrootAI PlayDetail error: ${errMsg}`, e);
        log?.appendLine(`[ERROR] ${msg.command} failed: ${errMsg}\n${stack}`);
        const kit = msg.command === "initDevKit" ? "devkit" : msg.command === "initTuneKit" ? "tunekit" : msg.command === "initSpecKit" ? "speckit" : null;
        if (kit) {
          await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "failed", message: `${kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit"} failed: ${errMsg}` });
        }
        log?.show(true); // force-reveal the FrootAI Output channel on error
        vscode.window.showErrorMessage(`FrootAI: ${msg.command} failed — ${errMsg}`);
      }
    });
  });

  safeRegister("frootai.openEvaluationDashboard", () => {
    // E2: Scan workspace for real evaluation data
    const evalData = scanWorkspaceEvalData();
    const panel = createReactPanel(context.extensionUri, "frootai.evaluation", "Evaluation Dashboard", { panel: "evaluation", evalData });
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.command) {
        case "runEvaluation":
          vscode.commands.executeCommand("frootai.runEvaluation");
          break;
        case "scanWorkspace": {
          const refreshed = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: refreshed } });
          vscode.window.showInformationMessage(refreshed.hasRealData
            ? `Found evaluation data: ${refreshed.resultFiles?.length ?? 0} result file(s)`
            : "No evaluation data found. Create evaluation/eval-config.json to get started.");
          break;
        }
        case "viewDemo": {
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: undefined } });
          break;
        }
        case "createEvalConfig": {
          const ws = vscode.workspace.workspaceFolders?.[0];
          if (!ws) { vscode.window.showWarningMessage("Open a workspace first."); break; }
          const evalDir = path.join(ws.uri.fsPath, "evaluation");
          if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir, { recursive: true });
          const configFile = path.join(evalDir, "eval-config.json");
          if (!fs.existsSync(configFile)) {
            fs.writeFileSync(configFile, JSON.stringify({
              metrics: ["groundedness", "relevance", "coherence", "fluency", "safety"],
              thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0 },
              dataset: "evaluation/test-data.jsonl"
            }, null, 2));
          }
          vscode.window.showTextDocument(vscode.Uri.file(configFile));
          // Refresh panel
          const r = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: r } });
          break;
        }
        case "createEvalResults": {
          const ws = vscode.workspace.workspaceFolders?.[0];
          if (!ws) { vscode.window.showWarningMessage("Open a workspace first."); break; }
          const evalDir = path.join(ws.uri.fsPath, "evaluation");
          if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir, { recursive: true });
          const resultsFile = path.join(evalDir, "eval-results.json");
          if (!fs.existsSync(resultsFile)) {
            fs.writeFileSync(resultsFile, JSON.stringify({
              timestamp: new Date().toISOString(),
              scores: { groundedness: 4.5, relevance: 4.2, coherence: 4.3, fluency: 4.6, safety: 4.9 }
            }, null, 2));
          }
          vscode.window.showTextDocument(vscode.Uri.file(resultsFile));
          const r2 = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: r2 } });
          break;
        }
        case "exportJson":
          if (msg.scores) vscode.env.clipboard.writeText(JSON.stringify(msg.scores, null, 2)).then(() =>
            vscode.window.showInformationMessage("Scores copied to clipboard as JSON"));
          break;
        case "exportCsv":
          if (msg.scores) {
            const header = "metric,score,threshold,status\n";
            const rows = Object.entries(msg.scores as Record<string, number>).map(([k, v]) =>
              `${k},${v},4.0,${v >= 4.0 ? "PASS" : "FAIL"}`).join("\n");
            vscode.env.clipboard.writeText(header + rows).then(() =>
              vscode.window.showInformationMessage("Scores copied to clipboard as CSV"));
          }
          break;
      }
    });
  });

  // ─── Factory Status Command ───
  safeRegister("frootai.factoryStatus", async () => {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      vscode.window.showWarningMessage("Open a FrootAI workspace to view factory status.");
      return;
    }

    const catalogPath = path.join(ws.uri.fsPath, ".factory", "fai-catalog.json");
    if (!fs.existsSync(catalogPath)) {
      const action = await vscode.window.showInformationMessage(
        "No factory catalog found. Run the factory pipeline first.",
        "Run Factory"
      );
      if (action === "Run Factory") {
        const terminal = vscode.window.createTerminal("FAI Factory");
        terminal.show();
        terminal.sendText("npm run factory");
      }
      return;
    }

    try {
      const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
      const s = cat.stats;
      const age = Date.now() - new Date(cat.generated).getTime();
      const ageStr = age > 86400000 ? `${Math.floor(age / 86400000)}d ago` :
        age > 3600000 ? `${Math.floor(age / 3600000)}h ago` :
          `${Math.floor(age / 60000)}m ago`;
      const stale = age > 86400000;

      const msg = `🍊 FAI Factory: ${s.totalPrimitives} primitives | ` +
        `${s.agents} agents, ${s.skills} skills, ${s.instructions} instructions | ` +
        `${s.plays} plays, ${s.mcpTools} MCP tools | ` +
        `v${cat.version} @ ${cat.commit} (${ageStr})`;

      const action = await vscode.window.showInformationMessage(
        msg,
        stale ? "⚠️ Stale — Rebuild" : "Rebuild",
        "Show Terminal Status"
      );

      if (action?.includes("Rebuild")) {
        const terminal = vscode.window.createTerminal("FAI Factory");
        terminal.show();
        terminal.sendText("npm run factory");
      } else if (action === "Show Terminal Status") {
        const terminal = vscode.window.createTerminal("FAI Factory Status");
        terminal.show();
        terminal.sendText("npm run factory:status");
      }
    } catch {
      vscode.window.showErrorMessage("Failed to read factory catalog.");
    }
  });

  safeRegister("frootai.openScaffoldWizard", (initialPlay?: unknown) => {
    if (openWorkbenchRoute) return openWorkbenchRoute("/scaffold");
    const panel = createReactPanel(context.extensionUri, "frootai.scaffold", "Scaffold Wizard", { panel: "scaffold", plays: SOLUTION_PLAYS, initialPlay: (initialPlay as typeof SOLUTION_PLAYS[number]) ?? null });
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      if (msg.command === "scaffold") vscode.commands.executeCommand("frootai.initDevKit");
      if (msg.command === "openFolder") vscode.commands.executeCommand("vscode.openFolder");
    });
  });

  safeRegister("frootai.openMcpExplorer", () => {
    if (openWorkbenchRoute) return openWorkbenchRoute("/mcp-tooling");
    const panel = createReactPanel(context.extensionUri, "frootai.mcpExplorer", "MCP Tool Explorer", { panel: "mcpExplorer" });
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.command) {
        case "copyToClipboard":
          vscode.env.clipboard.writeText(String(msg.text)).then(() =>
            vscode.window.showInformationMessage("Copied to clipboard!"));
          break;
        case "tryTool":
          vscode.window.showInformationMessage(
            `MCP Tool "${msg.toolName}" — Run \`npx frootai-mcp@latest\` to start the server, then use @fai in Copilot Chat.`,
            "Copy Command"
          ).then(sel => {
            if (sel === "Copy Command") vscode.env.clipboard.writeText("npx frootai-mcp@latest");
          });
          break;
        case "openUrl":
          if (msg.url) void openApprovedExternal(msg.url).catch((error) => vscode.window.showWarningMessage(error instanceof Error ? error.message : String(error)));
          break;
      }
    });
  });

  // ─── Play Browser: browse all plays with search, categories, pagination ───
  safeRegister("frootai.browsePlays", () => {
    if (openWorkbenchRoute) return openWorkbenchRoute("/solution-plays");
    const panel = createReactPanel(context.extensionUri, "frootai.playBrowser", "Solution Plays", { panel: "playBrowser", plays: SOLUTION_PLAYS });
    setupNavigationHandler(panel, context);
  });

  // ─── Solution Configurator: 3-question wizard ───
  safeRegister("frootai.openConfigurator", () => {
    if (openWorkbenchRoute) return openWorkbenchRoute("/configurator");
    const panel = createReactPanel(context.extensionUri, "frootai.configurator", "Solution Configurator", { panel: "configurator", plays: SOLUTION_PLAYS });
    setupNavigationHandler(panel, context);
  });

  // ─── Single-page FrootAI Workbench ───
  let workbenchPanel: vscode.WebviewPanel | undefined;
  const openWorkbench = async (initialRoute = "/"): Promise<void> => {
    await accountReady;
    if (workbenchPanel) {
      workbenchPanel.reveal(vscode.ViewColumn.One);
      if (initialRoute === "/repository-intelligence" && analyzeWorkbenchRepository) await analyzeWorkbenchRepository();
      else await workbenchPanel.webview.postMessage({ type: "workbenchNavigate", route: initialRoute });
      return;
    }
    const panel = createReactPanel(context.extensionUri, "frootai.workbench", "FrootAI Workbench", { panel: "workbench", route: initialRoute, plays: SOLUTION_PLAYS, account: accountService.getSnapshot() });
    workbenchPanel = panel;
    let panelDisposed = false;
    const postWorkbench = async (message: unknown): Promise<boolean> => {
      if (panelDisposed) return false;
      try { return await panel.webview.postMessage(message); }
      catch (error) {
        if (panelDisposed || (error instanceof Error && /webview is disposed/i.test(error.message))) return false;
        throw error;
      }
    };
    const workspaceId = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString()).sort().join("|") || "global";
    let conversation = await conversationStore.load(workspaceId);
    let requestController: AbortController | null = null;
    let playOperationActive = false;
    const playTargets = new Map<string, vscode.WorkspaceFolder>();
    const primitives = loadWorkbenchPrimitives(context.extensionPath);
    const modules = loadWorkbenchModules(context.extensionPath);
    const hydrateStatic = async () => postWorkbench({ type: "workbenchHydrate", modules, primitives, plugins: primitives.plugins, account: accountService.getSnapshot(), evalData: scanWorkspaceEvalData() });
    const analyzeRepositoryIntoPanel = async (): Promise<void> => {
      await panel.webview.postMessage({ type: "workbenchNavigate", route: "/repository-intelligence" });
      const folders = vscode.workspace.workspaceFolders ?? [];
      const folder = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((item) => ({ label: item.name, description: item.uri.fsPath, folder: item })), { title: "Repository Intelligence", placeHolder: "Choose the workspace to analyze" }).then((item) => item?.folder);
      if (!folder) { await panel.webview.postMessage({ type: "workbenchRepositoryError", message: "Open or choose a workspace to map its technology, architecture signals, readiness gaps, and matching Solution Plays." }); return; }
      try {
        const report = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: analyzing ${folder.name}`, cancellable: false }, async () => analyzeRepository(await scanRepository(folder), SOLUTION_PLAYS));
        await panel.webview.postMessage({ type: "workbenchRepositoryReport", report });
      } catch (error) { await panel.webview.postMessage({ type: "workbenchRepositoryError", message: error instanceof Error ? error.message : String(error) }); }
    };
    analyzeWorkbenchRepository = analyzeRepositoryIntoPanel;
    const installWorkbenchPlayKit = async (kit: PlayKit, play = SOLUTION_PLAYS.find((candidate) => candidate.id === "01")): Promise<void> => {
      if (!play) return;
      const label = kit === "devkit" ? "DevKit" : kit === "tunekit" ? "TuneKit" : "SpecKit";
      const folders = vscode.workspace.workspaceFolders ?? [];
      const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${play.name} ${label}`, placeHolder: "Choose the target workspace" }).then((item) => item?.folder);
      if (!selected) { await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "cancelled", message: "Open or choose a workspace before installing this kit." }); return; }
      await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "planning", message: `Resolving canonical ${label} files…` });
      try {
        const plan = await fetchPlayKitPlan(play.dir, kit);
        const confirmation = await vscode.window.showInformationMessage(`Download ${plan.length} canonical ${label} files for ${play.name} into ${selected.name}? Existing files will be preserved.`, { modal: true }, `Download ${label}`);
        if (confirmation !== `Download ${label}`) { await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "cancelled", message: `${label} installation cancelled.` }); return; }
        const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: downloading ${play.name} ${label}`, cancellable: true }, async (progress, cancellation) => {
          const controller = new AbortController(); cancellation.onCancellationRequested(() => controller.abort());
          return downloadPlayKit({ targetRoot: selected.uri.fsPath, plan, signal: controller.signal, onProgress: (completed, total, file) => progress.report({ message: `${completed}/${total} · ${file}`, increment: 100 / total }) });
        });
        playTargets.set(play.id, selected);
        await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: "succeeded", message: `${label} ready: ${result.copied.length} downloaded, ${result.skipped.length} existing files preserved.`, copied: result.copied, skipped: result.skipped });
      } catch (error) { const cancelled = error instanceof Error && /cancel/i.test(error.message); await panel.webview.postMessage({ type: "playKitStatus", kit, playId: play.id, status: cancelled ? "cancelled" : "failed", message: cancelled ? `${label} installation cancelled; files created by this operation were rolled back.` : `${label} failed: ${error instanceof Error ? error.message : String(error)}` }); }
    };
    const installWorkbenchToolbox = async (play = SOLUTION_PLAYS.find((candidate) => candidate.id === "01")): Promise<void> => {
      if (!play) return;
      const folders = vscode.workspace.workspaceFolders ?? [];
      const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${play.name} Complete Toolbox`, placeHolder: "Choose the target workspace" }).then((item) => item?.folder);
      if (!selected) { await postWorkbench({ type: "playToolboxStatus", playId: play.id, status: "cancelled", message: "Open or choose a workspace before installing the Complete Toolbox." }); return; }
      await postWorkbench({ type: "playToolboxStatus", playId: play.id, status: "planning", message: "Resolving DevKit, TuneKit, SpecKit, Hooks, Prompts, and Plugin metadata…" });
      try {
        const plans = await Promise.all((["devkit", "tunekit", "speckit"] as const).map((kit) => fetchPlayKitPlan(play.dir, kit)));
        const merged = [...new Map(plans.flat().map((file) => [file.relativePath, file])).values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
        const confirmation = await vscode.window.showInformationMessage(`Install the complete ${play.name} toolbox (${merged.length} canonical files) into ${selected.name}? Includes DevKit, TuneKit, SpecKit, Hooks, Prompts, and Plugin metadata. Existing files will be preserved.`, { modal: true }, "Install Complete Toolbox");
        if (confirmation !== "Install Complete Toolbox") { await postWorkbench({ type: "playToolboxStatus", playId: play.id, status: "cancelled", message: "Complete Toolbox installation cancelled." }); return; }
        const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FrootAI: installing ${play.name} Complete Toolbox`, cancellable: true }, async (progress, cancellation) => {
          const controller = new AbortController(); cancellation.onCancellationRequested(() => controller.abort());
          return downloadPlayKit({ targetRoot: selected.uri.fsPath, plan: merged, signal: controller.signal, onProgress: (completed, total, file) => progress.report({ message: `${completed}/${total} · ${file}`, increment: 100 / total }) });
        });
        playTargets.set(play.id, selected);
        await postWorkbench({ type: "playToolboxStatus", playId: play.id, status: "succeeded", message: `Complete Toolbox ready: ${result.copied.length} files downloaded, ${result.skipped.length} existing files preserved across all six delivery surfaces.`, copied: result.copied, skipped: result.skipped });
      } catch (error) { const cancelled = error instanceof Error && /cancel/i.test(error.message); await postWorkbench({ type: "playToolboxStatus", playId: play.id, status: cancelled ? "cancelled" : "failed", message: cancelled ? "Complete Toolbox installation cancelled; files created by this operation were rolled back." : `Complete Toolbox failed: ${error instanceof Error ? error.message : String(error)}` }); }
    };
    const installWorkbenchStandalone = async (kind: "hooks" | "prompts" | "plugin", play = SOLUTION_PLAYS.find((candidate) => candidate.id === "01")): Promise<void> => {
      if (!play) return;
      const labels = { hooks: "Hooks", prompts: "Prompts", plugin: "Plugin metadata" } as const;
      const folders = vscode.workspace.workspaceFolders ?? [];
      const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Install ${play.name} ${labels[kind]}`, placeHolder: "Choose the target workspace" }).then((item) => item?.folder);
      if (!selected) { await postWorkbench({ type: "playKitStatus", kit: kind, playId: play.id, status: "cancelled", message: `Open or choose a workspace before installing ${labels[kind]}.` }); return; }
      await postWorkbench({ type: "playKitStatus", kit: kind, playId: play.id, status: "planning", message: `Resolving canonical ${labels[kind]} files…` });
      try {
        const devkit = await fetchPlayKitPlan(play.dir, "devkit");
        const plan = kind === "hooks" ? devkit.filter((file) => file.relativePath.startsWith(".github/hooks/")) : kind === "prompts" ? devkit.filter((file) => file.relativePath.startsWith(".github/prompts/")) : [...devkit.filter((file) => file.relativePath === "plugin.json"), ...(await fetchPlayKitPlan(play.dir, "speckit")).filter((file) => file.relativePath === "spec/plugin.json")];
        if (!plan.length) throw new Error(`This Play does not publish canonical ${labels[kind]} files.`);
        const confirmation = await vscode.window.showInformationMessage(`Install ${plan.length} canonical ${labels[kind]} file${plan.length === 1 ? "" : "s"} for ${play.name} into ${selected.name}? Existing files will be preserved.`, { modal: true }, `Install ${labels[kind]}`);
        if (confirmation !== `Install ${labels[kind]}`) { await postWorkbench({ type: "playKitStatus", kit: kind, playId: play.id, status: "cancelled", message: `${labels[kind]} installation cancelled.` }); return; }
        const result = await downloadPlayKit({ targetRoot: selected.uri.fsPath, plan });
        playTargets.set(play.id, selected);
        await postWorkbench({ type: "playKitStatus", kit: kind, playId: play.id, status: "succeeded", message: `${labels[kind]} ready: ${result.copied.length} downloaded, ${result.skipped.length} existing files preserved.` });
      } catch (error) { await postWorkbench({ type: "playKitStatus", kit: kind, playId: play.id, status: "failed", message: `${labels[kind]} failed: ${error instanceof Error ? error.message : String(error)}` }); }
    };
    const runPlayOperation = async (play: typeof SOLUTION_PLAYS[number] | undefined, statusKind: string, operation: () => Promise<void>): Promise<void> => {
      if (!play) return;
      if (playOperationActive) { await postWorkbench({ type: statusKind === "toolbox" ? "playToolboxStatus" : "playKitStatus", ...(statusKind === "toolbox" ? {} : { kit: statusKind }), playId: play.id, status: "failed", message: "Another Toolbox operation is already running. Wait for it to finish before starting another." }); return; }
      playOperationActive = true;
      try { await operation(); } finally { playOperationActive = false; }
    };
    const accountSubscription = accountService.subscribe((account) => { void postWorkbench({ type: "workbenchHydrate", account }); void postWorkbench({ type: "agentFaiState", account }); });
    panel.onDidDispose(() => { panelDisposed = true; requestController?.abort(); accountSubscription.dispose(); if (workbenchPanel === panel) { workbenchPanel = undefined; analyzeWorkbenchRepository = undefined; } });
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      const navigate = (route: string) => panel.webview.postMessage({ type: "workbenchNavigate", route });
      const resolvePlay = () => SOLUTION_PLAYS.find((play) => play.id === msg.playId || play.dir === msg.playDir || play.id === msg.play?.id);
      try {
        switch (msg.command) {
          case "workbenchReady":
            await hydrateStatic();
            void loadWorkbenchAccelerators().then((accelerators) => postWorkbench({ type: "workbenchHydrate", accelerators, acceleratorsLoading: false })).catch((error) => logChannel.appendLine(`[workbench] accelerator hydration failed: ${error instanceof Error ? error.message : String(error)}`));
            if (msg.route === "/repository-intelligence") void analyzeRepositoryIntoPanel();
            break;
          case "workbenchNavigate": if (typeof msg.route === "string") await navigate(msg.route); break;
          case "account": await navigate("/account"); break;
          case "browsePlays": await navigate("/solution-plays"); break;
          case "solutionAccelerator": await navigate("/solution-accelerator"); break;
          case "mcpExplorer": await navigate("/mcp-tooling"); break;
          case "docs": await navigate("/docs"); break;
          case "openSetup": await navigate("/docs"); break;
          case "glossary": await navigate("/glossary"); break;
          case "configurator": case "openConfigurator": await navigate("/configurator"); break;
          case "openPrimitives": case "primitivesCatalog": await navigate(typeof msg.primitiveType === "string" && ["agents", "skills", "instructions", "hooks", "plugins"].includes(msg.primitiveType) ? `/primitives/${msg.primitiveType}` : "/primitives"); break;
          case "openPrimitive": {
            const primitiveType = typeof msg.primitiveType === "string" ? msg.primitiveType : "";
            const primitiveId = typeof msg.primitiveId === "string" ? msg.primitiveId : "";
            if (["agents", "skills", "instructions", "hooks", "plugins"].includes(primitiveType) && /^[a-zA-Z0-9._/-]{1,180}$/.test(primitiveId)) await navigate(`/primitives/${primitiveType}/${primitiveId}`);
            else await navigate("/primitives");
            break;
          }
          case "openMarketplace": await navigate("/marketplace"); break;
          case "openProtocol": await navigate("/about"); break;
          case "openAgentFai": await navigate("/agent-fai"); break;
          case "evaluation": await navigate("/evaluation"); break;
          case "scaffold": {
            if (!msg.playId) { await navigate("/scaffold"); break; }
            const play = resolvePlay();
            const projectName = typeof msg.projectName === "string" ? msg.projectName.trim() : "";
            if (!play || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(projectName) || projectName === "." || projectName === "..") { await panel.webview.postMessage({ type: "scaffoldStatus", status: "failed", message: "Use a safe project folder name containing letters, numbers, dots, underscores, or hyphens." }); break; }
            const folders = vscode.workspace.workspaceFolders ?? [];
            const selected = folders.length === 1 ? folders[0] : await vscode.window.showQuickPick(folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })), { title: `Create ${projectName}`, placeHolder: "Choose the parent workspace" }).then((item) => item?.folder);
            if (!selected) { await panel.webview.postMessage({ type: "scaffoldStatus", status: "failed", message: "Open or choose a workspace before creating the project." }); break; }
            const target = path.resolve(selected.uri.fsPath, projectName);
            if (path.dirname(target) !== path.resolve(selected.uri.fsPath)) { await panel.webview.postMessage({ type: "scaffoldStatus", status: "failed", message: "The project folder must be a direct child of the selected workspace." }); break; }
            const confirmation = await vscode.window.showInformationMessage(`Create ${play.name} DevKit in ${target}? Existing files will be preserved.`, { modal: true }, "Create project");
            if (confirmation !== "Create project") { await panel.webview.postMessage({ type: "scaffoldStatus", status: "failed", message: "Project creation cancelled." }); break; }
            await panel.webview.postMessage({ type: "scaffoldStatus", status: "running", message: "Downloading canonical DevKit files…" });
            try {
              const result = await downloadPlayKit({ targetRoot: target, plan: await fetchPlayKitPlan(play.dir, "devkit") });
              await panel.webview.postMessage({ type: "scaffoldStatus", status: "succeeded", message: `${projectName} created: ${result.copied.length} files downloaded, ${result.skipped.length} existing files preserved.`, path: target });
            } catch (error) { await panel.webview.postMessage({ type: "scaffoldStatus", status: "failed", message: error instanceof Error ? error.message : String(error) }); }
            break;
          }
          case "orchard": case "studio": case "lab": case "lean": await navigate(`/${msg.command}`); break;
          case "searchAll": await vscode.commands.executeCommand("frootai.searchAll"); break;
          case "navigate":
            if (msg.panel === "playDetail" && msg.play?.id) await navigate(`/solution-plays/${msg.play.id}`);
            else if (msg.panel === "playBrowser") await panel.webview.postMessage({ type: "workbenchNavigate", route: "/solution-plays", replace: true });
            else if (msg.panel === "configurator") await navigate("/configurator");
            break;
          case "openPlay": if (msg.playId) await navigate(`/solution-plays/${msg.playId}`); break;
          case "installAcceleratorAssets": {
            const acceleratorId = typeof msg.acceleratorId === "string" ? msg.acceleratorId : "";
            const entry = (await loadWorkbenchAccelerators()).find((candidate) => candidate.id === acceleratorId);
            if (entry) await installAcceleratorGithubAssets(entry, panel);
            else await panel.webview.postMessage({ type: "acceleratorInstallStatus", id: acceleratorId, status: "failed", message: "The selected accelerator is no longer available in the canonical catalog." });
            break;
          }
          case "cloneAccelerator": {
            const acceleratorId = typeof msg.acceleratorId === "string" ? msg.acceleratorId : "";
            const entry = (await loadWorkbenchAccelerators()).find((candidate) => candidate.id === acceleratorId);
            const source = entry ? parseGitHubRepositorySource(entry.sourceUrl) : null;
            if (!entry || !source) { void vscode.window.showWarningMessage("This accelerator does not expose a cloneable GitHub repository."); break; }
            const confirmation = await vscode.window.showInformationMessage(`Clone the full ${entry.fullName} repository using VS Code Git? Review repository code and licenses before running it.`, { modal: true }, "Choose clone location");
            if (confirmation === "Choose clone location") await vscode.commands.executeCommand("git.clone", source.cloneUrl);
            break;
          }
          case "openModule": if (typeof msg.moduleId === "string") await navigate(`/docs/${msg.moduleId}`); break;
          case "repositoryIntelligence": case "analyzeRepository": {
            await analyzeRepositoryIntoPanel();
            break;
          }
          case "diagram": {
            const play = resolvePlay(); if (!play) break;
            await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "loading" });
            try { await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "succeeded", ...(await fetchArchitecture(play.dir)) }); }
            catch (error) {
              const services = (play.infra ?? "Application · AI Runtime · Data · Observability").split("·").map((item) => item.trim()).filter(Boolean);
              const nodes = services.map((service, index) => `  S${index + 1}[${service}]`).join("\n");
              const links = services.slice(1).map((_, index) => `  S${index + 1} --> S${index + 2}`).join("\n");
              await panel.webview.postMessage({ type: "architectureStatus", playId: play.id, status: "degraded", markdown: `# ${play.name} architecture\n\n\`\`\`mermaid\ngraph TD\n  User[User / Client] --> S1\n${nodes}\n${links}\n\`\`\``, message: `${error instanceof Error ? error.message : String(error)} Showing the bundled graphical contract.` });
            }
            break;
          }
          case "initDevKit": { const play = resolvePlay(); await runPlayOperation(play, "devkit", () => installWorkbenchPlayKit("devkit", play)); break; }
          case "initTuneKit": { const play = resolvePlay(); await runPlayOperation(play, "tunekit", () => installWorkbenchPlayKit("tunekit", play)); break; }
          case "initSpecKit": { const play = resolvePlay(); await runPlayOperation(play, "speckit", () => installWorkbenchPlayKit("speckit", play)); break; }
          case "installToolbox": { const play = resolvePlay(); await runPlayOperation(play, "toolbox", () => installWorkbenchToolbox(play)); break; }
          case "initHooks": { const play = resolvePlay(); await runPlayOperation(play, "hooks", () => installWorkbenchStandalone("hooks", play)); break; }
          case "initPrompts": { const play = resolvePlay(); await runPlayOperation(play, "prompts", () => installWorkbenchStandalone("prompts", play)); break; }
          case "installPlugin": { const play = resolvePlay(); if (msg.pluginId) await vscode.commands.executeCommand("frootai.installPlugin", msg.pluginId); else await runPlayOperation(play, "plugin", () => installWorkbenchStandalone("plugin", play)); break; }
          case "installPrimitive": {
            const command = msg.primitiveType === "agents" ? "frootai.installAgent" : msg.primitiveType === "instructions" ? "frootai.installInstruction" : msg.primitiveType === "skills" ? "frootai.installSkill" : msg.primitiveType === "hooks" ? "frootai.installHook" : "frootai.installPlugin";
            await vscode.commands.executeCommand(command, msg.primitiveId); break;
          }
          case "cost": await vscode.commands.executeCommand("frootai.estimateCostForPlay", resolvePlay()); break;
          case "runEvaluation": { const play = resolvePlay(); await vscode.commands.executeCommand("frootai.runEvaluation", { playId: play?.id, fsPath: play ? playTargets.get(play.id)?.uri.fsPath : undefined }); break; }
          case "createManifest": await vscode.commands.executeCommand("frootai.createManifest"); break;
          case "copyToClipboard": await vscode.env.clipboard.writeText(String(msg.text ?? "")); void vscode.window.showInformationMessage("Copied to clipboard."); break;
          case "tryTool": void vscode.window.showInformationMessage(`Use @fai to invoke ${msg.toolName ?? "this MCP tool"} through the configured FAI MCP server.`); break;
          case "accountSignIn": await vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/sign-in?from=/account/api-keys")); break;
          case "accountSetKey": await promptForApiKey(); break;
          case "accountRemoveKey": { const choice = await vscode.window.showWarningMessage("Disconnect this VS Code profile from FrootAI?", { modal: true }, "Disconnect"); if (choice === "Disconnect") await accountService.removeApiKey(); break; }
          case "agentFaiReady": await panel.webview.postMessage({ type: "agentFaiState", account: accountService.getSnapshot(), messages: conversation.messages, threadId: conversation.threadId }); break;
          case "resetAgentFai": conversation = { schemaVersion: 1, threadId: null, messages: [], updatedAt: new Date().toISOString() }; await conversationStore.clear(workspaceId); await panel.webview.postMessage({ type: "agentFaiReset" }); break;
          case "cancelAgentFai": requestController?.abort(); break;
          case "sendAgentFai": {
            const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 8_000) : ""; if (!text || requestController) break;
            const apiKey = await accountService.getApiKey(); if (!apiKey) { await panel.webview.postMessage({ type: "agentFaiError", code: "auth_required", message: "Connect a FrootAI personal API key before using hosted Agent FAI.", account: accountService.getSnapshot() }); break; }
            const priorHistory = [...conversation.messages]; conversation.messages.push({ role: "user", content: text, createdAt: new Date().toISOString() }); await conversationStore.save(workspaceId, conversation);
            const controller = new AbortController(); requestController = controller; let streamedReply = "";
            await panel.webview.postMessage({ type: "agentFaiStarted", phase: "grounding", message: "Searching FrootAI products, Solution Plays, and grounded evidence…" });
            try {
              const response = await askAgentFai({ apiKey, message: text, threadId: conversation.threadId, history: priorHistory, signal: controller.signal, stream: { onPhase: async () => { await panel.webview.postMessage({ type: "agentFaiThinking", phase: "responding", message: "Composing a grounded response…" }); }, onChunk: async (chunk) => { streamedReply += chunk; await panel.webview.postMessage({ type: "agentFaiChunk", content: chunk }); } } });
              conversation.threadId = response.threadId ?? conversation.threadId; conversation.messages.push({ role: "assistant", content: response.reply, createdAt: new Date().toISOString(), citations: response.citations, requestId: response.requestId }); await conversationStore.save(workspaceId, conversation); accountService.markVerified();
              await panel.webview.postMessage({ type: "agentFaiCompleted", reply: response.reply, citations: response.citations, threadId: conversation.threadId, requestId: response.requestId });
            } catch (error) {
              if (controller.signal.aborted) { const partial = streamedReply.trim() || null; if (partial) { conversation.messages.push({ role: "assistant", content: partial, createdAt: new Date().toISOString() }); await conversationStore.save(workspaceId, conversation); } await panel.webview.postMessage({ type: "agentFaiCancelled", partial }); }
              else { const typed = error instanceof AgentFaiClientError ? error : new AgentFaiClientError("agent_unavailable", error instanceof Error ? error.message : String(error), 502); if (typed.status === 401) await accountService.markInvalid(typed.message); await panel.webview.postMessage({ type: "agentFaiError", code: typed.code, message: typed.message, account: accountService.getSnapshot() }); }
            } finally { if (requestController === controller) requestController = null; }
            break;
          }
          case "scanWorkspace": await panel.webview.postMessage({ type: "workbenchHydrate", evalData: scanWorkspaceEvalData() }); break;
          case "viewDemo": await panel.webview.postMessage({ type: "workbenchHydrate", evalData: undefined }); break;
          case "exportJson": await vscode.env.clipboard.writeText(JSON.stringify(msg.scores ?? {}, null, 2)); break;
          case "exportCsv": if (msg.scores && typeof msg.scores === "object") await vscode.env.clipboard.writeText(`metric,score\n${Object.entries(msg.scores).map(([key, value]) => `${key},${value}`).join("\n")}`); break;
          case "openFolder": if (typeof msg.path === "string" && path.isAbsolute(msg.path)) await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(msg.path)); else await vscode.commands.executeCommand("vscode.openFolder"); break;
          case "openSchema": if (msg.schema) await vscode.env.openExternal(vscode.Uri.parse(`https://github.com/frootai/frootai/blob/main/schemas/${msg.schema}.schema.json`)); break;
          case "openUrl": {
            if (!msg.url) break;
            const internal = internalWorkbenchRoute(msg.url); if (internal) await navigate(internal); else await openApprovedExternal(msg.url); break;
          }
        }
      } catch (error) {
        logChannel.appendLine(`[workbench] ${msg.command} failed: ${error instanceof Error ? error.message : String(error)}`);
        void vscode.window.showErrorMessage(`FrootAI: ${msg.command} failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };
  openWorkbenchRoute = openWorkbench;
  safeRegister("frootai.openWelcome", (route?: unknown) => openWorkbench(typeof route === "string" && route.startsWith("/") ? route : "/"));

  // ─── Primitives Catalog Panel ───
  safeRegister("frootai.openPrimitivesCatalog", () => {
    const dataDir = path.join(context.extensionPath, "data");
    const loadJSON = (name: string) => {
      try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf-8")); }
      catch { return []; }
    };
    const primitives = {
      agents: loadJSON("agents.json"),
      skills: loadJSON("skills.json"),
      instructions: loadJSON("instructions.json"),
      hooks: loadJSON("hooks.json"),
      plugins: loadJSON("plugins.json"),
    };
    const total = Object.values(primitives).reduce((s: number, a: unknown[]) => s + a.length, 0);
    const panel = createReactPanel(context.extensionUri, "frootai.primitivesCatalog", `FAI Primitives (${total})`, { panel: "primitivesCatalog", primitives });
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.command === "openUrl" && msg.url) {
        await openApprovedExternal(msg.url);
      }
      if (msg.command === "installPrimitive" && msg.primitiveType && msg.primitiveId) {
        // Download primitive file(s) from GitHub into workspace
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
          vscode.window.showWarningMessage("Open a workspace folder first to install primitives.");
          return;
        }
        const wsRoot = folders[0].uri.fsPath;
        const typeConfig: Record<string, { destDir: string; repoPath: string; ext: string }> = {
          agents: { destDir: ".github/agents", repoPath: "agents", ext: ".agent.md" },
          instructions: { destDir: ".github/instructions", repoPath: "instructions", ext: ".instructions.md" },
          skills: { destDir: ".github/skills", repoPath: "skills", ext: "" },
          hooks: { destDir: ".github/hooks", repoPath: "hooks", ext: "" },
          plugins: { destDir: ".github/plugins", repoPath: "plugins", ext: "" },
        };
        const cfg = typeConfig[msg.primitiveType as string];
        if (!cfg) return;

        const destDir = path.join(wsRoot, cfg.destDir);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${String(msg.primitiveType).slice(0, -1)}: ${msg.primitiveId}...`, cancellable: false },
          async () => {
            try {
              // For single-file primitives (agents, instructions)
              if (cfg.ext) {
                const file = msg.file || `${cfg.repoPath}/${msg.primitiveId}${cfg.ext}`;
                const url = `https://raw.githubusercontent.com/frootai/frootai/main/${file}`;
                const resp = await fetch(url, { headers: { "User-Agent": "FrootAI-VSCode" } });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const content = await resp.text();
                const destFile = path.join(destDir, `${msg.primitiveId}${cfg.ext}`);
                fs.writeFileSync(destFile, content, "utf-8");
                vscode.window.showInformationMessage(`✅ Installed ${msg.primitiveId}${cfg.ext} → ${cfg.destDir}/`);
                vscode.commands.executeCommand("frootai.trackRecentPrimitive", msg.primitiveType, msg.primitiveId, msg.primitiveId);
              } else {
                // For folder-based primitives (skills, hooks, plugins) — download primary file
                const primaryFiles: Record<string, string> = {
                  skills: "SKILL.md",
                  hooks: "hooks.json",
                  plugins: "plugin.json",
                };
                const primaryFile = primaryFiles[msg.primitiveType as string] || "README.md";
                const folderName = msg.folder ? path.basename(String(msg.folder)) : String(msg.primitiveId);
                // Use folder field as repo path if available (handles plugins/ vs community-plugins/)
                const repoFolder = msg.folder ? String(msg.folder).replace(/\/+$/, "") : `${cfg.repoPath}/${folderName}`;
                const repoFile = `${repoFolder}/${primaryFile}`;
                const url = `https://raw.githubusercontent.com/frootai/frootai/main/${repoFile}`;
                const resp = await fetch(url, { headers: { "User-Agent": "FrootAI-VSCode" } });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const content = await resp.text();
                const primDir = path.join(destDir, String(folderName));
                if (!fs.existsSync(primDir)) fs.mkdirSync(primDir, { recursive: true });
                fs.writeFileSync(path.join(primDir, primaryFile), content, "utf-8");
                vscode.window.showInformationMessage(`✅ Installed ${folderName}/${primaryFile} → ${cfg.destDir}/${folderName}/`);
                vscode.commands.executeCommand("frootai.trackRecentPrimitive", msg.primitiveType, msg.primitiveId, folderName);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage(`Failed to install ${msg.primitiveId}: ${errMsg}`);
            }
          }
        );
      }
    });
  });

  // ─── Aliases for backward-compatible commands ───
  safeRegister("frootai.browsePrimitives", () => vscode.commands.executeCommand("frootai.openPrimitivesCatalog"));

  // ─── Install Agent via vscode:// protocol ───
  // Accepts optional preSelectedId (passed from URI handler /installAgent?id=X) to skip QuickPick
  safeRegister("frootai.installAgent", async (...args: unknown[]) => {
    const preSelectedId = (args[0] && typeof args[0] === "string") ? args[0] as string : undefined;
    interface PrimitiveEntry { name?: string; id: string; description?: string; file?: string }
    const agents: PrimitiveEntry[] = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "data", "agents.json"), "utf-8")); } catch { return []; }
    })();

    let chosen: PrimitiveEntry | undefined;
    if (preSelectedId) {
      chosen = agents.find(a => a.id === preSelectedId || a.name === preSelectedId);
      if (!chosen) {
        vscode.window.showWarningMessage(`FrootAI: Agent "${preSelectedId}" not found. Showing browser.`);
      }
    }
    if (!chosen) {
      const picked = await vscode.window.showQuickPick(
        agents.map(a => ({ label: a.name || a.id, description: a.description, id: a.id, file: a.file })),
        { placeHolder: "Select an agent to install in VS Code Copilot Chat", matchOnDescription: true }
      );
      if (!picked) return;
      chosen = picked as typeof picked & { file?: string; id: string };
    }

    const rawUrl = `https://raw.githubusercontent.com/frootai/frootai/main/${chosen.file || `agents/${chosen.id}.agent.md`}`;
    const uri = `vscode://github.copilot-chat/createAgent?url=${encodeURIComponent(rawUrl)}`;
    vscode.env.openExternal(vscode.Uri.parse(uri));
  });

  // ─── Install Instruction via vscode:// protocol ───
  // Accepts optional preSelectedId (passed from URI handler /installInstruction?id=X) to skip QuickPick
  safeRegister("frootai.installInstruction", async (...args: unknown[]) => {
    const preSelectedId = (args[0] && typeof args[0] === "string") ? args[0] as string : undefined;
    interface PrimitiveEntry { name?: string; id: string; description?: string; file?: string }
    const instructions: PrimitiveEntry[] = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "data", "instructions.json"), "utf-8")); } catch { return []; }
    })();

    let chosen: PrimitiveEntry | undefined;
    if (preSelectedId) {
      chosen = instructions.find(i => i.id === preSelectedId || i.name === preSelectedId);
      if (!chosen) {
        vscode.window.showWarningMessage(`FrootAI: Instruction "${preSelectedId}" not found. Showing browser.`);
      }
    }
    if (!chosen) {
      const picked = await vscode.window.showQuickPick(
        instructions.map(i => ({ label: i.name || i.id, description: i.description, id: i.id, file: i.file })),
        { placeHolder: "Select an instruction to install", matchOnDescription: true }
      );
      if (!picked) return;
      chosen = picked as typeof picked & { file?: string; id: string };
    }

    const rawUrl = `https://raw.githubusercontent.com/frootai/frootai/main/${chosen.file || `instructions/${chosen.id}.instructions.md`}`;
    const uri = `vscode://github.copilot-chat/createAgent?url=${encodeURIComponent(rawUrl)}`;
    vscode.env.openExternal(vscode.Uri.parse(uri));
  });

  // ─── Folder-based installer (Skills, Hooks, Prompts) — v5.1.8 ────────────
  // These primitives are folders containing 1-N files (SKILL.md + scripts,
  // hooks.json + script, etc.). We list the folder contents via GitHub Contents
  // API, download each file, and write into the workspace under the same path.
  // Used by /installSkill, /installHook, /installPrompt URI routes.
  // ─────────────────────────────────────────────────────────────────────────
  interface FolderPrimitive { id: string; name?: string; description?: string; folder?: string; file?: string }
  interface GhContentsItem { name: string; path: string; type: "file" | "dir"; download_url: string | null; }

  const installFolderPrimitive = async (
    kind: "skill" | "hook" | "prompt",
    preSelectedId: string | undefined
  ): Promise<void> => {
    const log = (globalThis as any).__frootaiLog as vscode.OutputChannel | undefined;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      vscode.window.showWarningMessage(`FrootAI: Open a workspace folder first to install a ${kind}.`);
      return;
    }
    const wsRoot = folders[0].uri.fsPath;

    // Load catalog (skills.json, hooks.json — prompts.json may not exist yet)
    const dataFile = path.join(context.extensionPath, "data", `${kind}s.json`);
    let catalog: FolderPrimitive[] = [];
    try { catalog = JSON.parse(fs.readFileSync(dataFile, "utf-8")); } catch { /* may not exist for prompts */ }

    // Resolve item — by pre-selected id, or via QuickPick
    let chosen: FolderPrimitive | undefined;
    if (preSelectedId) {
      chosen = catalog.find(p => p.id === preSelectedId || p.name === preSelectedId);
      if (!chosen && catalog.length === 0) {
        // No catalog (prompts case) — synthesize from id, default folder layout
        chosen = { id: preSelectedId, folder: `${kind}s/${preSelectedId}/` };
      } else if (!chosen) {
        vscode.window.showWarningMessage(`FrootAI: ${kind} "${preSelectedId}" not found in catalog. Showing browser.`);
      }
    }
    if (!chosen) {
      if (catalog.length === 0) {
        vscode.window.showWarningMessage(`FrootAI: No ${kind}s catalog available. Use the website to browse.`);
        return;
      }
      const picked = await vscode.window.showQuickPick(
        catalog.map(p => ({ label: p.name || p.id, description: p.description, p })),
        { placeHolder: `Select a ${kind} to install in your workspace`, matchOnDescription: true }
      );
      if (!picked) return;
      chosen = picked.p;
    }

    // Resolve repo path for the primitive (folder or single file)
    const repoPath = chosen.folder || chosen.file || `${kind}s/${chosen.id}/`;
    const trimmedPath = repoPath.replace(/\/$/, "");

    log?.appendLine(`[${new Date().toISOString()}] [installFolderPrimitive] ${kind}=${chosen.id} repoPath=${repoPath}`);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `FrootAI: Installing ${kind} "${chosen.id}"...`, cancellable: false },
      async (progress) => {
        try {
          // List folder contents via GitHub Contents API
          const apiUrl = `https://api.github.com/repos/frootai/frootai/contents/${trimmedPath}`;
          progress.report({ message: "Listing files..." });
          const res = await fetch(apiUrl, { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "FrootAI-VSCode" } });
          if (!res.ok) {
            throw new Error(`GitHub API ${res.status}: ${apiUrl}`);
          }
          const body = await res.json() as GhContentsItem | GhContentsItem[];
          const entries: GhContentsItem[] = Array.isArray(body) ? body : [body];
          const fileEntries = entries.filter(e => e.type === "file" && e.download_url);

          if (fileEntries.length === 0) {
            throw new Error(`No files found at ${trimmedPath}`);
          }

          let downloaded = 0;
          for (const entry of fileEntries) {
            progress.report({ message: `${++downloaded}/${fileEntries.length}: ${entry.name}`, increment: (1 / fileEntries.length) * 100 });
            const fileRes = await fetch(entry.download_url!, { headers: { "User-Agent": "FrootAI-VSCode" } });
            if (!fileRes.ok) {
              log?.appendLine(`[WARN] failed to download ${entry.path}: ${fileRes.status}`);
              continue;
            }
            const content = await fileRes.text();
            const dst = path.join(wsRoot, entry.path);
            const dstDir = path.dirname(dst);
            if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
            fs.writeFileSync(dst, content, "utf-8");
            log?.appendLine(`  wrote ${entry.path} (${content.length} bytes)`);
          }

          vscode.window.showInformationMessage(
            `✅ FrootAI: Installed ${kind} "${chosen!.id}" — ${downloaded} file(s) written to ${trimmedPath}`
          );

          // Open the primary file in the editor for immediate visibility
          const primary = fileEntries.find(e => /SKILL\.md$|hooks\.json$|\.prompt\.md$/i.test(e.name)) || fileEntries[0];
          if (primary) {
            const doc = await vscode.workspace.openTextDocument(path.join(wsRoot, primary.path));
            await vscode.window.showTextDocument(doc, { preview: false });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          log?.appendLine(`[ERROR] installFolderPrimitive ${kind} ${chosen!.id}: ${msg}`);
          log?.show(true);
          vscode.window.showErrorMessage(`FrootAI: install ${kind} failed — ${msg}`);
        }
      }
    );
  };

  safeRegister("frootai.installSkill", async (...args: unknown[]) => {
    const id = (args[0] && typeof args[0] === "string") ? args[0] as string : undefined;
    await installFolderPrimitive("skill", id);
  });

  safeRegister("frootai.installHook", async (...args: unknown[]) => {
    const id = (args[0] && typeof args[0] === "string") ? args[0] as string : undefined;
    await installFolderPrimitive("hook", id);
  });

  safeRegister("frootai.installPrompt", async (...args: unknown[]) => {
    const id = (args[0] && typeof args[0] === "string") ? args[0] as string : undefined;
    await installFolderPrimitive("prompt", id);
  });

  // ─── Agent FAI Chat Panel ───
  safeRegister("frootai.openAgentFai", async () => {
    await accountReady;
    const workspaceId = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString()).sort().join("|") || "global";
    let conversation = await conversationStore.load(workspaceId);
    let requestController: AbortController | null = null;
    const panel = createReactPanel(context.extensionUri, "frootai.agentFai", "Agent FAI", { panel: "agentFai", account: accountService.getSnapshot(), agentMessages: conversation.messages });
    const accountSubscription = accountService.subscribe((account) => { void panel.webview.postMessage({ type: "agentFaiState", account }); });
    panel.onDidDispose(() => { requestController?.abort(); accountSubscription.dispose(); });
    panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.command) {
        case "agentFaiReady": await panel.webview.postMessage({ type: "agentFaiState", account: accountService.getSnapshot(), messages: conversation.messages, threadId: conversation.threadId }); break;
        case "account": await vscode.commands.executeCommand("frootai.account.open"); break;
        case "resetAgentFai": conversation = { schemaVersion: 1, threadId: null, messages: [], updatedAt: new Date().toISOString() }; await conversationStore.clear(workspaceId); await panel.webview.postMessage({ type: "agentFaiReset" }); break;
        case "cancelAgentFai": requestController?.abort(); break;
        case "sendAgentFai": {
          const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 8_000) : "";
          if (!text || requestController) break;
          const apiKey = await accountService.getApiKey();
          if (!apiKey) { await panel.webview.postMessage({ type: "agentFaiError", code: "auth_required", message: "Connect a FrootAI personal API key before using hosted Agent FAI.", account: accountService.getSnapshot() }); break; }
          const priorHistory = [...conversation.messages];
          conversation.messages.push({ role: "user", content: text, createdAt: new Date().toISOString() });
          await conversationStore.save(workspaceId, conversation);
          const controller = new AbortController();
          requestController = controller;
          let streamedReply = "";
          const retrievalTimer = setTimeout(() => {
            if (!controller.signal.aborted && requestController === controller) void panel.webview.postMessage({ type: "agentFaiThinking", phase: "retrieving", message: "Retrieving the strongest grounded evidence and architecture patterns…" });
          }, 650);
          await panel.webview.postMessage({ type: "agentFaiStarted", phase: "grounding", message: "Searching FrootAI products, Solution Plays, and grounded evidence…" });
          try {
            const response = await askAgentFai({
              apiKey,
              message: text,
              threadId: conversation.threadId,
              history: priorHistory,
              signal: controller.signal,
              stream: {
                onPhase: async () => {
                  clearTimeout(retrievalTimer);
                  await panel.webview.postMessage({ type: "agentFaiThinking", phase: "responding", message: "Composing a grounded response…" });
                },
                onChunk: async (chunk) => {
                  streamedReply += chunk;
                  await panel.webview.postMessage({ type: "agentFaiChunk", content: chunk });
                },
              },
            });
            conversation.threadId = response.threadId ?? conversation.threadId;
            conversation.messages.push({ role: "assistant", content: response.reply, createdAt: new Date().toISOString(), citations: response.citations, requestId: response.requestId });
            await conversationStore.save(workspaceId, conversation);
            accountService.markVerified();
            await panel.webview.postMessage({ type: "agentFaiCompleted", reply: response.reply, citations: response.citations, threadId: conversation.threadId, requestId: response.requestId });
          } catch (error) {
            if (controller.signal.aborted) {
              const partial = streamedReply.trim() ? streamedReply : null;
              if (partial) {
                conversation.messages.push({ role: "assistant", content: partial, createdAt: new Date().toISOString() });
                await conversationStore.save(workspaceId, conversation);
              }
              await panel.webview.postMessage({ type: "agentFaiCancelled", partial });
            }
            else {
              const typed = error instanceof AgentFaiClientError ? error : new AgentFaiClientError("agent_unavailable", error instanceof Error ? error.message : String(error), 502);
              if (typed.status === 401) await accountService.markInvalid(typed.message);
              await panel.webview.postMessage({ type: "agentFaiError", code: typed.code, message: typed.message, account: accountService.getSnapshot() });
            }
          } finally { clearTimeout(retrievalTimer); if (requestController === controller) requestController = null; }
          break;
        }
        case "openPlay": {
          const play = SOLUTION_PLAYS.find(p => p.id === msg.playId || p.id.startsWith(String(msg.playId)));
          if (play && openWorkbenchRoute) { panel.dispose(); await openWorkbenchRoute(`/solution-plays/${play.id}`); }
          else if (play) await vscode.commands.executeCommand("frootai.openPlayDetail", play);
          break;
        }
        case "openPrimitive": {
          const primitiveType = typeof msg.primitiveType === "string" ? msg.primitiveType : "";
          const primitiveId = typeof msg.primitiveId === "string" ? msg.primitiveId : "";
          const route = ["agents", "skills", "instructions", "hooks", "plugins"].includes(primitiveType) && /^[a-zA-Z0-9._/-]{1,180}$/.test(primitiveId) ? `/primitives/${primitiveType}/${primitiveId}` : "/primitives";
          if (openWorkbenchRoute) { panel.dispose(); await openWorkbenchRoute(route); }
          break;
        }
        case "workbenchNavigate": if (typeof msg.route === "string" && msg.route.startsWith("/") && openWorkbenchRoute) { panel.dispose(); await openWorkbenchRoute(msg.route); } break;
        case "openConfigurator": vscode.commands.executeCommand("frootai.openConfigurator"); break;
        case "browsePlays": vscode.commands.executeCommand("frootai.browsePlays"); break;
        case "openSetup": vscode.commands.executeCommand("frootai.openSetupGuide"); break;
        case "openPrimitives": vscode.commands.executeCommand("frootai.openPrimitivesCatalog"); break;
        case "openMarketplace": vscode.commands.executeCommand("frootai.openMarketplace"); break;
        case "openUrl": if (msg.url) { const internal = internalWorkbenchRoute(msg.url); if (internal && openWorkbenchRoute) { panel.dispose(); await openWorkbenchRoute(internal); } else await openApprovedExternal(msg.url); } break;
      }
    });
  });

  // ─── Marketplace → redirect to Primitives Catalog ───
  safeRegister("frootai.openMarketplace", () => {
    vscode.commands.executeCommand("frootai.openPrimitivesCatalog");
  });

  // ─── FAI Protocol & Architecture Panel (D1-D3) ───
  safeRegister("frootai.openProtocolExplainer", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.protocolExplainer", "FAI Ecosystem", { panel: "protocolExplainer" });
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.command) {
        case "openUrl":
          if (msg.url) void openApprovedExternal(msg.url).catch((error) => vscode.window.showWarningMessage(error instanceof Error ? error.message : String(error)));
          break;
        case "openSchema": {
          const schemaPath = path.join(context.extensionPath, "..", "..", "..", "schemas", `${msg.schema}.schema.json`);
          // Try workspace first, then fallback to GitHub
          const ws = vscode.workspace.workspaceFolders?.[0];
          const localSchema = ws ? path.join(ws.uri.fsPath, "schemas", `${msg.schema}.schema.json`) : "";
          if (localSchema && fs.existsSync(localSchema)) {
            vscode.window.showTextDocument(vscode.Uri.file(localSchema));
          } else {
            vscode.env.openExternal(vscode.Uri.parse(`https://github.com/frootai/frootai/blob/main/schemas/${msg.schema}.schema.json`));
          }
          break;
        }
        case "openModule": {
          // Open knowledge module via Agent FAI
          vscode.commands.executeCommand("frootai.openAgentFai");
          break;
        }
      }
    });
  });

  // ─── Agent FAI Chat Participant ───
  try {
    const knowledgePath = path.join(context.extensionPath, "knowledge.json");
    let knowledge: KnowledgeData = {};
    try { knowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf-8")); } catch { }

    // Load BM25 search index for @fai chat participant (more accurate than keyword matching)
    const bm25Index: BM25Index | null = loadBM25Index(path.join(context.extensionPath, "search-index.json"));

    // Pre-build inverted index for knowledge modules (O(1) lookup vs O(n) per query)
    buildKnowledgeIndex(knowledge);

    const participant = vscode.chat.createChatParticipant("frootai.fai", async (request, chatContext, stream, token) => {
      const query = request.prompt.toLowerCase();
      const stopWords = new Set(["how", "to", "the", "a", "an", "is", "in", "on", "for", "of", "and", "or", "my", "can", "do", "i", "we", "it", "with", "what", "which", "should", "use", "about", "this", "that", "from", "have", "need", "want", "please", "me", "be", "get", "let", "make", "just", "some"]);
      const queryWords = query.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));

      stream.progress("Searching FrootAI knowledge base...");

      if (queryWords.length === 0) {
        stream.markdown("I couldn't find specific search terms. Try asking about a topic:\n\n");
        stream.markdown("- *Which play for enterprise RAG?*\n- *IoT edge AI solution*\n- *What is retrieval augmented generation?*\n- *Agent hosting patterns*\n\n");
        stream.markdown("---\n*Agent FAI — FrootAI Knowledge Engine*");
        return;
      }

      // Helper: whole-word match check
      const wordMatch = (text: string, word: string) => {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return regex.test(text);
      };

      // ── Check LRU cache before doing full search ──
      const cacheKey = [...queryWords].sort().join(" ");
      const cached = getCachedFaiResult(cacheKey);

      let scoredPlays: FaiSearchResult["scoredPlays"];
      let scoredModules: FaiSearchResult["scoredModules"];
      let glossaryMatches: FaiSearchResult["glossaryMatches"];

      if (cached) {
        scoredPlays = cached.scoredPlays;
        scoredModules = cached.scoredModules;
        glossaryMatches = cached.glossaryMatches;
      } else {
        // ── Search plays: BM25 first (probabilistic ranking), keyword fallback ──
        if (bm25Index && bm25Index.docs.length > 0) {
          const bm25Results = bm25SearchPlays(request.prompt, bm25Index, 5);
          scoredPlays = bm25Results
            .map(r => {
              const doc = bm25Index.docs[r.docIndex];
              const playId = doc.meta?.playId || doc.meta?.id;
              const play = SOLUTION_PLAYS.find(p => p.id === playId);
              return play ? { play, score: r.score, ratio: r.normalizedScore } : null;
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);
        } else {
          // Fallback: naive whole-word keyword matching
          scoredPlays = SOLUTION_PLAYS.map(p => {
            const fields = [
              p.id, p.name, p.desc || "", p.infra || "", p.cat || "",
              p.tagline || "", p.pattern || "",
            ].join(" ");
            const matchCount = queryWords.filter(w => wordMatch(fields, w)).length;
            return { play: p, score: matchCount, ratio: matchCount / queryWords.length };
          }).filter(s => s.score > 0 && s.ratio >= 0.4)
            .sort((a, b) => b.ratio - a.ratio || b.score - a.score)
            .slice(0, 5);
        }

        // ── Search knowledge modules via pre-built inverted index (O(1) per word) ──
        scoredModules = searchKnowledgeIndex(queryWords);

        // ── Search glossary via pre-built index ──
        const glossaryData = (knowledge.modules as Record<string, { content?: string }> | undefined)?.F3?.content || "";
        glossaryMatches = [];
        if (glossaryData) {
          const glossaryIndex = getGlossaryIndex(glossaryData);
          for (const [termLower, definition] of glossaryIndex) {
            if (queryWords.some(w => wordMatch(termLower, w) || termLower.includes(w))) {
              const displayTerm = termLower.charAt(0).toUpperCase() + termLower.slice(1);
              glossaryMatches.push({ term: displayTerm, definition });
            }
          }
        }

        // Cache computed results
        setCachedFaiResult(cacheKey, { scoredPlays, scoredModules, glossaryMatches });
      }

      // ── Build rich response ──
      let hasContent = false;

      if (scoredPlays.length > 0) {
        hasContent = true;
        stream.progress(`Found ${scoredPlays.length} matching plays...`);
        stream.markdown("## 🎯 Recommended Solution Plays\n\n");
        for (const { play: p, ratio } of scoredPlays) {
          const relevance = ratio >= 0.8 ? "🟢" : ratio >= 0.5 ? "🟡" : "🟠";
          stream.markdown(`${relevance} **Play ${p.id} — ${p.name}** · ${p.cx || ""} complexity\n\n`);
          stream.markdown(`> ${p.tagline || p.desc || ""}\n\n`);
          if (p.pattern) stream.markdown(`> **Pattern:** ${p.pattern}\n\n`);
          stream.markdown(`> **Infrastructure:** ${p.infra || "N/A"}\n\n`);
          if (p.costDev) stream.markdown(`> **Cost:** Dev ${p.costDev} · Prod ${p.costProd || "varies"}\n\n`);
        }
      }

      if (scoredModules.length > 0) {
        hasContent = true;
        stream.progress("Loading knowledge modules...");
        stream.markdown("## 📚 Relevant Knowledge\n\n");
        for (const m of scoredModules.slice(0, 3)) {
          stream.markdown(`### ${m.id} — ${m.name}\n\n`);
          const cleaned = m.snippet.replace(/^#+\s.+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
          stream.markdown(`${cleaned}\n\n`);
        }
      }

      if (glossaryMatches.length > 0 && glossaryMatches.length <= 8) {
        hasContent = true;
        stream.progress("Checking glossary...");
        stream.markdown("## 📖 Glossary\n\n");
        for (const g of glossaryMatches.slice(0, 5)) {
          stream.markdown(`**${g.term}** — ${g.definition.trim()}\n\n`);
        }
      }

      if (!hasContent) {
        stream.markdown(`No matches for "${queryWords.join(" ")}". Try:\n\n`);
        stream.markdown("- *enterprise RAG pipeline*\n- *multi-agent orchestration*\n- *IoT edge AI*\n- *what is retrieval augmented generation*\n- *cost optimization for AI*\n\n");
      }

      stream.markdown("\n---\n*Agent FAI — 101 plays · knowledge modules · comprehensive glossary · [frootai.dev](https://frootai.dev)*");
    });

    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "frootai-mark.png");
    context.subscriptions.push(participant);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`FrootAI: Chat participant not available — ${msg}`);
  }

  // ─── First Install: Show Welcome panel ───
  const CURRENT_VERSION = "9.2.0";
  const lastVersion = context.globalState.get<string>("frootai.lastVersion");

  if (!lastVersion) {
    // First install — show Welcome panel
    vscode.commands.executeCommand("frootai.openWelcome");
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
  } else if (lastVersion !== CURRENT_VERSION) {
    // Version update — show What's New
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
    const CHANGELOG: string[] = [
      "🧩 Primitives Catalog — 823 primitives in a rich searchable webview with WAF & domain filters",
      "🔍 Domain filtering — 10 sub-categories (RAG, Azure, Security, Agent, DevOps, ...)",
      "⚡ One-click agent install — agents install directly into VS Code via protocol link",
      "📂 Detail view — full metadata, CLI command, GitHub link for every primitive",
    ];
    vscode.window.showInformationMessage(
      `FrootAI updated to v${CURRENT_VERSION}! ${CHANGELOG[0]}`,
      "View All Changes", "Open Welcome"
    ).then(choice => {
      if (choice === "View All Changes") {
        vscode.window.showInformationMessage(CHANGELOG.join("\n"), { modal: true });
      } else if (choice === "Open Welcome") {
        vscode.commands.executeCommand("frootai.openWelcome");
      }
    });
  }
  // ─── File Decorations for FAI files ───
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new FaiFileDecorationProvider())
  );

  // ─── CodeLens for fai-manifest.json ───
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: "**/fai-manifest.json" },
      new FaiManifestCodeLensProvider()
    )
  );

  // ─── Workspace Play Detection — Status Bar ───
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusItem.command = "frootai.openDetectedPlay";
  context.subscriptions.push(statusItem);

  async function detectWorkspacePlay() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { statusItem.hide(); return; }
    for (const folder of folders) {
      const manifestUri = vscode.Uri.joinPath(folder.uri, "fai-manifest.json");
      try {
        const raw = await vscode.workspace.fs.readFile(manifestUri);
        const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
        const play = SOLUTION_PLAYS.find(p => p.id === playId);
        statusItem.text = `$(zap) FAI Play ${playId}${play ? `: ${play.name}` : ""}`;
        statusItem.tooltip = play
          ? `${play.name} — ${play.desc}\nClick to open play detail`
          : `Play ${manifest.play} detected\nClick to open play detail`;
        statusItem.show();
        return;
      } catch { /* no manifest */ }
    }
    statusItem.hide();
  }

  detectWorkspacePlay();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => detectWorkspacePlay()),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.fileName.endsWith("fai-manifest.json")) detectWorkspacePlay();
    })
  );

  safeRegister("frootai.openDetectedPlay", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    for (const folder of folders) {
      const manifestUri = vscode.Uri.joinPath(folder.uri, "fai-manifest.json");
      try {
        const raw = await vscode.workspace.fs.readFile(manifestUri);
        const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
        const play = SOLUTION_PLAYS.find(p => p.id === playId);
        if (play) vscode.commands.executeCommand("frootai.openPlayDetail", play);
        else vscode.window.showInformationMessage(`Play ${manifest.play} detected but no detail available.`);
        return;
      } catch { /* no manifest */ }
    }
    vscode.window.showInformationMessage("No fai-manifest.json found in workspace.");
  });

  // ─── Diagnostics Provider for fai-manifest.json ───
  const diagCollection = vscode.languages.createDiagnosticCollection("frootai");
  context.subscriptions.push(diagCollection);

  const VALID_WAF_PILLARS = ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"];

  function validateManifestDocument(doc: vscode.TextDocument) {
    if (!doc.fileName.endsWith("fai-manifest.json")) return;
    const diagnostics: vscode.Diagnostic[] = [];
    const text = doc.getText();

    let json: FaiManifest;
    try {
      json = JSON.parse(text);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Invalid JSON: ${errMsg}`,
        vscode.DiagnosticSeverity.Error
      ));
      diagCollection.set(doc.uri, diagnostics);
      return;
    }

    // Helper to find line of a key
    const findKeyLine = (key: string): number => {
      for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.includes(`"${key}"`)) return i;
      }
      return 0;
    };

    // Required top-level fields
    for (const field of ["play", "version", "context", "primitives"]) {
      if (json[field] === undefined) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Missing required field: "${field}"`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    // Validate play format (NN-kebab-case)
    if (json.play && !/^\d{2}-[a-z0-9-]+$/.test(json.play)) {
      const line = findKeyLine("play");
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
        `Play ID should be NN-kebab-case (e.g., "01-enterprise-rag"), got "${json.play}"`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    // Validate version (semver)
    if (json.version && !/^\d+\.\d+\.\d+/.test(json.version)) {
      const line = findKeyLine("version");
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
        `Version should be semver (e.g., "1.0.0"), got "${json.version}"`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    // Validate WAF pillars
    const wafValues: string[] = json.context?.waf || [];
    const wafLine = findKeyLine("waf");
    for (const w of wafValues) {
      if (!VALID_WAF_PILLARS.includes(w)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(wafLine, 0, wafLine, doc.lineAt(wafLine).text.length),
          `Invalid WAF pillar: "${w}". Valid: ${VALID_WAF_PILLARS.join(", ")}`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }

    // Validate guardrails thresholds (0-1)
    const guardrails = json.guardrails || {};
    const guardLine = findKeyLine("guardrails");
    for (const [key, val] of Object.entries(guardrails)) {
      if (typeof val === "number" && (val < 0 || val > 1)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(guardLine, 0, guardLine, doc.lineAt(guardLine).text.length),
          `Guardrail "${key}" threshold must be 0-1, got ${val}`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    // Validate primitives file references exist
    if (json.primitives && vscode.workspace.workspaceFolders?.[0]) {
      const wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const primLine = findKeyLine("primitives");
      for (const [primType, refs] of Object.entries(json.primitives)) {
        if (Array.isArray(refs)) {
          for (const ref of refs) {
            if (typeof ref === "string" && ref.startsWith("./")) {
              const fs = require("fs");
              const path = require("path");
              const fullPath = path.resolve(path.dirname(doc.fileName), ref);
              if (!fs.existsSync(fullPath)) {
                diagnostics.push(new vscode.Diagnostic(
                  new vscode.Range(primLine, 0, primLine, doc.lineAt(primLine).text.length),
                  `${primType}: referenced file not found — ${ref}`,
                  vscode.DiagnosticSeverity.Warning
                ));
              }
            }
          }
        }
      }
    }

    diagCollection.set(doc.uri, diagnostics);
  }

  // Run on open + save + change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateManifestDocument),
    vscode.workspace.onDidSaveTextDocument(validateManifestDocument),
    vscode.workspace.onDidChangeTextDocument(e => validateManifestDocument(e.document))
  );
  // Validate already-open documents
  vscode.workspace.textDocuments.forEach(validateManifestDocument);

  // ─── Validate Manifest Command ───
  safeRegister("frootai.validateManifest", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith("fai-manifest.json")) {
      const uris = await vscode.workspace.findFiles("**/fai-manifest.json", "**/node_modules/**", 5);
      if (uris.length === 0) {
        vscode.window.showWarningMessage("No fai-manifest.json found in workspace.");
        return;
      }
      const pick = uris.length === 1 ? uris[0] : await vscode.window.showQuickPick(
        uris.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
        { placeHolder: "Select manifest to validate" }
      ).then(p => p ? (p as { label: string; uri: vscode.Uri }).uri : undefined);
      if (pick) {
        const doc = await vscode.workspace.openTextDocument(pick);
        await vscode.window.showTextDocument(doc);
        validateManifestDocument(doc);
      }
      return;
    }
    validateManifestDocument(editor.document);
    const diags = diagCollection.get(editor.document.uri);
    if (!diags || diags.length === 0) {
      vscode.window.showInformationMessage("✅ fai-manifest.json is valid — no issues found.");
    } else {
      const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
      const warnings = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
      vscode.window.showWarningMessage(`fai-manifest.json: ${errors} error(s), ${warnings} warning(s). Check Problems panel.`);
    }
  });

  // ─── Context Menu: Open Play from fai-manifest.json ───
  safeRegister("frootai.openPlayFromManifest", async (...args: unknown[]) => {
    const fileUri = args[0] as vscode.Uri | undefined;
    const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri) return;
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
      const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
      const play = SOLUTION_PLAYS.find(p => p.id === playId);
      if (play) vscode.commands.executeCommand("frootai.openPlayDetail", play);
      else vscode.window.showInformationMessage(`Play "${manifest.play}" not found in catalog.`);
    } catch { vscode.window.showErrorMessage("Failed to parse fai-manifest.json"); }
  });

  // ─── Context Menu: Peek Agent/Skill definition ───
  safeRegister("frootai.peekFaiFile", async (...args: unknown[]) => {
    const fileUri = args[0] as vscode.Uri | undefined;
    const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri) return;
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

// ─── File Decoration Provider ───
class FaiFileDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const name = uri.path.split("/").pop() || "";
    const dir = uri.path.split("/").slice(-2, -1)[0] || "";

    // FAI Protocol files
    if (name === "fai-manifest.json") {
      return { badge: "FM", tooltip: "FAI Protocol Manifest — wiring context for this play", color: new vscode.ThemeColor("charts.green") };
    }
    if (name === "fai-context.json") {
      return { badge: "FC", tooltip: "FAI Context — LEGO block wiring", color: new vscode.ThemeColor("charts.blue") };
    }

    // Primitives
    if (name.endsWith(".agent.md")) {
      return { badge: "AG", tooltip: "FAI Agent definition", color: new vscode.ThemeColor("charts.green") };
    }
    if (name.endsWith(".instructions.md")) {
      return { badge: "IN", tooltip: "FAI Instructions file", color: new vscode.ThemeColor("charts.blue") };
    }
    if (name === "SKILL.md") {
      return { badge: "SK", tooltip: "FAI Skill definition", color: new vscode.ThemeColor("charts.purple") };
    }
    if (name === "hooks.json" && (dir === "hooks" || uri.path.includes(".github/hooks"))) {
      return { badge: "HK", tooltip: "FAI Hook definition", color: new vscode.ThemeColor("charts.orange") };
    }
    if (name.endsWith(".prompt.md") || (dir === "prompts" && name.endsWith(".md"))) {
      return { badge: "PR", tooltip: "FAI Prompt template", color: new vscode.ThemeColor("charts.yellow") };
    }
    if (name.endsWith(".yml") && dir === "workflows") {
      return { badge: "WF", tooltip: "FAI Workflow definition", color: new vscode.ThemeColor("charts.red") };
    }

    // Configuration & Infrastructure
    if ((name === "openai.json" || name === "guardrails.json") && dir === "config") {
      return { badge: "TK", tooltip: "TuneKit configuration", color: new vscode.ThemeColor("charts.orange") };
    }
    if (name.endsWith(".bicep") && dir === "infra") {
      return { badge: "IaC", tooltip: "Infrastructure as Code (Bicep)", color: new vscode.ThemeColor("charts.blue") };
    }

    // Evaluation
    if (dir === "evaluation" && (name.endsWith(".json") || name.endsWith(".py") || name.endsWith(".yaml"))) {
      return { badge: "EV", tooltip: "Evaluation pipeline file", color: new vscode.ThemeColor("charts.yellow") };
    }

    return undefined;
  }
}

// ─── CodeLens for fai-manifest.json ───
class FaiManifestCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const topRange = new vscode.Range(0, 0, 0, 0);

    lenses.push(new vscode.CodeLens(topRange, {
      title: "$(checklist) Validate Manifest",
      command: "frootai.validateManifest",
      tooltip: "Validate this fai-manifest.json against the FAI Protocol schema",
    }));

    // Parse to show wiring summary
    try {
      const json = JSON.parse(document.getText());
      const playId = json.play || "unknown";
      const primCount = Object.values(json.primitives || {}).reduce((a: number, v: unknown) => a + (Array.isArray(v) ? v.length : 0), 0);
      const wafCount = (json.context?.waf || []).length;
      lenses.push(new vscode.CodeLens(topRange, {
        title: `$(info) Play: ${playId} · ${primCount} primitives · ${wafCount} WAF pillars`,
        command: "",
        tooltip: `Manifest for play ${playId}`,
      }));
    } catch {
      lenses.push(new vscode.CodeLens(topRange, {
        title: "$(warning) Invalid JSON — cannot parse manifest",
        command: "",
      }));
    }

    // Find "primitives" key for a lens on that line
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      if (line.includes('"primitives"')) {
        lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
          title: "$(symbol-structure) View Wiring",
          command: "frootai.openWelcome",
          tooltip: "Open FrootAI to explore wired primitives",
        }));
        break;
      }
    }

    return lenses;
  }
}

/** Shared message handler for panels that support navigation between views */
function setupNavigationHandler(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
    const log = (globalThis as any).__frootaiLog as vscode.OutputChannel | undefined;
    const ver = context.extension.packageJSON.version;
    log?.appendLine(`[${new Date().toISOString()}] [navHandler v${ver}] received: command="${msg.command}" playId="${msg.playId}" playDir="${msg.playDir}"`);

    // Resolve play once for all play-aware commands
    const resolvePlay = () => {
      if (msg.playId) return SOLUTION_PLAYS.find(p => p.id === msg.playId);
      if (msg.playDir) return SOLUTION_PLAYS.find(p => p.dir === msg.playDir);
      return undefined;
    };

    try {
      switch (msg.command) {
        case "navigate":
          if (msg.panel === "playDetail" && msg.play) {
            await vscode.commands.executeCommand("frootai.openPlayDetail", msg.play);
          } else if (msg.panel === "playBrowser") {
            panel.title = "Solution Plays";
            panel.webview.postMessage({ type: "update", data: { panel: "playBrowser", plays: SOLUTION_PLAYS } });
          } else if (msg.panel === "configurator") {
            panel.title = "Solution Configurator";
            panel.webview.postMessage({ type: "update", data: { panel: "configurator", plays: SOLUTION_PLAYS } });
          }
          break;

        // ─── Full Packages ───
        case "initDevKit": await vscode.commands.executeCommand("frootai.initDevKit", resolvePlay()); break;
        case "initTuneKit": await vscode.commands.executeCommand("frootai.initTuneKit", resolvePlay()); break;
        case "initSpecKit": await vscode.commands.executeCommand("frootai.initSpecKit", resolvePlay()); break;

        // ─── Standalone (these were missing — caused the user-reported "6 buttons don't work") ───
        case "initHooks": await vscode.commands.executeCommand("frootai.initHooks", resolvePlay()); break;
        case "initPrompts": await vscode.commands.executeCommand("frootai.initPrompts", resolvePlay()); break;
        case "installPlugin": await vscode.commands.executeCommand("frootai.installPlugin", resolvePlay()); break;

        // ─── Analyze & Evaluate (these were missing) ───
        case "cost": await vscode.commands.executeCommand("frootai.estimateCostForPlay", resolvePlay()); break;
        case "diagram": await vscode.commands.executeCommand("frootai.showArchitectureDiagram", resolvePlay()); break;
        case "runEvaluation": await vscode.commands.executeCommand("frootai.runEvaluation"); break;

        // ─── Misc ───
        case "createManifest": await vscode.commands.executeCommand("frootai.createManifest"); break;
        case "openUrl":
          if (msg.url) void openApprovedExternal(msg.url).catch((error) => vscode.window.showWarningMessage(error instanceof Error ? error.message : String(error)));
          break;

        default:
          log?.appendLine(`[WARN] navHandler: unhandled command "${msg.command}"`);
          break;
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack : "";
      log?.appendLine(`[ERROR] navHandler ${msg.command} failed: ${errMsg}\n${stack}`);
      log?.show(true);
      vscode.window.showErrorMessage(`FrootAI: ${msg.command} failed — ${errMsg}`);
    }
  });
}

export function deactivate(): void {
  deactivateTokenOps();
  legacy.deactivate();
}
