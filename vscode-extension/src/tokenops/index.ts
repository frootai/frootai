import * as crypto from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import type { GithubCopilotUsage, TokenOpsEstimate, TokenRange, ToolScenario, UsageObservation } from "./domain";
import { normalizeRange, zeroRange } from "./domain";
import { buildToolProfiles, normalizeReceiptCollection, reconcile, summarizeFinOps } from "./evidence";
import { countText, disposeTokenizers, estimateUsage, normalizeToolDefinitions } from "./estimator";
import { fetchCopilotMetrics, unavailableCopilotUsage } from "./github";
import { buildModelRegistry, findModel } from "./model-registry";

const VIEW_ID = "frootai.tokenOps";
const OBSERVATIONS_KEY = "frootai.tokenOps.observations.v1";
const ESTIMATES_KEY = "frootai.tokenOps.estimates.v1";
const GITHUB_KEY = "frootai.tokenOps.github.v1";
const MAX_OBSERVATIONS = 5_000;
const MAX_ESTIMATES = 500;
const MAX_IMPORT_FILES = 10;
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_PERSISTED_BYTES = 8 * 1024 * 1024;
let provider: TokenOpsProvider | undefined;

interface McpInventory {
  servers: Array<{ name: string; source: string }>;
  configurationBytes: number;
  configurationCharacters: number;
  configurationTokens: Record<"o200k_base" | "cl100k_base", number>;
  tools: Array<{ name: string; description: string; inputSchema: unknown; tags: string[] }>;
}

interface DashboardState {
  workspace: string;
  repository: string;
  models: ReturnType<typeof buildModelRegistry>;
  selectedModelId: string;
  mcp: {
    servers: McpInventory["servers"];
    configurationBytes: number;
    registeredTools: Array<{ name: string; description: string; tags: string[]; tokens: TokenRange }>;
  };
  toolProfiles: ReturnType<typeof buildToolProfiles>;
  observations: UsageObservation[];
  lastEstimate: TokenOpsEstimate | null;
  reconciliation: ReturnType<typeof reconcile> | null;
  finops: ReturnType<typeof summarizeFinOps>;
  github: GithubCopilotUsage;
  privacy: string;
}

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("frootai.tokenOps");
}

function safeJsonc(text: string): any {
  let result = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    if (lineComment) { if (current === "\n") { lineComment = false; result += current; } continue; }
    if (blockComment) { if (current === "*" && next === "/") { blockComment = false; index++; } else if (current === "\n") result += current; continue; }
    if (inString) { result += current; if (escaped) escaped = false; else if (current === "\\") escaped = true; else if (current === '"') inString = false; continue; }
    if (current === '"') { inString = true; result += current; }
    else if (current === "/" && next === "/") { lineComment = true; index++; }
    else if (current === "/" && next === "*") { blockComment = true; index++; }
    else result += current;
  }
  return JSON.parse(result.replace(/,\s*([}\]])/g, "$1"));
}

async function inspectMcp(): Promise<McpInventory> {
  const inventory: McpInventory = { servers: [], configurationBytes: 0, configurationCharacters: 0, configurationTokens: { o200k_base: 0, cl100k_base: 0 }, tools: [] };
  const builtIns = buildModelRegistry([]);
  const o200k = findModel(builtIns, "openai:gpt-5");
  const cl100k = findModel(builtIns, "openai:gpt-4");
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (workspace) {
    for (const uri of [vscode.Uri.joinPath(workspace.uri, ".vscode", "mcp.json"), vscode.Uri.joinPath(workspace.uri, ".mcp.json")]) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(bytes);
        const parsed = safeJsonc(text);
        const servers = parsed?.servers && typeof parsed.servers === "object" ? Object.keys(parsed.servers) : [];
        inventory.servers.push(...servers.map((name) => ({ name, source: vscode.workspace.asRelativePath(uri) })));
        inventory.configurationBytes += bytes.byteLength;
        inventory.configurationCharacters += [...text].length;
        inventory.configurationTokens.o200k_base += countText(text, o200k).base;
        inventory.configurationTokens.cl100k_base += countText(text, cl100k).base;
      } catch { /* Optional configuration file. */ }
    }
  }
  const tools = Array.isArray(vscode.lm?.tools) ? vscode.lm.tools : [];
  inventory.tools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.inputSchema || {},
    tags: [...tool.tags || []],
  }));
  return inventory;
}

function emptyGithub(): GithubCopilotUsage {
  return { status: "not-configured", organization: null, days: [], asOf: null, source: "GitHub Copilot metrics", detail: "Configure an organization and connect GitHub to collect aggregate engagement.", evidenceGrade: "unavailable" };
}

function readArray<T>(context: vscode.ExtensionContext, key: string): T[] {
  const value = context.globalState.get<unknown>(key);
  return Array.isArray(value) ? value as T[] : [];
}

function scopedKey(base: string): string {
  const scope = `${vscode.workspace.workspaceFolders?.[0]?.uri.toString() || "no-workspace"}|${repositoryName()}`;
  return `${base}.${crypto.createHash("sha256").update(scope).digest("hex").slice(0, 16)}`;
}

function mcpConfigurationRange(inventory: McpInventory, model: ReturnType<typeof findModel>): TokenRange {
  if (model.encoding) return { low: inventory.configurationTokens[model.encoding], base: inventory.configurationTokens[model.encoding], high: inventory.configurationTokens[model.encoding] };
  return normalizeRange({ low: Math.ceil(inventory.configurationCharacters / 5), base: Math.ceil(inventory.configurationCharacters / 4), high: Math.ceil(inventory.configurationCharacters / 3) });
}

function repositoryName(): string {
  return config().get<string>("repository", "") || vscode.workspace.workspaceFolders?.[0]?.name || "unassigned";
}

async function runTokenOpsAction(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`FAI TokenOps ${label}: ${detail}`);
  }
}

export function activateTokenOps(context: vscode.ExtensionContext): void {
  provider = new TokenOpsProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("frootai.tokenOps.openDashboard", () => provider?.openDashboard()),
    vscode.commands.registerCommand("frootai.tokenOps.refresh", () => provider?.refresh()),
    vscode.commands.registerCommand("frootai.tokenOps.connectGitHub", () => provider && runTokenOpsAction("GitHub connection failed", () => provider!.connectGithub())),
    vscode.commands.registerCommand("frootai.tokenOps.importReceipt", () => provider && runTokenOpsAction("receipt import failed", () => provider!.importReceipt())),
    vscode.commands.registerCommand("frootai.tokenOps.exportData", () => provider && runTokenOpsAction("data export failed", () => provider!.exportData())),
    vscode.commands.registerCommand("frootai.tokenOps.clearData", () => provider && runTokenOpsAction("data reset failed", () => provider!.clearData())),
    vscode.commands.registerCommand("frootai.tokenOps.saveReceiptTemplate", () => provider && runTokenOpsAction("template creation failed", () => provider!.saveReceiptTemplate())),
    vscode.workspace.onDidChangeConfiguration((event) => { if (event.affectsConfiguration("frootai.tokenOps")) void provider?.refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void provider?.refresh()),
  );
}

export function deactivateTokenOps(): void {
  disposeTokenizers();
  provider = undefined;
}

/** Integration seam for FrootAI-owned gateways/MCP servers. Stores metrics only, never prompt or tool payload content. */
export async function recordTokenOpsObservation(raw: unknown): Promise<UsageObservation[]> {
  if (!provider) throw new Error("TokenOps is not active.");
  return provider.recordObservations(normalizeReceiptCollection(raw, repositoryName(), repositoryName()));
}

class TokenOpsProvider implements vscode.WebviewViewProvider {
  private readonly webviews = new Set<vscode.Webview>();
  private lastState: DashboardState | null = null;
  private lastMcp: McpInventory = { servers: [], configurationBytes: 0, configurationCharacters: 0, configurationTokens: { o200k_base: 0, cl100k_base: 0 }, tools: [] };
  private lastBudgetAlert = "";

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    this.attach(view.webview, false);
  }

  private attach(webview: vscode.Webview, full: boolean): void {
    this.webviews.add(webview);
    webview.html = dashboardHtml(webview, full);
    webview.onDidReceiveMessage((message) => this.handleMessage(webview, message), undefined, this.context.subscriptions);
    void this.refresh();
  }

  private broadcast(message: unknown): void {
    for (const webview of this.webviews) void webview.postMessage(message);
  }

  async refresh(): Promise<void> {
    const models = buildModelRegistry(config().get("modelCatalogOverrides", []));
    const selectedModelId = config().get<string>("defaultModel", models[0]?.id || "openai:gpt-5");
    const model = findModel(models, selectedModelId);
    this.lastMcp = await inspectMcp();
    const observations = readArray<UsageObservation>(this.context, scopedKey(OBSERVATIONS_KEY));
    const estimates = readArray<TokenOpsEstimate>(this.context, scopedKey(ESTIMATES_KEY));
    const github = this.context.globalState.get<GithubCopilotUsage>(scopedKey(GITHUB_KEY)) || emptyGithub();
    const tools = normalizeToolDefinitions(this.lastMcp.tools, model);
    const budgetValue = config().get<number | null>("monthlyBudgetUsd", null);
    const budget = Number.isFinite(budgetValue) && Number(budgetValue) >= 0 ? Number(budgetValue) : null;
    const lastEstimate = estimates[0] || null;
    const correlated = lastEstimate ? observations.find((item) => item.correlationId === lastEstimate.id) : undefined;
    const finops = summarizeFinOps(observations, budget);
    this.lastState = {
      workspace: vscode.workspace.workspaceFolders?.[0]?.name || "No workspace",
      repository: repositoryName(),
      models,
      selectedModelId: model.id,
      mcp: {
        servers: this.lastMcp.servers,
        configurationBytes: this.lastMcp.configurationBytes,
        registeredTools: tools.map((tool) => ({ name: tool.name, description: tool.description, tags: tool.tags, tokens: tool.definitionTokens })),
      },
      toolProfiles: buildToolProfiles(observations, repositoryName(), model.id),
      observations: observations.slice(0, 100),
      lastEstimate,
      reconciliation: lastEstimate && correlated ? reconcile(lastEstimate, correlated) : null,
      finops,
      github,
      privacy: "Local evidence metadata, source labels and digests are persisted per workspace/repository. Prompt text, source code, tool arguments and tool result payloads are not persisted.",
    };
    this.broadcast({ type: "state", state: this.lastState });
    this.maybeAlert(finops.budgetConsumedPercent, finops.month);
  }

  private maybeAlert(consumed: number | null, month: string): void {
    const threshold = Math.min(100, Math.max(1, config().get<number>("budgetAlertPercent", 80)));
    const key = consumed != null && consumed >= threshold ? `${month}:${threshold}` : "";
    if (key && key !== this.lastBudgetAlert) {
      this.lastBudgetAlert = key;
      void vscode.window.showWarningMessage(`FAI TokenOps: ${consumed!.toFixed(1)}% of the monthly observed-cost budget is consumed.`);
    }
  }

  openDashboard(): void {
    const panel = vscode.window.createWebviewPanel("frootai.tokenOps.dashboard", "FAI TokenOps Dashboard", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    this.attach(panel.webview, true);
    panel.onDidDispose(() => this.webviews.delete(panel.webview));
  }

  async connectGithub(): Promise<void> {
    const organization = config().get<string>("githubOrganization", "").trim();
    if (!organization) {
      void vscode.window.showWarningMessage("Set frootai.tokenOps.githubOrganization before connecting GitHub usage.");
      return;
    }
    try {
      const session = await vscode.authentication.getSession("github", ["read:org"], { createIfNone: true });
      const usage = await fetchCopilotMetrics(organization, session.accessToken);
      await this.context.globalState.update(scopedKey(GITHUB_KEY), usage);
    } catch (error) {
      await this.context.globalState.update(scopedKey(GITHUB_KEY), unavailableCopilotUsage(organization, error));
    }
    await this.refresh();
  }

  async importReceipt(): Promise<void> {
    const files = await vscode.window.showOpenDialog({ canSelectMany: true, filters: { "TokenOps usage receipt": ["json", "jsonl"] }, title: "Import provider or MCP usage receipts" });
    if (!files?.length) return;
    if (files.length > MAX_IMPORT_FILES) throw new Error(`Select at most ${MAX_IMPORT_FILES} receipt files per import.`);
    const imported: UsageObservation[] = [];
    let totalBytes = 0;
    for (const uri of files) {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > MAX_IMPORT_FILE_BYTES) throw new Error(`${path.basename(uri.fsPath)} exceeds the 5 MB receipt limit.`);
      totalBytes += stat.size;
      if (totalBytes > MAX_IMPORT_TOTAL_BYTES) throw new Error("Receipt import exceeds the 20 MB aggregate limit.");
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      const values = uri.path.endsWith(".jsonl") ? text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : JSON.parse(text);
      const normalized = normalizeReceiptCollection(values, repositoryName(), repositoryName());
      if (imported.length + normalized.length > MAX_OBSERVATIONS) throw new Error(`Receipt import exceeds the ${MAX_OBSERVATIONS.toLocaleString()} record limit.`);
      imported.push(...normalized);
    }
    await this.recordObservations(imported);
    void vscode.window.showInformationMessage(`FAI TokenOps imported ${imported.length} evidence-grade usage observation(s).`);
  }

  async exportData(): Promise<void> {
    const repository = repositoryName();
    const filename = `fai-tokenops-${repository.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    const destination = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(filename),
      filters: { "TokenOps local export": ["json"] },
      title: "Export local TokenOps data",
    });
    if (!destination) return;
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: { workspace: vscode.workspace.workspaceFolders?.[0]?.name || null, repository },
      privacy: "Contains TokenOps metrics and evidence metadata only. Prompt text, source code, tool arguments, and tool result payloads are not stored or exported.",
      observations: readArray<UsageObservation>(this.context, scopedKey(OBSERVATIONS_KEY)),
      estimates: readArray<TokenOpsEstimate>(this.context, scopedKey(ESTIMATES_KEY)),
      github: this.context.globalState.get<GithubCopilotUsage>(scopedKey(GITHUB_KEY)) || emptyGithub(),
    };
    await vscode.workspace.fs.writeFile(destination, new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`));
    void vscode.window.showInformationMessage(`FAI TokenOps exported local data to ${path.basename(destination.fsPath)}.`);
  }

  async clearData(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      `Clear all TokenOps observations, estimates, and cached GitHub usage for “${repositoryName()}”? This cannot be undone.`,
      { modal: true },
      "Clear local data",
    );
    if (choice !== "Clear local data") return;
    await Promise.all([
      this.context.globalState.update(scopedKey(OBSERVATIONS_KEY), undefined),
      this.context.globalState.update(scopedKey(ESTIMATES_KEY), undefined),
      this.context.globalState.update(scopedKey(GITHUB_KEY), undefined),
    ]);
    this.lastBudgetAlert = "";
    await this.refresh();
    void vscode.window.showInformationMessage("FAI TokenOps cleared local data for the current workspace/repository scope.");
  }

  async saveReceiptTemplate(): Promise<void> {
    const destination = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file("fai-tokenops-receipt-template.json"),
      filters: { "TokenOps usage receipt": ["json"] },
      title: "Save TokenOps receipt template",
    });
    if (!destination) return;
    const template = {
      provider: "openai",
      observedAt: "REPLACE_WITH_ISO_8601_TIMESTAMP",
      modelId: "REPLACE_WITH_PROVIDER_MODEL_ID",
      inputTokens: "REPLACE_WITH_NONNEGATIVE_INTEGER",
      outputTokens: "REPLACE_WITH_NONNEGATIVE_INTEGER",
      costUsd: "REPLACE_WITH_OBSERVED_COST_OR_REMOVE_FIELD",
      correlationId: "OPTIONAL_MATCHING_ESTIMATE_ID",
      source: "REPLACE_WITH_PROVIDER_OR_GATEWAY_RECEIPT_SOURCE",
      toolCalls: [],
    };
    await vscode.workspace.fs.writeFile(destination, new TextEncoder().encode(`${JSON.stringify(template, null, 2)}\n`));
    void vscode.window.showInformationMessage("FAI TokenOps saved an intentionally invalid template. Replace every placeholder with actual receipt evidence before importing it.");
  }

  async recordObservations(incoming: UsageObservation[]): Promise<UsageObservation[]> {
    const key = scopedKey(OBSERVATIONS_KEY);
    const existing = readArray<UsageObservation>(this.context, key);
    const byDigest = new Map(existing.map((item) => [item.sourceDigest, item]));
    for (const item of incoming) if (!byDigest.has(item.sourceDigest)) byDigest.set(item.sourceDigest, item);
    const next = [...byDigest.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, MAX_OBSERVATIONS);
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > MAX_PERSISTED_BYTES) throw new Error("TokenOps evidence store exceeds the 8 MB safety limit; import a smaller receipt set.");
    await this.context.globalState.update(key, next);
    await this.refresh();
    return incoming;
  }

  private async handleMessage(webview: vscode.Webview, message: any): Promise<void> {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "ready" || message.type === "refresh") return this.refresh();
    if (message.type === "openDashboard") return this.openDashboard();
    if (message.type === "connectGithub") return runTokenOpsAction("GitHub connection failed", () => this.connectGithub());
    if (message.type === "importReceipt") return runTokenOpsAction("receipt import failed", () => this.importReceipt());
    if (message.type === "saveReceiptTemplate") return runTokenOpsAction("template creation failed", () => this.saveReceiptTemplate());
    if (message.type === "exportData") return runTokenOpsAction("data export failed", () => this.exportData());
    if (message.type === "clearData") return runTokenOpsAction("data reset failed", () => this.clearData());
    if (message.type === "openSettings") return void vscode.commands.executeCommand("workbench.action.openSettings", "frootai.tokenOps");
    if (message.type === "useSelection") {
      const editor = vscode.window.activeTextEditor;
      const text = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : "";
      return void webview.postMessage({ type: "composerText", text });
    }
    if (message.type === "useClipboard") return void webview.postMessage({ type: "composerText", text: await vscode.env.clipboard.readText() });
    if (message.type === "estimate") return this.handleEstimate(webview, message);
  }

  private async handleEstimate(webview: vscode.Webview, message: any): Promise<void> {
    const models = buildModelRegistry(config().get("modelCatalogOverrides", []));
    const model = findModel(models, String(message.modelId || ""));
    const definitions = normalizeToolDefinitions(this.lastMcp.tools, model);
    const observations = readArray<UsageObservation>(this.context, scopedKey(OBSERVATIONS_KEY));
    const scenario: ToolScenario = ["none", "likely", "manual", "all"].includes(message.scenario) ? message.scenario : "none";
    const mcpConfiguration = message.includeMcpConfiguration ? mcpConfigurationRange(this.lastMcp, model) : zeroRange();
    const estimate = estimateUsage({
      text: String(message.text || "").slice(0, 2_000_000),
      modelId: model.id,
      scenario,
      selectedTools: Array.isArray(message.selectedTools) ? message.selectedTools.map(String) : [],
      outputTokens: normalizeRange({ low: message.outputLow, base: message.outputBase, high: message.outputHigh }),
      mcpConfigurationTokens: mcpConfiguration,
      fallbackInputRate: message.inputRate,
      fallbackOutputRate: message.outputRate,
    }, model, definitions, buildToolProfiles(observations, repositoryName(), model.id));
    const estimatesKey = scopedKey(ESTIMATES_KEY);
    const estimates = readArray<TokenOpsEstimate>(this.context, estimatesKey);
    const nextEstimates = [estimate, ...estimates].slice(0, MAX_ESTIMATES);
    while (nextEstimates.length && Buffer.byteLength(JSON.stringify(nextEstimates), "utf8") > MAX_PERSISTED_BYTES) nextEstimates.pop();
    if (!nextEstimates.length) throw new Error("This estimate exceeds the 8 MB TokenOps storage safety limit.");
    await this.context.globalState.update(estimatesKey, nextEstimates);
    await webview.postMessage({ type: "estimate", estimate });
    await this.refresh();
  }
}

function dashboardHtml(webview: vscode.Webview, full: boolean): string {
  const nonce = crypto.randomBytes(18).toString("base64");
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">
:root{--panel:var(--vscode-editorWidget-background);--line:var(--vscode-widget-border);--muted:var(--vscode-descriptionForeground);--accent:#a9e34b;--cyan:#43c6d5;--coral:#f0775e}*{box-sizing:border-box}body{margin:0;color:var(--vscode-foreground);background:var(--vscode-sideBar-background);font:12px var(--vscode-font-family)}.shell{max-width:${full ? "1240px" : "100%"};margin:auto;padding:${full ? "22px" : "8px"}}header,.actions,.tabs,.range{display:flex;gap:7px;align-items:center;flex-wrap:wrap}header{justify-content:space-between}h1{font-size:${full ? "23px" : "16px"};margin:0}.sub,.detail{color:var(--muted);line-height:1.4}.tabs{border-bottom:1px solid var(--line);margin:14px 0 10px}.tab{border:0;background:transparent;color:var(--muted);padding:8px}.tab.active{color:var(--vscode-foreground);border-bottom:2px solid var(--accent)}.page{display:none}.page.active{display:block}.grid{display:grid;grid-template-columns:repeat(${full ? "4" : "2"},minmax(0,1fr));gap:8px}.card{background:var(--panel);border:1px solid var(--line);padding:10px;min-width:0}.accent{border-top:3px solid var(--accent)}.cyan{border-top:3px solid var(--cyan)}.coral{border-top:3px solid var(--coral)}.label{font-size:10px;text-transform:uppercase;color:var(--muted)}.value{font-size:${full ? "21px" : "16px"};font-weight:700;margin:6px 0;overflow-wrap:anywhere}.section{margin-top:12px}.composer{width:100%;min-height:${full ? "120px" : "80px"};resize:vertical}.controls{display:grid;grid-template-columns:repeat(${full ? "4" : "2"},minmax(0,1fr));gap:8px;margin:10px 0}.field label{display:block;color:var(--muted);margin-bottom:4px}.field input,.field select,textarea{width:100%;padding:6px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border)}button{padding:6px 9px;color:var(--vscode-foreground);background:var(--vscode-button-secondaryBackground);border:0;cursor:pointer}.primary{color:var(--vscode-button-foreground);background:var(--vscode-button-background)}.notice{padding:9px;border-left:3px solid var(--coral);background:var(--panel);color:var(--muted)}.tools{max-height:290px;overflow:auto}.tool{display:grid;grid-template-columns:24px 1fr auto;gap:5px;padding:6px;border-bottom:1px solid var(--line)}.badge{display:inline-block;padding:2px 5px;margin:2px;border:1px solid var(--line)}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px;border-bottom:1px solid var(--line)}@media(max-width:700px){.grid,.controls{grid-template-columns:1fr}}
</style></head><body><div class="shell"><header><div><h1>FAI TokenOps</h1><div class="sub">Evidence-first AI cost intelligence</div></div><div class="actions">${full ? "" : '<button id="openFull">Open dashboard</button>'}<button id="refresh">Refresh</button></div></header>
<div class="tabs"><button class="tab active" data-page="preview">Preview</button><button class="tab" data-page="models">Models</button><button class="tab" data-page="tools">Tools</button><button class="tab" data-page="actual">Reconcile</button><button class="tab" data-page="finops">FinOps</button><button class="tab" data-page="access">Access</button></div>
<section id="preview" class="page active"><textarea id="prompt" class="composer" placeholder="Paste or type visible prompt text. Native Copilot draft and hidden context are not exposed."></textarea><div class="actions section"><button id="useSelection">Use selection</button><button id="useClipboard">Use clipboard</button><button id="estimate" class="primary">Estimate scenario</button></div><div class="controls"><div class="field"><label>Model / deployment</label><select id="model"></select></div><div class="field"><label>Tool scenario</label><select id="scenario"><option value="none">None</option><option value="likely">Likely (metadata + history)</option><option value="manual">Manual selection</option><option value="all">All registered tools</option></select></div><div class="field"><label>Output low / base / high</label><div class="range"><input id="outLow" type="number" value="150" min="0"><input id="outBase" type="number" value="500" min="0"><input id="outHigh" type="number" value="1500" min="0"></div></div><div class="field"><label>Fallback input / output $ per 1M</label><div class="range"><input id="inputRate" type="number" value="" min="0" placeholder="unpriced"><input id="outputRate" type="number" value="" min="0" placeholder="unpriced"></div></div></div><label><input id="includeMcp" type="checkbox"> Include visible MCP configuration</label><div id="previewCards" class="grid section"></div><div id="selectedTools" class="section"></div><div class="notice section">Low/base/high are planning scenarios. Hidden Copilot prompts, retrieval, reasoning, truncation and private orchestration remain unavailable.</div></section>
<section id="models" class="page"><div id="modelCards" class="grid"></div><div class="notice section">Encoding, model, context limit, provider and price are independent fields. Built-in prices are intentionally unset; configure sourced, dated overrides in settings.</div><div id="modelTable" class="section"></div></section>
<section id="tools" class="page"><div id="toolCards" class="grid"></div><div class="section card tools" id="toolList"></div><div class="notice section">“Likely” is an explainable scenario—not an assertion about Copilot routing. Historical probabilities appear only after observed receipts exist.</div></section>
<section id="actual" class="page"><div id="actualCards" class="grid"></div><div class="actions section"><button id="importReceipt" class="primary">Import provider/MCP receipts</button><button id="saveReceiptTemplate">Save receipt template</button></div><div id="reconciliation" class="section card"></div><div class="notice section">Actual evidence is accepted only from provider, gateway, or instrumented MCP receipts. The template is intentionally invalid until every placeholder is replaced with real evidence. Estimates never become actual merely because a request was sent.</div></section>
<section id="finops" class="page"><div id="finopsCards" class="grid"></div><div id="chargeback" class="section card"></div><div id="recommendations" class="section card"></div><div class="notice section">Forecasts use observed month-to-date cost only. Recommendations never claim savings without observed or sourced cost evidence.</div></section>
<section id="access" class="page"><div id="accessCards" class="grid"></div><div class="actions section"><button id="connectGithub">Connect GitHub usage</button><button id="openSettings">Open TokenOps settings</button><button id="exportData">Export local data</button><button id="clearData">Clear local data</button></div><div class="notice section">GitHub supplies aggregate Copilot engagement where the organization endpoint permits it; it does not reveal prompts, token totals, tool routing, or hidden Copilot context. Export and clear apply only to the current workspace/repository scope.</div></section>
</div><script nonce="${nonce}">const vscode=acquireVsCodeApi();let state=null,lastEstimate=null;const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmt=n=>n==null?'Unavailable':Number(n).toLocaleString(undefined,{maximumFractionDigits:4});const range=r=>r?fmt(r.low)+' / '+fmt(r.base)+' / '+fmt(r.high):'Unavailable';const card=(l,v,d,k='')=>'<div class="card '+k+'"><div class="label">'+esc(l)+'</div><div class="value">'+esc(v)+'</div><div class="detail">'+esc(d)+'</div></div>';
$('saveReceiptTemplate').onclick=()=>vscode.postMessage({type:'saveReceiptTemplate'});$('exportData').onclick=()=>vscode.postMessage({type:'exportData'});$('clearData').onclick=()=>vscode.postMessage({type:'clearData'});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.page).classList.add('active')});$('openFull')?.addEventListener('click',()=>vscode.postMessage({type:'openDashboard'}));$('refresh').onclick=()=>vscode.postMessage({type:'refresh'});$('useSelection').onclick=()=>vscode.postMessage({type:'useSelection'});$('useClipboard').onclick=()=>vscode.postMessage({type:'useClipboard'});$('connectGithub').onclick=()=>vscode.postMessage({type:'connectGithub'});$('importReceipt').onclick=()=>vscode.postMessage({type:'importReceipt'});$('openSettings').onclick=()=>vscode.postMessage({type:'openSettings'});$('estimate').onclick=()=>vscode.postMessage({type:'estimate',text:$('prompt').value,modelId:$('model').value,scenario:$('scenario').value,selectedTools:[...document.querySelectorAll('.toolCheck:checked')].map(x=>x.value),outputLow:$('outLow').value,outputBase:$('outBase').value,outputHigh:$('outHigh').value,inputRate:$('inputRate').value===''?undefined:$('inputRate').value,outputRate:$('outputRate').value===''?undefined:$('outputRate').value,includeMcpConfiguration:$('includeMcp').checked});window.addEventListener('message',e=>{const m=e.data;if(m.type==='state'){state=m.state;render()}if(m.type==='composerText')$('prompt').value=m.text;if(m.type==='estimate'){lastEstimate=m.estimate;renderEstimate(m.estimate)}});function render(){const s=state,m=s.mcp,f=s.finops,g=s.github;const current=$('model').value;$('model').innerHTML=s.models.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.displayName)+'</option>').join('');$('model').value=current&&s.models.some(x=>x.id===current)?current:s.selectedModelId;$('toolList').innerHTML=m.registeredTools.length?m.registeredTools.map(t=>'<label class="tool"><input class="toolCheck" type="checkbox" value="'+esc(t.name)+'"><span><b>'+esc(t.name)+'</b><div class="detail">'+esc(t.description||'No description')+'</div></span><span>'+esc(range(t.tokens))+'</span></label>').join(''):'<div class="detail">No registered tools exposed by this VS Code host.</div>';$('toolCards').innerHTML=card('Registered tools',m.registeredTools.length,'Observed definitions','cyan')+card('MCP servers',m.servers.length,'Visible configuration')+card('Config bytes',fmt(m.configurationBytes),'Observed bytes')+card('Historical profiles',s.toolProfiles.length,'Calculated from receipts','accent');$('modelCards').innerHTML=card('Catalog entries',s.models.length,'Built-in + administrator overrides','cyan')+card('Exact encodings',s.models.filter(x=>x.tokenMethod==='exact-tiktoken').length,'js-tiktoken')+card('Provider estimates',s.models.filter(x=>x.tokenMethod==='provider-estimate').length,'Explicit token ranges','coral')+card('Priced entries',s.models.filter(x=>x.price.inputPerMillion!=null&&x.price.outputPerMillion!=null).length,'Source + as-of required','accent');$('modelTable').innerHTML='<table><tr><th>Provider / model</th><th>Encoding</th><th>Context</th><th>Input / output $1M</th></tr>'+s.models.map(x=>'<tr><td>'+esc(x.provider+' · '+x.displayName)+'</td><td>'+esc(x.encoding||'provider estimate')+'</td><td>'+esc(fmt(x.contextWindow))+'</td><td>'+esc(x.price.inputPerMillion==null?'Unpriced':fmt(x.price.inputPerMillion)+' / '+fmt(x.price.outputPerMillion))+'</td></tr>').join('')+'</table>';$('actualCards').innerHTML=card('Observations',s.observations.length,'Immutable source digest','cyan')+card('Last estimate',s.lastEstimate?s.lastEstimate.id.slice(0,12):'None','Estimated evidence')+card('Correlated receipt',s.reconciliation?s.reconciliation.observationId.slice(0,12):'Unavailable','Requires matching correlationId',s.reconciliation?'accent':'coral')+card('Unpriced actuals',f.unpricedObservations,'Never assigned fabricated cost');$('reconciliation').innerHTML=s.reconciliation?'<b>Calculated reconciliation</b><div class="detail">Input delta '+fmt(s.reconciliation.inputDelta)+' · output delta '+fmt(s.reconciliation.outputDelta)+' · correct tools '+esc(s.reconciliation.correctTools.join(', ')||'none')+' · missed '+esc(s.reconciliation.missedTools.join(', ')||'none')+'</div>':'<div class="detail">Import a receipt whose correlationId equals an estimate ID to reconcile predicted and observed usage.</div>';$('finopsCards').innerHTML=card('Observed cost','$'+fmt(f.actualCostUsd),f.month,'cyan')+card('Forecast',f.forecastCostUsd==null?'Unavailable':'$'+fmt(f.forecastCostUsd),'Forecasted from MTD')+card('Budget',f.budgetUsd==null?'Not configured':fmt(f.budgetConsumedPercent)+'%',f.budgetUsd==null?'Open settings':'$'+fmt(f.budgetUsd),'accent')+card('Value / ROI','$'+fmt(f.attributedValueUsd),f.roi==null?'ROI unavailable':fmt(f.roi*100)+'% ROI');$('chargeback').innerHTML='<b>Chargeback by project</b>'+(f.chargeback.length?'<table>'+f.chargeback.map(x=>'<tr><td>'+esc(x.key)+'</td><td>$'+fmt(x.costUsd)+'</td><td>'+fmt(x.observations)+' observations</td></tr>').join('')+'</table>':'<div class="detail">No observed project cost this month.</div>');$('recommendations').innerHTML='<b>Optimization recommendations</b>'+(f.recommendations.length?f.recommendations.map(x=>'<div class="section"><b>'+esc(x.title)+'</b> <span class="badge">'+esc(x.evidenceGrade)+'</span><div class="detail">'+esc(x.detail)+(x.projectedSavingsUsd==null?'':' · projected gap $'+fmt(x.projectedSavingsUsd))+'</div></div>').join(''):'<div class="detail">No evidence-backed recommendation is available.</div>');$('accessCards').innerHTML=card('GitHub Copilot',g.status,g.organization||'No organization',g.status==='ready'?'accent':'coral')+card('Days observed',g.days.length,g.source)+card('Active users',g.days.length?fmt(g.days[g.days.length-1].totalActiveUsers):'Unavailable','Aggregate GitHub evidence')+card('Hidden context','Unavailable','Not exposed by supported APIs','coral');if(!lastEstimate&&s.lastEstimate)renderEstimate(s.lastEstimate)}function renderEstimate(e){$('previewCards').innerHTML=card('Visible prompt',range(e.breakdown.visiblePrompt),e.tokenMethod,'cyan')+card('Input low/base/high',range(e.breakdown.totalInput),'prompt + config + definitions + results','accent')+card('Output low/base/high',range(e.breakdown.totalOutput),'tool arguments + response')+card('Total low/base/high',range(e.breakdown.totalTokens),e.evidenceGrade,'coral')+card('Tool definitions',range(e.breakdown.toolDefinitions),e.selectedTools.length+' selected')+card('Tool results',range(e.breakdown.toolResults),'scenario range')+card('Cost USD',e.costUsd?'$'+range(e.costUsd):'Unpriced','Requires sourced model rates')+card('Hidden Copilot context','Unavailable','Never inferred');$('selectedTools').innerHTML=e.selectedTools.length?'<div class="card"><b>Scenario tools</b><div class="detail">'+e.selectedTools.map(t=>esc(t.name)+' ('+esc(t.likelihood==null?'manual':Math.round(t.likelihood*100)+'%')+', '+esc(t.likelihoodSource)+', calls '+esc(range(t.calls))+')').join('<br>')+'</div></div>':''}vscode.postMessage({type:'ready'});</script></body></html>`;
}
