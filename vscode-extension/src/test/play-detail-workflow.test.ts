import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { downloadDevKit, fetchArchitecture, fetchDevKitPlan, selectDevKitFiles, selectPlayKitFiles } from "../play-detail/workflow";
import { gitBlobSha } from "../accelerator-assets";

async function main(): Promise<void> {
  const entries = [
    { path: "solution-plays/01-enterprise-rag/.github/agents/builder.agent.md", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/.github/skills/deploy/SKILL.md", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/.github/hooks/guardrails.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/.github/prompts/deploy.prompt.md", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/.vscode/mcp.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/agent.md", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/infra/main.bicep", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/spec/fai-manifest.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/plugin.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/config/openai.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/evaluation/eval.py", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/cost.json", type: "blob" },
    { path: "solution-plays/01-enterprise-rag/architecture.md", type: "blob" },
    { path: "solution-plays/02-ai-landing-zone/agent.md", type: "blob" },
  ];
  const selected = selectDevKitFiles(entries, "01-enterprise-rag");
  assert.deepEqual(selected.map((file) => file.relativePath), [
    ".github/agents/builder.agent.md",
    ".github/hooks/guardrails.json",
    ".github/prompts/deploy.prompt.md",
    ".github/skills/deploy/SKILL.md",
    ".vscode/mcp.json",
    "agent.md",
    "infra/main.bicep",
    "plugin.json",
    "spec/fai-manifest.json",
  ]);
  assert.deepEqual(selectPlayKitFiles(entries, "01-enterprise-rag", "tunekit").map((file) => file.relativePath), ["config/openai.json", "cost.json", "evaluation/eval.py"]);
  assert.deepEqual(selectPlayKitFiles(entries, "01-enterprise-rag", "speckit").map((file) => file.relativePath), ["architecture.md", "spec/fai-manifest.json"]);

  const commitSha = "1".repeat(40);
  const contentFor = (sourcePath: string) => `content:${sourcePath}`;
  const immutableEntries = entries.map((entry) => entry.type === "blob" && entry.path ? { ...entry, sha: gitBlobSha(Buffer.from(contentFor(entry.path))), size: Buffer.byteLength(contentFor(entry.path)) } : entry);
  const pinned = (sourcePath: string, relativePath: string) => ({ sourcePath, relativePath, commitSha, sha: gitBlobSha(Buffer.from(contentFor(sourcePath))), size: Buffer.byteLength(contentFor(sourcePath)) });
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("commits/main")) return new Response(JSON.stringify({ sha: commitSha }), { status: 200 });
    if (url.includes("git/trees")) return new Response(JSON.stringify({ tree: immutableEntries, truncated: false }), { status: 200 });
    if (url.endsWith("architecture.md")) return new Response("# Enterprise RAG\n\n```mermaid\ngraph LR\nA-->B\n```", { status: 200 });
    return new Response(contentFor(url.split(`/${commitSha}/`)[1]), { status: 200 });
  };
  const plan = await fetchDevKitPlan("01-enterprise-rag", fetchImpl as typeof fetch);
  assert.equal(plan.length, 9);
  assert.ok(plan.every((file) => file.commitSha === commitSha && file.sha));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "frootai-devkit-"));
  try {
    await fs.mkdir(path.join(root, ".vscode"), { recursive: true });
    await fs.writeFile(path.join(root, ".vscode", "mcp.json"), "existing");
    const result = await downloadDevKit({ targetRoot: root, plan, fetchImpl: fetchImpl as typeof fetch });
    assert.equal(result.copied.length, 8);
    assert.deepEqual(result.skipped, [".vscode/mcp.json"]);
    assert.match(await fs.readFile(path.join(root, ".github", "agents", "builder.agent.md"), "utf8"), /builder\.agent\.md/);
    assert.equal(await fs.readFile(path.join(root, ".vscode", "mcp.json"), "utf8"), "existing");
    const rollbackRoot = path.join(root, "rollback");
    await fs.mkdir(rollbackRoot);
    let requests = 0;
    const one = "solution-plays/01-enterprise-rag/.github/one.md", two = "solution-plays/01-enterprise-rag/.github/two.md";
    await assert.rejects(() => downloadDevKit({ targetRoot: rollbackRoot, plan: [pinned(one, ".github/one.md"), pinned(two, ".github/two.md")], fetchImpl: (async () => { requests += 1; return requests === 1 ? new Response(contentFor(one), { status: 200 }) : new Response("failed", { status: 503 }); }) as typeof fetch }), /Download failed/);
    await assert.rejects(() => fs.stat(path.join(rollbackRoot, ".github", "one.md")), /ENOENT/);
    await assert.rejects(() => downloadDevKit({ targetRoot: rollbackRoot, plan: [pinned(one, ".github/one.md")], fetchImpl: (async () => new Response(`X${contentFor(one).slice(1)}`, { status: 200 })) as typeof fetch }), /immutable Git blob verification/);
    await assert.rejects(() => downloadDevKit({ targetRoot: rollbackRoot, plan: Array.from({ length: 401 }, (_, index) => pinned(`solution-plays/01-enterprise-rag/.github/${index}.md`, `.github/${index}.md`)), fetchImpl: fetchImpl as typeof fetch }), /bounded immutable commit/);

    const outside = path.join(root, "outside");
    const linkedRoot = path.join(root, "linked-root");
    await fs.mkdir(outside); await fs.mkdir(linkedRoot);
    try {
      await fs.symlink(outside, path.join(linkedRoot, ".github"), process.platform === "win32" ? "junction" : "dir");
      const escape = "solution-plays/01-enterprise-rag/.github/escape.md";
      await assert.rejects(() => downloadDevKit({ targetRoot: linkedRoot, plan: [pinned(escape, ".github/escape.md")], fetchImpl: fetchImpl as typeof fetch }), /symbolic link|junction|escapes/);
      await assert.rejects(() => fs.stat(path.join(outside, "escape.md")), /ENOENT/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
  const architecture = await fetchArchitecture("01-enterprise-rag", fetchImpl as typeof fetch);
  assert.match(architecture.markdown, /graph LR/);
  assert.match(architecture.sourceUrl, /01-enterprise-rag\/architecture\.md$/);
  const fallbackArchitecture = await fetchArchitecture("01-enterprise-rag", (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("raw.githubusercontent.com")) return new Response("unavailable", { status: 503 });
    return new Response("# CDN architecture\n\nDeclared flow", { status: 200 });
  }) as typeof fetch);
  assert.match(fallbackArchitecture.markdown, /CDN architecture/);
  assert.throws(() => selectDevKitFiles(entries, "../unsafe"), /Invalid Solution Play directory/);
  console.log("Play Detail architecture and DevKit workflow tests passed");
}

void main();
