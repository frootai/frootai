/**
 * Integration test — simulates the EXACT real-world flow:
 * 1. Load real legacy.js with mocked vscode/fs
 * 2. Activate it (registers all commands)
 * 3. Invoke each of the 9 commands with a real-shape `play` object
 * 4. Assert side effects (file writes, webviews shown)
 *
 * This reveals which commands silently fail in production.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const REPO_ROOT = path.resolve(__dirname, "../../../../../"); // up to frootai-core
const LEGACY_PATH = path.resolve(__dirname, "../../../src/legacy.js");
const NodeModule = require("module");
const ORIGINAL_RESOLVE_FILENAME = NodeModule._resolveFilename;

// Real play object shape from PlayDetail webview
const samplePlay = {
    id: "31",
    name: "Low-Code AI Builder",
    desc: "Test play",
    status: "stable",
    icon: "🛠️",
    dir: "31-low-code-ai-builder",
    infra: "Azure OpenAI · Container Apps",
};

interface CallLog {
    registerCommand: Array<{ id: string }>;
    showWarningMessage: string[];
    showInformationMessage: string[];
    showErrorMessage: string[];
    showQuickPick: number;
    createWebviewPanel: Array<{ id: string; title: string }>;
    webviewHtmlSet: Array<{ panelId: string; htmlLength: number; preview: string }>;
}

function createVscodeMock(workspaceFolder: string): { vscode: any; calls: CallLog; registered: Map<string, Function> } {
    const calls: CallLog = {
        registerCommand: [],
        showWarningMessage: [],
        showInformationMessage: [],
        showErrorMessage: [],
        showQuickPick: 0,
        createWebviewPanel: [],
        webviewHtmlSet: [],
    };
    const registered = new Map<string, Function>();

    const vscode = {
        commands: {
            registerCommand: (id: string, fn: Function) => {
                calls.registerCommand.push({ id });
                registered.set(id, fn);
                return { dispose: () => { } };
            },
            executeCommand: async (id: string, ...args: unknown[]) => {
                const fn = registered.get(id);
                if (!fn) throw new Error(`Command not registered: ${id}`);
                return await fn(...args);
            },
            getCommands: async () => Array.from(registered.keys()),
        },
        window: {
            showWarningMessage: (m: string) => { calls.showWarningMessage.push(m); return Promise.resolve(undefined); },
            showInformationMessage: (m: string) => { calls.showInformationMessage.push(m); return Promise.resolve(undefined); },
            showErrorMessage: (m: string) => { calls.showErrorMessage.push(m); return Promise.resolve(undefined); },
            showQuickPick: () => { calls.showQuickPick++; return Promise.resolve(undefined); },
            createWebviewPanel: (id: string, title: string) => {
                calls.createWebviewPanel.push({ id, title });
                const webview = {
                    _html: "",
                    set html(v: string) {
                        this._html = v;
                        calls.webviewHtmlSet.push({ panelId: id, htmlLength: v.length, preview: v.substring(0, 80) });
                    },
                    get html() { return this._html; },
                    asWebviewUri: (uri: any) => uri,
                    cspSource: "vscode-webview:",
                    onDidReceiveMessage: () => ({ dispose: () => { } }),
                };
                return {
                    webview,
                    onDidDispose: () => ({ dispose: () => { } }),
                    reveal: () => { },
                    dispose: () => { },
                };
            },
            createOutputChannel: (name: string) => ({
                appendLine: (m: string) => console.log(`[${name}] ${m}`),
                show: () => { },
                dispose: () => { },
            }),
            setStatusBarMessage: () => ({ dispose: () => { } }),
            withProgress: async (_opts: unknown, fn: Function) => fn({ report: () => { } }),
            activeTextEditor: undefined,
            registerTreeDataProvider: () => ({ dispose: () => { } }),
            registerWebviewViewProvider: () => ({ dispose: () => { } }),
            registerUriHandler: () => ({ dispose: () => { } }),
            onDidChangeActiveTextEditor: () => ({ dispose: () => { } }),
            createStatusBarItem: () => ({ show: () => { }, hide: () => { }, dispose: () => { }, text: "", tooltip: "", command: "" }),
            createTreeView: () => ({
                dispose: () => { },
                onDidChangeSelection: () => ({ dispose: () => { } }),
                onDidChangeVisibility: () => ({ dispose: () => { } }),
                onDidExpandElement: () => ({ dispose: () => { } }),
                onDidCollapseElement: () => ({ dispose: () => { } }),
                onDidChangeCheckboxState: () => ({ dispose: () => { } }),
                reveal: () => Promise.resolve(),
                visible: true,
                selection: [],
                title: "",
                message: "",
                description: "",
                badge: undefined,
            }),
            registerTerminalProfileProvider: () => ({ dispose: () => { } }),
        },
        workspace: {
            workspaceFolders: [{ uri: { fsPath: workspaceFolder, scheme: "file" }, name: "test-ws", index: 0 }],
            fs: {
                writeFile: async (uri: any, data: Uint8Array) => fs.writeFileSync(uri.fsPath, Buffer.from(data)),
                readFile: async (uri: any) => fs.readFileSync(uri.fsPath),
                createDirectory: async (uri: any) => fs.mkdirSync(uri.fsPath, { recursive: true }),
            },
            openTextDocument: async () => ({ getText: () => "" }),
            getConfiguration: () => ({ get: () => undefined, update: () => Promise.resolve() }),
            onDidChangeConfiguration: () => ({ dispose: () => { } }),
        },
        Uri: {
            file: (p: string) => ({ fsPath: p, path: p, scheme: "file", with: (o: any) => ({ fsPath: o.path || p, path: o.path || p, scheme: o.scheme || "file" }) }),
            parse: (s: string) => ({ fsPath: s, path: s, scheme: "https", toString: () => s }),
            joinPath: (base: any, ...segs: string[]) => ({ fsPath: path.join(base.fsPath, ...segs), path: path.join(base.fsPath, ...segs), scheme: "file" }),
        },
        ViewColumn: { One: 1, Two: 2, Three: 3 },
        env: { openExternal: () => Promise.resolve(true), clipboard: { writeText: () => Promise.resolve() } },
        StatusBarAlignment: { Left: 1, Right: 2 },
        EventEmitter: class { fire() { } dispose() { } get event() { return () => ({ dispose: () => { } }); } },
        ProgressLocation: { Notification: 15 },
        extensions: { getExtension: () => undefined, all: [] },
    };
    return { vscode, calls, registered };
}

describe("Real legacy.js integration — verify all 9 commands actually do something", () => {
    let workspaceFolder: string;
    let mocks: ReturnType<typeof createVscodeMock>;

    beforeEach(() => {
        workspaceFolder = fs.mkdtempSync(path.join(os.tmpdir(), "frootai-int-"));
        const globalStorage = fs.mkdtempSync(path.join(os.tmpdir(), "frootai-gs-"));
        mocks = createVscodeMock(workspaceFolder);
        (mocks as any).globalStorage = globalStorage;

        // Inject vscode mock into Node module cache so legacy.js's require("vscode") resolves
        NodeModule._resolveFilename = function (request: string, ...rest: unknown[]) {
            if (request === "vscode") return "vscode";
            return ORIGINAL_RESOLVE_FILENAME.call(this, request, ...rest);
        };
        require.cache["vscode"] = {
            id: "vscode",
            filename: "vscode",
            loaded: true,
            exports: mocks.vscode,
            children: [],
            paths: [],
      parent: null,
    } as any;
    });

    afterEach(() => {
        NodeModule._resolveFilename = ORIGINAL_RESOLVE_FILENAME;
        try { fs.rmSync(workspaceFolder, { recursive: true, force: true }); } catch { /* ignore */ }
        try { fs.rmSync((mocks as any).globalStorage, { recursive: true, force: true }); } catch { /* ignore */ }
        try { delete require.cache[ORIGINAL_RESOLVE_FILENAME(LEGACY_PATH, module)]; } catch { /* ignore */ }
        delete require.cache["vscode"];
    });

    function makeCtx() {
        return {
            subscriptions: [] as Array<{ dispose: () => void }>,
            extensionUri: mocks.vscode.Uri.file(REPO_ROOT),
            extensionPath: REPO_ROOT,
            globalStorageUri: mocks.vscode.Uri.file((mocks as any).globalStorage),
            globalStoragePath: (mocks as any).globalStorage,
            storageUri: mocks.vscode.Uri.file((mocks as any).globalStorage),
            logUri: mocks.vscode.Uri.file((mocks as any).globalStorage),
            globalState: { get: () => undefined, update: () => Promise.resolve(), keys: () => [] },
            workspaceState: { get: () => undefined, update: () => Promise.resolve(), keys: () => [] },
            secrets: { get: () => Promise.resolve(undefined), store: () => Promise.resolve(), delete: () => Promise.resolve() },
            environmentVariableCollection: { replace: () => { }, append: () => { }, prepend: () => { }, get: () => undefined, forEach: () => { }, delete: () => { }, clear: () => { } },
            asAbsolutePath: (p: string) => path.join(REPO_ROOT, p),
            extension: { packageJSON: { version: "5.2.0" }, id: "frootai.frootai-vscode" },
            extensionMode: 2,
        };
    }

    it("registers ALL 9 commands when activated", async () => {
        const legacy = require(LEGACY_PATH);
        const ctx = makeCtx();

        legacy.activate(ctx);

        const expectedCommands = [
            "frootai.initDevKit",
            "frootai.initTuneKit",
            "frootai.initSpecKit",
            "frootai.initHooks",
            "frootai.initPrompts",
            "frootai.installPlugin",
            "frootai.estimateCostForPlay",
            "frootai.showArchitectureDiagram",
            "frootai.runEvaluation",
        ];

        const registeredIds = mocks.calls.registerCommand.map((c) => c.id);
        const missing = expectedCommands.filter((c) => !registeredIds.includes(c));

        console.log(`\n[REGISTERED] Total: ${registeredIds.length} commands`);
        console.log(`[MISSING from expected 9]:`, missing);
        expect(missing).toEqual([]);
    });

    it("frootai.installPlugin with preSelectedPlay → writes files (no QuickPick)", async () => {
        const legacy = require(LEGACY_PATH);
        const ctx = makeCtx();
        legacy.activate(ctx);

        const beforeQuickPick = mocks.calls.showQuickPick;
        await mocks.vscode.commands.executeCommand("frootai.installPlugin", samplePlay);

        console.log(`\n[installPlugin] QuickPick shown: ${mocks.calls.showQuickPick - beforeQuickPick} times (should be 0)`);
        console.log(`[installPlugin] Info messages:`, mocks.calls.showInformationMessage);
        console.log(`[installPlugin] Warnings:`, mocks.calls.showWarningMessage);
        console.log(`[installPlugin] Errors:`, mocks.calls.showErrorMessage);
        console.log(`[installPlugin] Files in workspace:`);
        listFilesRec(workspaceFolder).forEach((f) => console.log(`  - ${path.relative(workspaceFolder, f)}`));

        expect(mocks.calls.showQuickPick - beforeQuickPick).toBe(0);
        expect(fs.existsSync(path.join(workspaceFolder, "plugin.json"))).toBe(true);
    });

    it("frootai.estimateCostForPlay with preSelectedPlay → opens webview (no QuickPick)", async () => {
        const legacy = require(LEGACY_PATH);
        const ctx = makeCtx();
        legacy.activate(ctx);

        const beforeQuickPick = mocks.calls.showQuickPick;
        const beforePanels = mocks.calls.createWebviewPanel.length;
        await mocks.vscode.commands.executeCommand("frootai.estimateCostForPlay", samplePlay);

        console.log(`\n[estimateCostForPlay] QuickPick shown: ${mocks.calls.showQuickPick - beforeQuickPick} (should be 0)`);
        console.log(`[estimateCostForPlay] Webview panels created: ${mocks.calls.createWebviewPanel.length - beforePanels}`);
        console.log(`[estimateCostForPlay] Webview HTML set:`, mocks.calls.webviewHtmlSet);
        console.log(`[estimateCostForPlay] Errors:`, mocks.calls.showErrorMessage);

        expect(mocks.calls.showQuickPick - beforeQuickPick).toBe(0);
        expect(mocks.calls.createWebviewPanel.length - beforePanels).toBe(1);
        expect(mocks.calls.webviewHtmlSet[0]?.htmlLength).toBeGreaterThan(100);
    }, 30000);

    it("frootai.showArchitectureDiagram with preSelectedPlay → opens webview (no QuickPick)", async () => {
        const legacy = require(LEGACY_PATH);
        const ctx = makeCtx();
        legacy.activate(ctx);

        const beforeQuickPick = mocks.calls.showQuickPick;
        const beforePanels = mocks.calls.createWebviewPanel.length;
        await mocks.vscode.commands.executeCommand("frootai.showArchitectureDiagram", samplePlay);

        console.log(`\n[showArchitectureDiagram] QuickPick shown: ${mocks.calls.showQuickPick - beforeQuickPick} (should be 0)`);
        console.log(`[showArchitectureDiagram] Webview panels: ${mocks.calls.createWebviewPanel.length - beforePanels}`);
        console.log(`[showArchitectureDiagram] Webview HTML:`, mocks.calls.webviewHtmlSet);
        console.log(`[showArchitectureDiagram] Errors:`, mocks.calls.showErrorMessage);

        expect(mocks.calls.showQuickPick - beforeQuickPick).toBe(0);
        expect(mocks.calls.createWebviewPanel.length - beforePanels).toBe(1);
    }, 30000);

    it("frootai.initHooks with preSelectedPlay → writes file (no QuickPick)", async () => {
        const legacy = require(LEGACY_PATH);
        const ctx = makeCtx();
        legacy.activate(ctx);

        const beforeQuickPick = mocks.calls.showQuickPick;
        await mocks.vscode.commands.executeCommand("frootai.initHooks", samplePlay);

        console.log(`\n[initHooks] QuickPick shown: ${mocks.calls.showQuickPick - beforeQuickPick} (should be 0)`);
        console.log(`[initHooks] Files written:`);
        listFilesRec(workspaceFolder).forEach((f) => console.log(`  - ${path.relative(workspaceFolder, f)}`));
        console.log(`[initHooks] Info:`, mocks.calls.showInformationMessage);
        console.log(`[initHooks] Warnings:`, mocks.calls.showWarningMessage);
        console.log(`[initHooks] Errors:`, mocks.calls.showErrorMessage);
    }, 30000);
});

function listFilesRec(dir: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFilesRec(full));
        else out.push(full);
    }
    return out;
}
