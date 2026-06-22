---
description: "Power Apps Component Framework standards — lifecycle methods, React integration, and TypeScript patterns."
applyTo: "**/*.ts, **/*.tsx"
waf:
  - "reliability"
  - "performance-efficiency"
---

# PCF Components — FAI Standards

> TypeScript-first standards for Power Apps Component Framework controls — lifecycle, manifest, React virtual controls, and Solution ALM.

## Component Lifecycle

Every PCF control implements `StandardControl<TInputs, TOutputs>`. Honor the contract:

- **`init`** — one-time setup. Attach DOM, create React root, subscribe to resize. Never call `notifyOutputChanged` here.
- **`updateView`** — called on every property/dataset change. Keep idempotent — re-render React tree, never append DOM nodes.
- **`getOutputs`** — return output property bag synchronously. No async, no side effects.
- **`destroy`** — tear down React root (`root.unmount()`), remove event listeners, cancel pending fetches, clear timers.

```typescript
public init(ctx: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
  this._context = ctx;
  this._notifyOutputChanged = notifyOutputChanged;
  this._root = createRoot(container);
  ctx.mode.trackContainerResize(true);
}

public updateView(ctx: ComponentFramework.Context<IInputs>): void {
  this._context = ctx;
  this._root.render(React.createElement(AppComponent, {
    value: ctx.parameters.sampleProperty.raw ?? "",
    onChange: this._handleChange,
    width: ctx.mode.allocatedWidth,
  }));
}

public destroy(): void {
  this._root.unmount();
}
```

## ControlManifest.Input.xml

Manifest defines the control's identity, properties, and resources. Structure:

```xml
<manifest>
  <control namespace="Contoso" constructor="MyControl" version="1.0.0"
           display-name-key="MyControl" description-key="MyControl_Desc"
           control-type="virtual" >
    <!-- Bound property: two-way binding to a form field -->
    <property name="value" display-name-key="Value" of-type="SingleLine.Text"
              usage="bound" required="true" />
    <!-- Input property: configuration, read-only in the control -->
    <property name="maxLength" display-name-key="MaxLength" of-type="Whole.None"
              usage="input" required="false" default-val="256" />
    <!-- Dataset property: for grid/list controls -->
    <data-set name="records" display-name-key="Records" />
    <resources>
      <code path="index.ts" order="1" />
      <platform-library name="React" version="16.8.6" />
      <platform-library name="Fluent" version="9.46.2" />
    </resources>
  </control>
</manifest>
```

- `control-type="virtual"` — React controls that use platform React (no bundle bloat). Omit for standard DOM controls.
- `usage="bound"` — two-way data flow. `usage="input"` — config-only, read from maker.
- Declare `<platform-library>` for React and Fluent to share the host's instances — never bundle your own.

## Field vs Dataset Components

| Aspect | Field Component | Dataset Component |
| --- | --- | --- |
| Binding | Single field (`<property>`) | View/table (`<data-set>`) |
| Use case | Custom input, formatted display | Grids, galleries, calendars |
| Paging | N/A | `context.parameters.records.paging` |
| Sorting | N/A | `context.parameters.records.sorting` |
| Filtering | N/A | `context.parameters.records.filtering` |
| Record selection | N/A | `setSelectedRecordIds()` |

For datasets, always handle paging. Call `loadNextPage()` only when `hasNextPage` is true. Never load all pages at init.

## React Virtual Controls & Fluent UI v9

Virtual controls (`control-type="virtual"`) render via the platform's React — zero React in your bundle.

```typescript
import { FluentProvider, webLightTheme, Button } from "@fluentui/react-components";

const AppComponent: React.FC<IAppProps> = ({ value, onChange, width }) => (
  <FluentProvider theme={webLightTheme}>
    <Button appearance="primary" onClick={() => onChange("clicked")}>
      {value || "Default"}
    </Button>
  </FluentProvider>
);
```

- Wrap top-level in `<FluentProvider>` with `webLightTheme` or `webDarkTheme` — matches Dynamics/Power Apps chrome.
- Use `@fluentui/react-components` (v9) — not v8 `@fluentui/react`. v9 is tree-shakeable and smaller.
- CSS-in-JS via `makeStyles` from Fluent v9. Never import global CSS files in virtual controls.
- Respect `context.mode.allocatedWidth` and `allocatedHeight` for responsive layout.

## Platform APIs

```typescript
// Web API — CRUD on Dataverse
const result = await context.webAPI.retrieveMultipleRecords("account", "?$select=name&$top=10");
await context.webAPI.createRecord("contact", { firstname: "Jane", lastname: "Doe" });

// Navigation — open forms, dialogs, URLs
context.navigation.openForm({ entityName: "account", entityId: recordId });
context.navigation.openAlertDialog({ text: "Operation complete" });
context.navigation.openUrl("https://learn.microsoft.com");

// Utility — localization, formatting
const label = context.resources.getString("MyControl_Label");
const formatted = context.formatting.formatCurrency(1500, 2, "$");

// Device — camera, geolocation (model-driven mobile only)
const image = await context.device.captureImage({ width: 800, height: 600 });
```

- `webAPI` calls respect Dataverse security roles — no extra auth needed.
- Avoid chaining multiple `webAPI` calls in `updateView` — cache results and re-fetch only on changed parameters.

## CLI & Build

```bash
pac pcf init --namespace FAI --name MyControl --template field --framework react
pac pcf init --namespace FAI --name MyGrid --template dataset --framework react
npm install                       # restore dependencies
npm run build                     # production bundle (Webpack)
npm start watch                   # PCF Test Harness at localhost:8181
pac solution init --publisher-name FAI --publisher-prefix fai
pac solution add-reference --path ../MyControl
msbuild /t:build /restore /p:configuration=Release   # or dotnet build
pac solution import --path bin/Release/Solution.zip --environment https://org.crm.dynamics.com
```

- `npm start watch` launches the PCF Test Harness — test property changes, resize, theming without deploying.
- One Solution project can host multiple controls via multiple `add-reference` calls.
- Use `pac auth create` for environment auth before `import`.

## Bundling & Performance

- Virtual controls share platform React/Fluent — bundle only your code. Target <100KB gzipped.
- Enable Webpack tree-shaking: use named imports (`import { Button }`) not namespace imports.
- Avoid importing entire icon sets — import individual icons: `import { ArrowRight24Regular }`.
- Lazy-load heavy logic only if needed: `const module = await import("./heavyParser");`
- Never use `setTimeout`/`setInterval` without storing handles and clearing in `destroy()`.
- Debounce `notifyOutputChanged` in text inputs — 300ms minimum to avoid form save storms.

## Solution Packaging & ALM

- Managed solution for production, unmanaged for dev. Never edit managed layers directly.
- Use Solution publisher prefix consistently (`fai_`) — avoid `new_` or default prefixes.
- Source-control the unpacked solution: `pac solution unpack --zipFile Solution.zip --folder src/`.
- CI/CD: `pac solution pack` → `pac solution check` (Solution Checker for AppSource rules) → `pac solution import`.
- Pin solution versions in pipelines. Bump version on every release build.
- Use environment variables in Solutions for config that changes per environment (endpoints, feature flags).

## Testing

- **PCF Test Harness** (`npm start watch`): test UI interactively, simulate property changes, resize viewport, validate `getOutputs()`.
- **Unit tests** (Jest): test React components in isolation, mock `ComponentFramework.Context` interfaces.
- **Solution Checker** (`pac solution check`): static analysis for AppSource compliance, deprecated API usage, accessibility.
- Mock context factory pattern for tests:
```typescript
const mockContext = {
  parameters: { value: { raw: "test", type: "SingleLine.Text" } },
  mode: { allocatedWidth: 400, allocatedHeight: 200, isControlDisabled: false, isVisible: true },
  webAPI: { retrieveMultipleRecords: jest.fn().mockResolvedValue({ entities: [] }) },
} as unknown as ComponentFramework.Context<IInputs>;
```

## Anti-Patterns

- ❌ Calling `notifyOutputChanged()` inside `updateView()` — causes infinite render loops
- ❌ Direct DOM manipulation in virtual controls — use React state, never `document.getElementById`
- ❌ Bundling React/Fluent instead of declaring `<platform-library>` — doubles bundle size
- ❌ Async work in `getOutputs()` — must return synchronously
- ❌ Not cleaning up in `destroy()` — memory leaks, orphaned event listeners, zombie timers
- ❌ Using `any` for context/property types — defeats TypeScript safety, mask API changes
- ❌ Fetching data in `updateView` without caching — triggers on every form tab switch
- ❌ Unbounded dataset loads — always paginate, respect `paging.pageSize`

## WAF Alignment

| Pillar | PCF Practice |
|--------|-------------|
| **Reliability** | Null-safe property access (`raw ?? fallback`), error boundaries in React, graceful offline handling via cached data |
| **Performance** | Virtual controls (shared React), tree-shaken Fluent v9, debounced output, lazy imports, <100KB bundle |
| **Security** | No secrets in manifests, Dataverse RBAC via `webAPI`, sanitize user input before rendering, CSP-compatible CSS-in-JS |
| **Cost Optimization** | Platform libraries avoid duplicate bundles, paginated dataset fetches reduce Dataverse API calls |
| **Operational Excellence** | `pac solution unpack` in source control, Solution Checker in CI, consistent publisher prefix, versioned releases |
