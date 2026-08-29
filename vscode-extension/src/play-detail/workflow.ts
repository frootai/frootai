import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assertGitBlob, assertGitCommitSha } from "../accelerator-assets";

const GITHUB_REPOSITORY = "https://api.github.com/repos/frootai/frootai";
const RAW_BASE = "https://raw.githubusercontent.com/frootai/frootai";
const MAX_DEVKIT_FILES = 400;
const MAX_PLAY_KIT_FILE_BYTES = 1_000_000;
const MAX_PLAY_KIT_BYTES = 10_000_000;

export interface GitTreeEntry { path?: string; type?: string; sha?: string; size?: number }
export interface DevKitFilePlan { sourcePath: string; relativePath: string; sha?: string; size?: number; commitSha?: string }
export interface DevKitResult { copied: string[]; skipped: string[] }
export type PlayKit = "devkit" | "tunekit" | "speckit";

const KIT_ROOTS: Record<PlayKit, string[]> = {
  devkit: [".github/", ".vscode/", "agent.md", "infra/", "spec/fai-manifest.json", "plugin.json"],
  tunekit: ["config/", "evaluation/", "cost.json"],
  speckit: ["spec/", "architecture.md"],
};

export function selectDevKitFiles(entries: readonly GitTreeEntry[], playDir: string): DevKitFilePlan[] {
  return selectPlayKitFiles(entries, playDir, "devkit");
}

export function selectPlayKitFiles(entries: readonly GitTreeEntry[], playDir: string, kit: PlayKit): DevKitFilePlan[] {
  const prefix = `solution-plays/${safePlayDir(playDir)}/`;
  const roots = KIT_ROOTS[kit];
  return entries
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string" && entry.path.startsWith(prefix))
    .map((entry) => ({ sourcePath: entry.path!, relativePath: entry.path!.slice(prefix.length), sha: entry.sha, size: entry.size }))
    .filter(({ relativePath }) => roots.some((root) => root.endsWith("/") ? relativePath.startsWith(root) : relativePath === root))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function fetchDevKitPlan(playDir: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<DevKitFilePlan[]> {
  return fetchPlayKitPlan(playDir, "devkit", fetchImpl, signal);
}

export async function fetchPlayKitPlan(playDir: string, kit: PlayKit, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<DevKitFilePlan[]> {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "FrootAI-VSCode" };
  const commitResponse = await fetchImpl(`${GITHUB_REPOSITORY}/commits/main`, { headers, signal });
  if (!commitResponse.ok) throw Object.assign(new Error(`GitHub commit resolution failed with HTTP ${commitResponse.status}.`), { code: "github_commit_failed" });
  const commit = await commitResponse.json() as { sha?: unknown };
  const commitSha = assertGitCommitSha(commit.sha);
  const response = await fetchImpl(`${GITHUB_REPOSITORY}/git/trees/${commitSha}?recursive=1`, { headers, signal });
  if (!response.ok) throw Object.assign(new Error(`GitHub catalog request failed with HTTP ${response.status}.`), { code: "github_tree_failed" });
  const body = await response.json() as { truncated?: boolean; tree?: GitTreeEntry[] };
  if (body.truncated) throw Object.assign(new Error("GitHub returned a truncated Play tree; no partial kit will be installed."), { code: "github_tree_truncated" });
  const files = selectPlayKitFiles(body.tree ?? [], playDir, kit);
  if (!files.length) throw Object.assign(new Error(`No canonical ${kit} files were found for ${playDir}.`), { code: `${kit}_not_found` });
  if (files.length > MAX_DEVKIT_FILES) throw Object.assign(new Error(`Canonical ${kit} contains ${files.length} files, exceeding the ${MAX_DEVKIT_FILES}-file safety limit; no partial kit will be installed.`), { code: "play_kit_file_limit" });
  if (files.some((file) => !file.sha || !/^[a-f0-9]{40}$/i.test(file.sha))) throw Object.assign(new Error(`Canonical ${kit} files are missing immutable Git blob identities.`), { code: "github_blob_identity_missing" });
  if (files.some((file) => typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_PLAY_KIT_FILE_BYTES)) throw Object.assign(new Error(`Canonical ${kit} contains a file with an absent or unsafe declared size.`), { code: "play_kit_file_size" });
  if (files.reduce((total, file) => total + file.size!, 0) > MAX_PLAY_KIT_BYTES) throw Object.assign(new Error(`Canonical ${kit} exceeds the ${MAX_PLAY_KIT_BYTES}-byte safety limit.`), { code: "play_kit_total_size" });
  return files.map((file) => ({ ...file, commitSha }));
}

export async function downloadDevKit(input: { targetRoot: string; plan: readonly DevKitFilePlan[]; fetchImpl?: typeof fetch; signal?: AbortSignal; onProgress?: (completed: number, total: number, file: string) => void }): Promise<DevKitResult> {
  return downloadPlayKit(input);
}

export async function downloadPlayKit(input: { targetRoot: string; plan: readonly DevKitFilePlan[]; fetchImpl?: typeof fetch; signal?: AbortSignal; onProgress?: (completed: number, total: number, file: string) => void }): Promise<DevKitResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const commits = new Set(input.plan.map((file) => file.commitSha));
  if (commits.size !== 1 || !input.plan.length || input.plan.length > MAX_DEVKIT_FILES || !input.plan[0].commitSha || !/^[a-f0-9]{40}$/i.test(input.plan[0].commitSha) || input.plan.some((file) => !file.sha || !/^[a-f0-9]{40}$/i.test(file.sha) || typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_PLAY_KIT_FILE_BYTES) || input.plan.reduce((total, file) => total + (file.size ?? 0), 0) > MAX_PLAY_KIT_BYTES) throw Object.assign(new Error("Play kit plan is not pinned to one bounded immutable commit with verified blob identities."), { code: "untrusted_play_kit_plan" });
  const commitSha = input.plan[0].commitSha;
  const copied: string[] = [];
  const ownedTargets: string[] = [];
  const skipped: string[] = [];
  let completed = 0;
  let downloadedBytes = 0;
  try {
    for (const file of input.plan) {
      assertActive(input.signal);
      const target = await safeTarget(input.targetRoot, file.relativePath, true);
      try {
        await fs.stat(target);
        skipped.push(file.relativePath);
        completed++;
        input.onProgress?.(completed, input.plan.length, file.relativePath);
        continue;
      } catch { /* File does not exist. */ }
      const response = await fetchImpl(`${RAW_BASE}/${commitSha}/${file.sourcePath}`, { headers: { "User-Agent": "FrootAI-VSCode" }, signal: input.signal });
      if (!response.ok) throw Object.assign(new Error(`Download failed for ${file.relativePath} with HTTP ${response.status}.`), { code: "devkit_download_failed" });
      const bytes = await readBoundedBody(response, Math.min(file.size! + 1, MAX_PLAY_KIT_FILE_BYTES), MAX_PLAY_KIT_BYTES - downloadedBytes, file.relativePath);
      if (bytes.byteLength !== file.size) throw Object.assign(new Error(`${file.relativePath} does not match its declared immutable size.`), { code: "play_kit_size_mismatch" });
      assertGitBlob(bytes, file.sha, file.relativePath);
      downloadedBytes += bytes.byteLength;
      assertActive(input.signal);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await assertSafeAncestors(input.targetRoot, target);
      const handle = await fs.open(target, "wx");
      ownedTargets.push(target);
      try { await handle.writeFile(bytes); }
      finally { await handle.close(); }
      copied.push(file.relativePath);
      completed++;
      input.onProgress?.(completed, input.plan.length, file.relativePath);
    }
    return { copied, skipped };
  } catch (error) {
    for (const target of ownedTargets.reverse()) { try { await fs.rm(target, { force: true }); } catch { /* best-effort rollback */ } }
    throw error;
  }
}

async function readBoundedBody(response: Response, perFileLimit: number, remainingTotal: number, label: string): Promise<Uint8Array> {
  if (!response.body) throw Object.assign(new Error(`Download returned no body for ${label}.`), { code: "play_kit_empty_body" });
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > perFileLimit || length > remainingTotal) { await reader.cancel("Play kit byte limit exceeded"); throw Object.assign(new Error(`${label} exceeds the Play kit download safety limit.`), { code: "play_kit_download_limit" }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function fetchArchitecture(playDir: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<{ markdown: string; sourceUrl: string }> {
  const safeDir = safePlayDir(playDir);
  const sourceUrl = `https://github.com/frootai/frootai/blob/main/solution-plays/${safeDir}/architecture.md`;
  const candidates = [
    `${RAW_BASE}/solution-plays/${safeDir}/architecture.md`,
    `https://cdn.jsdelivr.net/gh/frootai/frootai@main/solution-plays/${safeDir}/architecture.md`,
  ];
  const failures: string[] = [];
  for (const candidate of candidates) {
    const response = await fetchImpl(candidate, { headers: { "User-Agent": "FrootAI-VSCode" }, signal });
    if (!response.ok) { failures.push(`${new URL(candidate).host}: HTTP ${response.status}`); continue; }
    const markdown = await response.text();
    if (!markdown.trim()) { failures.push(`${new URL(candidate).host}: empty response`); continue; }
    return { markdown: markdown.slice(0, 250_000), sourceUrl };
  }
  throw Object.assign(new Error(`Canonical architecture could not be refreshed for ${safeDir} (${failures.join("; ")}).`), { code: "architecture_unavailable" });
}

function safePlayDir(value: string): string {
  if (!/^\d{2,3}-[a-z0-9][a-z0-9-]*$/i.test(value)) throw Object.assign(new Error("Invalid Solution Play directory."), { code: "invalid_play_dir" });
  return value;
}

async function safeTarget(root: string, relative: string, requireRoot = false): Promise<string> {
  const normalized = relative.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) throw Object.assign(new Error("Unsafe DevKit path."), { code: "unsafe_devkit_path" });
  const rootPath = path.resolve(root);
  if (requireRoot) await fs.mkdir(rootPath, { recursive: true });
  const target = path.resolve(rootPath, normalized);
  if (!target.startsWith(`${rootPath}${path.sep}`)) throw Object.assign(new Error("Unsafe DevKit target."), { code: "unsafe_devkit_target" });
  await assertSafeAncestors(rootPath, target);
  return target;
}

async function assertSafeAncestors(root: string, target: string): Promise<void> {
  const rootPath = path.resolve(root);
  const rootReal = await fs.realpath(rootPath);
  let current = path.dirname(target);
  const ancestors: string[] = [];
  while (current !== rootPath && current.startsWith(`${rootPath}${path.sep}`)) { ancestors.push(current); current = path.dirname(current); }
  if (current !== rootPath) throw Object.assign(new Error("Unsafe DevKit target."), { code: "unsafe_devkit_target" });
  for (const ancestor of ancestors.reverse()) {
    try {
      const stat = await fs.lstat(ancestor);
      if (stat.isSymbolicLink()) throw Object.assign(new Error(`DevKit path contains a symbolic link or junction: ${path.relative(rootPath, ancestor)}`), { code: "unsafe_devkit_symlink" });
      const real = await fs.realpath(ancestor);
      if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) throw Object.assign(new Error("DevKit path escapes the selected workspace."), { code: "unsafe_devkit_target" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw Object.assign(new Error("DevKit download cancelled."), { code: "cancelled" });
}
