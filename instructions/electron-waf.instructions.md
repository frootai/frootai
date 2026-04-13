---
description: "Electron standards — IPC security, preload scripts, context isolation."
applyTo: "**/*.ts, **/*.js"
waf:
  - "security"
  - "performance-efficiency"
---

# Electron — FAI Standards

> IPC security, context isolation, preload scripts, auto-updates, native module safety, and desktop app performance.

## Core Security Rules

- `nodeIntegration: false` and `contextIsolation: true` on every `BrowserWindow` — no exceptions
- `sandbox: true` for all renderer processes — restrict filesystem and OS access
- Preload scripts are the ONLY bridge between main and renderer — never expose `require` or Node APIs
- Use `contextBridge.exposeInMainWorld` to expose a minimal, typed API surface
- `ipcMain.handle` for async request/response — never `ipcMain.on` for operations that return data
- Validate ALL IPC channel names and payloads in main process — renderers are untrusted
- Set strict CSP in `session.defaultSession.webRequest.onHeadersReceived` — block `eval`, inline scripts
- Never load remote URLs in `BrowserWindow` unless absolutely required — and never with node access

## Preferred Patterns

### Context Bridge + Preload
```typescript
// preload.ts — minimal typed API
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  readFile: (path: string) => ipcRenderer.invoke("fs:read", path),
  saveFile: (path: string, data: string) => ipcRenderer.invoke("fs:save", path, data),
  onUpdateAvailable: (cb: () => void) => {
    ipcRenderer.on("update:available", () => cb());
    return () => ipcRenderer.removeAllListeners("update:available");
  },
});
```

### Secure IPC Handlers
```typescript
// main.ts — validate inputs, use handle not on
import { ipcMain, app } from "electron";
import path from "node:path";

ipcMain.handle("fs:read", async (_event, filePath: string) => {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(app.getPath("userData"));
  if (!resolved.startsWith(allowed)) throw new Error("Access denied");
  return fs.promises.readFile(resolved, "utf8");
});
```

### BrowserWindow Creation
```typescript
const win = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  },
});
```

### Content Security Policy
```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      "Content-Security-Policy": [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
      ],
    },
  });
});
```

### Custom Protocol Registration
```typescript
// Register safe protocol for loading local resources
protocol.handle("app", (request) => {
  const url = new URL(request.url);
  const filePath = path.join(__dirname, "renderer", url.pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(__dirname, "renderer"))) {
    return new Response("Forbidden", { status: 403 });
  }
  return net.fetch(pathToFileURL(resolved).toString());
});
```

### Auto-Updates (electron-updater)
```typescript
import { autoUpdater } from "electron-updater";
import log from "electron-log";

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.on("update-available", () => win.webContents.send("update:available"));
autoUpdater.on("error", (err) => log.error("Update error:", err));

ipcMain.handle("update:download", () => autoUpdater.downloadUpdate());
ipcMain.handle("update:install", () => autoUpdater.quitAndInstall());
app.whenReady().then(() => autoUpdater.checkForUpdates());
```

### Crash Reporting
```typescript
import { crashReporter } from "electron";

crashReporter.start({
  productName: "MyApp",
  submitURL: "https://your-crash-server.example.com/submit",
  uploadToServer: true,
  compress: true,
});
```

## Avoided Patterns

- ❌ `nodeIntegration: true` — exposes full Node.js to renderer (XSS → RCE)
- ❌ `contextIsolation: false` — lets renderer tamper with preload globals
- ❌ `ipcRenderer.send` / `ipcMain.on` for request/response — use `invoke`/`handle` instead
- ❌ `shell.openExternal(userInput)` without URL validation — command injection vector
- ❌ `webview` tag — use `BrowserView` or `<iframe>` with sandbox; webview is deprecated-adjacent
- ❌ `eval()` or `new Function()` in renderer — blocked by CSP, security hazard
- ❌ Exposing `ipcRenderer` directly via `contextBridge` — exposes arbitrary channel access
- ❌ Loading remote content with `nodeIntegration` or without CSP
- ❌ Disabling `webSecurity` to bypass CORS — fix the server instead
- ❌ Storing secrets in `localStorage` or `electron-store` unencrypted — use `safeStorage` API

## Anti-Patterns

- Spawning a new `BrowserWindow` per modal — reuse hidden windows or in-page dialogs
- Blocking the main process with synchronous `fs` or `crypto` — offload to worker threads
- Using `remote` module (removed in Electron 14+) — migrate to `ipcMain.handle`
- Shipping `devTools: true` in production builds — set `false` or omit
- Not signing/notarizing macOS builds — Gatekeeper will quarantine the app
- Bundling unused locales — use `electron-builder` `electronLanguages` to strip
- Running `electron-rebuild` in CI without caching `node_modules` — native module rebuilds are slow

## Performance

- Lazy window creation — only create `BrowserWindow` when the user needs it
- Preload only essential modules — defer heavy imports with dynamic `import()`
- Use `backgroundThrottling: false` only for windows that must stay active (media, timers)
- V8 code cache / snapshots: `--js-flags="--predictable"` during packaging for faster startup
- Profile with `--inspect` flag + Chrome DevTools — measure main-process event loop lag
- Minimize IPC payload size — send IDs, not full objects; use structured clone, not JSON
- Use `nativeImage.createFromPath` lazily — large tray/icon bitmaps block startup

## Window Management

- Single-instance lock with `app.requestSingleInstanceLock()` — focus existing window on re-launch
- Save/restore window bounds with `electron-window-state` or manual `setBounds`/`getBounds`
- Handle `will-quit`, `before-quit`, `window-all-closed` correctly per platform (macOS keeps app alive)
- Multi-window: track windows in a `Set<BrowserWindow>`, clean up on `closed` event

## Native Modules

- Use `electron-rebuild` or `@electron/rebuild` to compile against Electron's Node headers
- Pin `electron` major version in `package.json` — native ABI changes per major
- Prefer N-API / node-addon-api for forward-compatible native addons
- Test native modules in CI on all target platforms (Windows, macOS, Linux)

## Code Signing & Distribution

- Sign Windows builds with EV certificate + `electron-builder` signtool config
- Notarize macOS builds with `@electron/notarize` — required for macOS 10.15+
- Use `electron-builder` auto-update targets: `nsis` (Windows), `dmg`+`zip` (macOS), `AppImage` (Linux)
- ASAR packaging enabled by default — do not disable unless native modules require unpacking

## WAF Alignment

| Pillar | Electron Practices |
|---|---|
| **Security** | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP headers, IPC input validation, `safeStorage` for secrets, code signing, `shell.openExternal` URL allowlist |
| **Reliability** | Single-instance lock, crash reporting, graceful shutdown on `before-quit`, auto-updater with rollback, window state persistence |
| **Performance** | Lazy window creation, dynamic imports in preload, V8 code cache, minimal IPC payloads, background throttling control, native image lazy loading |
| **Cost Optimization** | Strip unused locales, ASAR packaging to reduce install size, delta updates via electron-updater, shared `BrowserView` instead of multiple windows |
| **Operational Excellence** | Structured logging via `electron-log`, crash reporter integration, auto-update channels (stable/beta/alpha), CI builds for all 3 platforms |
| **Responsible AI** | Content Safety on AI-generated responses displayed in renderer, user consent for telemetry/crash data, transparent update notifications |
