/**
 * WASM-compiled FAI Engine — browser + Cloudflare Workers + Deno + Node.js.
 *
 * Production-grade:
 *   - Rust core compiled to WebAssembly via wasm-pack
 *   - < 5 MB gzipped, < 50 MB uncompressed
 *   - Targets: browser (ESM), Cloudflare Workers, Deno, Node.js (via wasm-bindgen)
 *   - API surface: manifest in → SSE-compatible events out, all local
 *   - Performance: manifest load < 200ms, eval invocation < 500ms median
 *   - Use cases: offline eval, client-side privacy (PII never leaves browser), edge CDN
 *   - Same .fai-manifest.json works in Cloud and WASM — zero modifications
 *
 * Tracker: P6.3.001
 */

// ── WASM Engine Configuration ───────────────────────────────────────────

export const WASM_ENGINE_CONFIG = {
  name: "fai-engine-wasm",
  version: "1.0.0",
  targets: ["browser", "cloudflare-workers", "deno", "nodejs"] as const,

  build: {
    toolchain: "Rust + wasm-pack",
    crateType: "cdylib",
    wasmBindgen: true,
    optimizations: {
      lto: true,                         // link-time optimization
      optLevel: "z",                     // optimize for size
      codegen: 1,                        // single codegen unit for better optimization
      stripDebug: true,                  // strip debug symbols in release
      wasmOpt: true,                     // run wasm-opt after compilation
    },
    outputFormats: {
      browser: { format: "esm", filename: "fai-engine.js", wasmFilename: "fai-engine_bg.wasm" },
      nodejs: { format: "cjs", filename: "fai-engine.js", wasmFilename: "fai-engine_bg.wasm" },
      bundler: { format: "esm", filename: "fai-engine.js", wasmFilename: "fai-engine_bg.wasm" },
      deno: { format: "esm", filename: "fai-engine.js", wasmFilename: "fai-engine_bg.wasm" },
    },
  },

  sizeTargets: {
    wasmUncompressed: 50 * 1024 * 1024,  // 50 MB max
    wasmGzipped: 5 * 1024 * 1024,        // 5 MB max
    jsGlue: 100 * 1024,                  // 100 KB max (wasm-bindgen JS glue)
  },

  performance: {
    manifestLoadMs: 200,                 // max time to parse + validate manifest
    evalInvocationP50Ms: 500,            // median eval invocation
    evalInvocationP99Ms: 2000,           // 99th percentile
    memoryBaseline: 64 * 1024 * 1024,    // 64 MB baseline memory
    memoryPerEval: 16 * 1024 * 1024,     // 16 MB per concurrent eval
  },
};

// ── Rust Crate Structure ────────────────────────────────────────────────

export const RUST_CRATE_STRUCTURE = {
  crateName: "fai-engine-core",
  edition: "2021",
  modules: [
    {
      name: "manifest",
      description: "Parse and validate .fai-manifest.json against v1.0 schema",
      publicApi: ["parse_manifest(json: &str) -> Result<Manifest, ParseError>", "validate_manifest(manifest: &Manifest) -> Vec<ValidationIssue>"],
    },
    {
      name: "evaluator",
      description: "Execute evaluation primitives (rule-based only in WASM — LLM-judge requires external API)",
      publicApi: [
        "evaluate_groundedness(input: &str, output: &str, context: &str) -> EvalScore",
        "evaluate_coherence(output: &str) -> EvalScore",
        "evaluate_safety(output: &str, rules: &[SafetyRule]) -> EvalScore",
        "evaluate_regex(text: &str, patterns: &[Pattern]) -> EvalScore",
        "evaluate_length(text: &str, min: usize, max: usize) -> EvalScore",
        "evaluate_json_schema(output: &str, schema: &str) -> EvalScore",
      ],
    },
    {
      name: "graph",
      description: "Topological sort of manifest nodes, dependency resolution, execution ordering",
      publicApi: ["build_execution_plan(manifest: &Manifest) -> ExecutionPlan", "execute_plan(plan: &ExecutionPlan, inputs: &DataSet) -> Vec<EvalResult>"],
    },
    {
      name: "events",
      description: "SSE-compatible event emission (same grammar as Cloud Engine)",
      publicApi: ["emit_event(event: EngineEvent) -> String"],
      eventTypes: ["queued", "log", "token", "eval", "cost", "done", "error"],
    },
    {
      name: "knowledge",
      description: "In-memory knowledge store for offline evaluation context",
      publicApi: ["load_knowledge(data: &str) -> KnowledgeStore", "query_knowledge(store: &KnowledgeStore, query: &str) -> Vec<Match>"],
    },
    {
      name: "guardrails",
      description: "Built-in + custom guardrail execution (safety, PII regex, toxicity keyword)",
      publicApi: ["run_guardrails(output: &str, config: &GuardrailConfig) -> GuardrailResult"],
    },
  ],

  dependencies: [
    { crate: "serde", version: "1", features: ["derive"], purpose: "JSON serialization" },
    { crate: "serde_json", version: "1", features: [], purpose: "JSON parsing" },
    { crate: "wasm-bindgen", version: "0.2", features: [], purpose: "JS interop" },
    { crate: "js-sys", version: "0.3", features: [], purpose: "JavaScript type access" },
    { crate: "web-sys", version: "0.3", features: ["console"], purpose: "Browser API access" },
    { crate: "regex", version: "1", features: [], purpose: "Pattern matching for guardrails" },
    { crate: "jsonschema", version: "0.18", features: [], purpose: "JSON Schema validation" },
    { crate: "unicode-segmentation", version: "1", features: [], purpose: "Token counting" },
  ],

  wasmBindgenExports: [
    "pub fn init() -> Result<(), JsValue>",
    "pub fn parse_and_validate(manifest_json: &str) -> Result<JsValue, JsValue>",
    "pub fn run_eval(manifest_json: &str, dataset_json: &str, callback: &js_sys::Function) -> Result<JsValue, JsValue>",
    "pub fn run_guardrails(text: &str, config_json: &str) -> Result<JsValue, JsValue>",
    "pub fn get_version() -> String",
    "pub fn get_supported_primitives() -> JsValue",
  ],
};

// ── JavaScript API (TypeScript wrapper around WASM) ─────────────────────

export interface FAIEngineWASM {
  /** Initialize the WASM engine. Must be called before any other method. */
  init(): Promise<void>;

  /** Parse and validate a manifest. Returns validated manifest or throws. */
  parseManifest(manifestJson: string): Manifest;

  /** Run evaluation on a dataset using the manifest. Emits events via callback. */
  runEval(
    manifestJson: string,
    datasetJson: string,
    onEvent: (event: EngineEvent) => void,
  ): Promise<EvalResult[]>;

  /** Run guardrails check on text. Returns pass/fail with details. */
  runGuardrails(text: string, config: GuardrailConfig): GuardrailResult;

  /** Get engine version. */
  getVersion(): string;

  /** Get list of supported evaluation primitives. */
  getSupportedPrimitives(): string[];
}

export interface Manifest {
  name: string;
  version: string;
  evaluationTarget: { description: string; targetType: string };
  nodes: ManifestNode[];
  edges: ManifestEdge[];
  settings: Record<string, unknown>;
}

export interface ManifestNode {
  id: string;
  type: "dataset" | "agent" | "evaluator" | "output" | "knowledge";
  data: Record<string, unknown>;
}

export interface ManifestEdge {
  id: string;
  source: string;
  target: string;
}

export type EngineEvent =
  | { type: "queued"; playId: string; timestamp: string }
  | { type: "log"; playId: string; level: string; message: string }
  | { type: "eval"; playId: string; nodeId: string; metric: string; score: number; details?: string }
  | { type: "cost"; playId: string; tokensIn: number; tokensOut: number; estimatedCostUsd: number }
  | { type: "done"; playId: string; status: string; durationMs: number }
  | { type: "error"; playId: string; message: string };

export interface EvalResult {
  nodeId: string;
  metric: string;
  score: number;
  passed: boolean;
  threshold: number;
  details: string;
  durationMs: number;
}

export interface GuardrailConfig {
  safety: boolean;
  piiDetection: boolean;
  toxicityKeywords: boolean;
  customPatterns: { name: string; pattern: string; action: "block" | "warn" | "log" }[];
}

export interface GuardrailResult {
  passed: boolean;
  checks: { name: string; passed: boolean; severity: string; matches: string[] }[];
  blocked: boolean;
  blockReason: string | null;
}

// ── Platform-Specific Initialization ────────────────────────────────────

export const PLATFORM_INIT = {
  browser: {
    description: "Load WASM in browser via <script> tag or ESM import",
    example: `
import init, { parse_and_validate, run_eval } from '@frootai/engine-wasm';

// Initialize WASM
await init();

// Parse manifest
const manifest = parse_and_validate(manifestJson);

// Run evaluation
const results = await run_eval(manifestJson, datasetJson, (event) => {
  console.log('Event:', JSON.parse(event));
});`,
    bundlerSupport: ["Vite", "webpack 5", "Rollup", "esbuild", "Parcel"],
    minBrowserVersions: { chrome: 89, firefox: 89, safari: 15, edge: 89 },
  },

  cloudflareWorkers: {
    description: "Run WASM in Cloudflare Workers for edge-local evaluation",
    example: `
import { parse_and_validate, run_eval } from '@frootai/engine-wasm/cloudflare';

export default {
  async fetch(request) {
    const { manifest, dataset } = await request.json();
    const results = run_eval(manifest, dataset, () => {});
    return Response.json(results);
  }
};`,
    limits: { cpuTimeMs: 50, memoryMb: 128, wasmModuleSizeMb: 10 },
  },

  deno: {
    description: "Load WASM in Deno runtime",
    example: `
import init, { run_eval } from 'https://esm.sh/@frootai/engine-wasm';
await init();
const results = run_eval(manifestJson, datasetJson, (e) => console.log(e));`,
  },

  nodejs: {
    description: "Load WASM in Node.js via require or import",
    example: `
const { init, run_eval } = require('@frootai/engine-wasm/nodejs');
await init();
const results = await run_eval(manifestJson, datasetJson, console.log);`,
    minVersion: "18.0.0",
  },
};

// ── Limitations (WASM vs Cloud) ─────────────────────────────────────────

export const WASM_LIMITATIONS = {
  supported: [
    "Manifest parsing and validation (L0 conformance)",
    "Rule-based evaluators (regex, length, JSON schema, keyword)",
    "Built-in guardrails (safety regex, PII detection, toxicity keywords)",
    "Graph execution planning (topological sort)",
    "SSE-compatible event emission",
    "Knowledge module loading (inline data)",
    "Offline operation (zero network required)",
  ],
  notSupported: [
    "LLM-as-judge evaluators (require API call to LLM provider — use external bridge)",
    "Multi-model scoring (requires cloud API)",
    "Cost calculation (requires live pricing data — returns estimate based on token count)",
    "Telemetry export (no OTel in WASM — use host environment's telemetry)",
    "Persistent storage (WASM is stateless — use IndexedDB/localStorage via JS bridge)",
    "Knowledge module URL refresh (no HTTP client in WASM — host must fetch and pass data)",
  ],
  bridgePattern: "For LLM-judge evaluators: WASM engine calls a JS callback function that the host provides. The host makes the LLM API call and returns the result to the WASM engine. This keeps the engine pure (no network I/O) while supporting all eval types.",
};

// ── Build Pipeline ──────────────────────────────────────────────────────

export const BUILD_PIPELINE = {
  steps: [
    { step: 1, name: "Rust compile", command: "cargo build --release --target wasm32-unknown-unknown", description: "Compile Rust to WASM target" },
    { step: 2, name: "wasm-bindgen", command: "wasm-bindgen --out-dir pkg --target web target/wasm32-unknown-unknown/release/fai_engine_core.wasm", description: "Generate JS glue code" },
    { step: 3, name: "wasm-opt", command: "wasm-opt -Oz pkg/fai_engine_core_bg.wasm -o pkg/fai_engine_core_bg.wasm", description: "Optimize WASM binary for size" },
    { step: 4, name: "Size check", command: "wc -c pkg/fai_engine_core_bg.wasm && gzip -c pkg/fai_engine_core_bg.wasm | wc -c", description: "Verify < 50 MB uncompressed, < 5 MB gzipped" },
    { step: 5, name: "Generate variants", command: "wasm-pack build --target nodejs && wasm-pack build --target web && wasm-pack build --target bundler", description: "Build for all target environments" },
    { step: 6, name: "TypeScript types", command: "tsc --declaration --emitDeclarationOnly", description: "Generate .d.ts files for TypeScript consumers" },
    { step: 7, name: "Test browser", command: "wasm-pack test --headless --chrome --firefox", description: "Run tests in headless browser" },
    { step: 8, name: "Test Node.js", command: "node tests/nodejs-smoke.mjs", description: "Smoke test in Node.js" },
    { step: 9, name: "Publish", command: "npm publish --access public", description: "Publish @frootai/engine-wasm to npm" },
  ],
  ci: {
    platform: "GitHub Actions",
    triggers: ["push to main", "tag v*"],
    matrix: { os: ["ubuntu-latest"], rust: ["stable"], node: ["18", "20", "22"] },
    caching: ["~/.cargo/registry", "target/"],
  },
};

// ── npm Package ─────────────────────────────────────────────────────────

export const NPM_PACKAGE = {
  name: "@frootai/engine-wasm",
  version: "1.0.0",
  description: "WASM-compiled FAI Protocol evaluation engine. Run AI agent evaluations in browser, Cloudflare Workers, Deno, or Node.js — offline, with zero network dependency.",
  license: "MIT",
  repository: "https://github.com/frootai/fai-engine-wasm",
  exports: {
    ".": { import: "./pkg/bundler/fai_engine_core.js", types: "./pkg/bundler/fai_engine_core.d.ts" },
    "./browser": { import: "./pkg/web/fai_engine_core.js", types: "./pkg/web/fai_engine_core.d.ts" },
    "./nodejs": { require: "./pkg/nodejs/fai_engine_core.js", types: "./pkg/nodejs/fai_engine_core.d.ts" },
    "./cloudflare": { import: "./pkg/bundler/fai_engine_core.js", types: "./pkg/bundler/fai_engine_core.d.ts" },
  },
  files: ["pkg/", "README.md", "LICENSE"],
  keywords: ["wasm", "webassembly", "ai", "evaluation", "agents", "fai-protocol", "offline", "edge"],
  engines: { node: ">=18.0.0" },
};

// ── Performance Benchmarks ──────────────────────────────────────────────

export interface WASMBenchmark {
  operation: string;
  samples: number;
  p50Ms: number;
  p99Ms: number;
  target: number;
  passed: boolean;
}

export const BENCHMARK_SUITE: Omit<WASMBenchmark, "p50Ms" | "p99Ms" | "passed">[] = [
  { operation: "WASM initialization", samples: 100, target: 100 },
  { operation: "Manifest parse (small, 5 nodes)", samples: 1000, target: 10 },
  { operation: "Manifest parse (large, 50 nodes)", samples: 100, target: 50 },
  { operation: "Manifest validation (L0)", samples: 1000, target: 20 },
  { operation: "Rule-based eval (regex, single)", samples: 10000, target: 1 },
  { operation: "Rule-based eval (10 rules)", samples: 1000, target: 10 },
  { operation: "Guardrails check (PII + safety)", samples: 1000, target: 5 },
  { operation: "Full plan execution (5 nodes, 100 samples)", samples: 10, target: 500 },
  { operation: "Knowledge store query (1k docs)", samples: 100, target: 50 },
  { operation: "Memory baseline after init", samples: 10, target: 64 }, // MB, not ms
];
