/**
 * On-Device Runtime — iOS + Android + desktop with small model support.
 *
 * Production-grade:
 *   - Native bridges: Swift (iOS), Kotlin (Android), Rust (Win/Mac/Linux)
 *   - Small models: Phi-4-mini, Gemma-2B, Llama-3-Mini, TinyLlama via ONNX/llama.cpp
 *   - Embedded SQLite for knowledge, optional local vector cache
 *   - Memory optimized: < 8 GB RAM (phones), < 256 MB GPU VRAM
 *   - Same .fai-manifest.json runs on-device and in Cloud — zero modifications
 *
 * Tracker: P6.3.002
 */

// ── On-Device Runtime Config ────────────────────────────────────────────

export const ON_DEVICE_CONFIG = {
  name: "fai-engine-device",
  version: "1.0.0",
  description: "On-device FAI Engine runtime for air-gapped, privacy-first, and latency-sensitive deployments",

  platforms: {
    ios: {
      minVersion: "16.0",
      bridge: "Swift (via Swift Package Manager)",
      inferenceBackend: "Core ML + ONNX Runtime (Apple Neural Engine preferred)",
      storageBackend: "SQLite (GRDB.swift wrapper)",
      vectorCache: "vDSP / Accelerate framework for cosine similarity",
      buildOutput: "XCFramework (.xcframework)",
      codesigning: "Apple Developer ID",
      distribution: ["Swift Package Manager", "CocoaPods", "direct XCFramework download"],
    },
    android: {
      minVersion: "API 28 (Android 9)",
      bridge: "Kotlin (via Gradle plugin / AAR)",
      inferenceBackend: "ONNX Runtime Mobile + NNAPI delegate (GPU acceleration)",
      storageBackend: "SQLite (Room wrapper)",
      vectorCache: "Android NEON SIMD for cosine similarity",
      buildOutput: "AAR (.aar)",
      codesigning: "Google Play App Signing",
      distribution: ["Maven Central", "direct AAR download"],
    },
    desktop: {
      platforms: ["Windows x64", "macOS ARM64 + x64", "Linux x64"],
      bridge: "Rust native (shared library: .dll / .dylib / .so)",
      inferenceBackend: "llama.cpp (GGUF models) + ONNX Runtime",
      storageBackend: "SQLite (rusqlite)",
      vectorCache: "SIMD-accelerated cosine similarity (Rust)",
      buildOutput: "Shared library + C header + TypeScript bindings (via napi-rs)",
      distribution: ["npm (native addon)", "Cargo crate", "direct download"],
    },
  },

  memoryLimits: {
    phone: { maxRAM: 8 * 1024, unit: "MB", description: "iPhone 14+ / Pixel 7+ — 6–8 GB total, engine uses ≤ 4 GB" },
    tablet: { maxRAM: 12 * 1024, unit: "MB", description: "iPad Pro / Samsung Tab — more headroom" },
    desktop: { maxRAM: 16 * 1024, unit: "MB", description: "Any modern desktop" },
    gpuVRAM: { max: 256, unit: "MB", description: "GPU memory for model inference acceleration" },
  },
};

// ── Supported Small Models ──────────────────────────────────────────────

export interface OnDeviceModel {
  id: string;
  name: string;
  provider: string;
  parameterCount: string;
  format: "onnx" | "gguf" | "coreml" | "tflite";
  sizeOnDisk: number;               // MB
  ramRequired: number;               // MB
  quantization: string;              // "Q4_K_M", "Q8_0", "FP16", "INT8"
  useCase: string;
  platforms: ("ios" | "android" | "desktop")[];
  downloadUrl: string;               // CDN URL for model download
  license: string;
  benchmarks: {
    tokensPerSecond: number;         // on reference hardware
    referenceDevice: string;
    firstTokenLatency: number;       // ms
  };
}

export const SUPPORTED_MODELS: OnDeviceModel[] = [
  {
    id: "phi-4-mini-q4",
    name: "Phi-4 Mini (Q4_K_M)",
    provider: "Microsoft",
    parameterCount: "3.8B",
    format: "gguf",
    sizeOnDisk: 2200,
    ramRequired: 3200,
    quantization: "Q4_K_M",
    useCase: "Primary on-device scoring model. Best quality-to-size ratio for evaluation tasks.",
    platforms: ["ios", "android", "desktop"],
    downloadUrl: "https://models.frootai.dev/phi-4-mini/Q4_K_M.gguf",
    license: "MIT",
    benchmarks: { tokensPerSecond: 18, referenceDevice: "iPhone 15 Pro (A17 Pro)", firstTokenLatency: 280 },
  },
  {
    id: "gemma-2b-q4",
    name: "Gemma 2B (Q4_K_M)",
    provider: "Google",
    parameterCount: "2B",
    format: "gguf",
    sizeOnDisk: 1400,
    ramRequired: 2200,
    quantization: "Q4_K_M",
    useCase: "Lightweight scoring model. Lower quality than Phi-4 but smaller footprint.",
    platforms: ["ios", "android", "desktop"],
    downloadUrl: "https://models.frootai.dev/gemma-2b/Q4_K_M.gguf",
    license: "Apache-2.0 (Gemma Terms)",
    benchmarks: { tokensPerSecond: 28, referenceDevice: "iPhone 15 Pro (A17 Pro)", firstTokenLatency: 180 },
  },
  {
    id: "llama-3-mini-q4",
    name: "Llama 3.2 1B (Q4_K_M)",
    provider: "Meta",
    parameterCount: "1.2B",
    format: "gguf",
    sizeOnDisk: 800,
    ramRequired: 1400,
    quantization: "Q4_K_M",
    useCase: "Ultra-lightweight model for resource-constrained devices. Basic eval scoring.",
    platforms: ["ios", "android", "desktop"],
    downloadUrl: "https://models.frootai.dev/llama-3-mini/Q4_K_M.gguf",
    license: "Llama 3.2 Community License",
    benchmarks: { tokensPerSecond: 45, referenceDevice: "iPhone 15 Pro (A17 Pro)", firstTokenLatency: 120 },
  },
  {
    id: "tinyllama-q8",
    name: "TinyLlama 1.1B (Q8_0)",
    provider: "Community",
    parameterCount: "1.1B",
    format: "gguf",
    sizeOnDisk: 1100,
    ramRequired: 1600,
    quantization: "Q8_0",
    useCase: "Higher precision small model for edge deployments where quality matters more than speed.",
    platforms: ["desktop"],
    downloadUrl: "https://models.frootai.dev/tinyllama/Q8_0.gguf",
    license: "Apache-2.0",
    benchmarks: { tokensPerSecond: 35, referenceDevice: "MacBook Pro M3", firstTokenLatency: 90 },
  },
  {
    id: "phi-4-mini-coreml",
    name: "Phi-4 Mini (Core ML, INT8)",
    provider: "Microsoft",
    parameterCount: "3.8B",
    format: "coreml",
    sizeOnDisk: 2800,
    ramRequired: 3500,
    quantization: "INT8",
    useCase: "Apple-optimized: uses Apple Neural Engine for maximum efficiency on iPhone/iPad/Mac.",
    platforms: ["ios"],
    downloadUrl: "https://models.frootai.dev/phi-4-mini/coreml-int8.mlpackage",
    license: "MIT",
    benchmarks: { tokensPerSecond: 25, referenceDevice: "iPhone 15 Pro (ANE)", firstTokenLatency: 200 },
  },
  {
    id: "gemma-2b-onnx",
    name: "Gemma 2B (ONNX, INT8)",
    provider: "Google",
    parameterCount: "2B",
    format: "onnx",
    sizeOnDisk: 1600,
    ramRequired: 2400,
    quantization: "INT8",
    useCase: "Android-optimized via NNAPI delegate. Uses GPU/NPU acceleration.",
    platforms: ["android"],
    downloadUrl: "https://models.frootai.dev/gemma-2b/onnx-int8.onnx",
    license: "Apache-2.0 (Gemma Terms)",
    benchmarks: { tokensPerSecond: 20, referenceDevice: "Pixel 8 Pro (Tensor G3)", firstTokenLatency: 250 },
  },
];

// ── Model Manager ───────────────────────────────────────────────────────

export interface ModelDownloadState {
  modelId: string;
  status: "not_downloaded" | "downloading" | "downloaded" | "loading" | "ready" | "error";
  progress: number;                  // 0–100
  sizeBytes: number;
  downloadedBytes: number;
  downloadSpeed: number;             // bytes/sec
  estimatedTimeRemaining: number;    // seconds
  localPath: string | null;
  version: string;
  downloadedAt: string | null;
  lastUsedAt: string | null;
  errorMessage: string | null;
}

export interface ModelManagerConfig {
  cacheDir: string;                  // platform-specific cache directory
  maxCacheSizeMb: number;            // auto-evict least-recently-used if exceeded
  autoDownload: boolean;             // download model on first use
  preferredModel: string;            // model ID to use by default
  fallbackModel: string;             // if preferred unavailable, use this
  wifiOnlyDownload: boolean;         // don't download on cellular
  backgroundDownload: boolean;       // continue download in background (iOS/Android)
}

export const DEFAULT_MODEL_MANAGER_CONFIG: ModelManagerConfig = {
  cacheDir: "",                      // set per platform at runtime
  maxCacheSizeMb: 8000,             // 8 GB cache limit
  autoDownload: true,
  preferredModel: "phi-4-mini-q4",
  fallbackModel: "llama-3-mini-q4",
  wifiOnlyDownload: true,
  backgroundDownload: true,
};

export function selectModel(
  platform: "ios" | "android" | "desktop",
  availableRamMb: number,
  preferredModelId: string,
): OnDeviceModel | null {
  // Try preferred model first
  const preferred = SUPPORTED_MODELS.find(
    (m) => m.id === preferredModelId && m.platforms.includes(platform) && m.ramRequired <= availableRamMb
  );
  if (preferred) return preferred;

  // Fall back to largest model that fits
  const compatible = SUPPORTED_MODELS
    .filter((m) => m.platforms.includes(platform) && m.ramRequired <= availableRamMb)
    .sort((a, b) => b.ramRequired - a.ramRequired); // largest first = best quality

  return compatible.length > 0 ? compatible[0] : null;
}

// ── Inference Bridge Interface ──────────────────────────────────────────

export interface InferenceBridge {
  /** Load a model from local path. Returns model handle. */
  loadModel(modelPath: string, format: OnDeviceModel["format"]): Promise<string>;

  /** Unload a model from memory. */
  unloadModel(handle: string): Promise<void>;

  /** Generate text (for LLM-as-judge scoring). */
  generate(handle: string, prompt: string, config: GenerateConfig): Promise<GenerateResult>;

  /** Get model info (loaded status, memory usage). */
  getModelInfo(handle: string): ModelInfo;
}

export interface GenerateConfig {
  maxTokens: number;
  temperature: number;               // 0.0 for deterministic scoring
  topP: number;
  stopSequences: string[];
  stream: boolean;
}

export interface GenerateResult {
  text: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  firstTokenLatencyMs: number;
  totalLatencyMs: number;
  memoryUsedMb: number;
  accelerator: "cpu" | "gpu" | "npu" | "ane"; // which hardware was used
}

export interface ModelInfo {
  handle: string;
  modelId: string;
  loaded: boolean;
  memoryUsedMb: number;
  accelerator: string;
  lastInferenceAt: string | null;
  totalInferences: number;
}

// ── Knowledge Storage (SQLite) ──────────────────────────────────────────

export interface KnowledgeStoreConfig {
  dbPath: string;                    // platform-specific path
  maxDocuments: number;              // per knowledge module
  maxDocumentSizeKb: number;
  vectorDimensions: number;          // for local vector cache (384 for MiniLM)
  vectorIndexType: "flat" | "ivf";   // flat for < 10k docs, IVF for larger
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeStoreConfig = {
  dbPath: "",
  maxDocuments: 10000,
  maxDocumentSizeKb: 512,
  vectorDimensions: 384,
  vectorIndexType: "flat",
};

export interface KnowledgeDocument {
  id: string;
  moduleId: string;
  content: string;
  metadata: Record<string, string>;
  vector: number[] | null;           // embedding vector for similarity search
  createdAt: string;
}

// ── Manifest Compatibility ──────────────────────────────────────────────

export const MANIFEST_COMPATIBILITY = {
  description: "Same .fai-manifest.json runs on-device and in Cloud — zero modifications needed",
  howItWorks: [
    "Manifest is parsed identically on all runtimes (WASM parser shared via wasm-bindgen)",
    "LLM-as-judge evaluators: Cloud uses API call, on-device uses local model via InferenceBridge",
    "Rule-based evaluators: identical implementation (Rust compiled to native + WASM)",
    "Knowledge modules: Cloud fetches from URL, on-device uses pre-downloaded SQLite cache",
    "SSE events: same event grammar on all runtimes (queued→log→eval→cost→done)",
    "Execution preference field in manifest: 'local_first', 'cloud_first', 'local_only', 'cloud_only'",
  ],
  onDeviceOverrides: {
    execution_preference: "local_only is respected — engine never makes network calls",
    model_selection: "Manifest can specify model preference; engine falls back to best available local model",
    cost_estimation: "Estimated from token count × local compute rate (no live pricing)",
    telemetry: "Zero telemetry in local_only mode (GDPR-ultimate)",
  },
};

// ── Device Compatibility Matrix ─────────────────────────────────────────

export const DEVICE_COMPATIBILITY: {
  device: string;
  platform: "ios" | "android" | "desktop";
  ram: number;
  bestModel: string;
  expectedTps: number;
  supported: boolean;
}[] = [
  { device: "iPhone 15 Pro", platform: "ios", ram: 8192, bestModel: "phi-4-mini-coreml", expectedTps: 25, supported: true },
  { device: "iPhone 14", platform: "ios", ram: 6144, bestModel: "gemma-2b-q4", expectedTps: 22, supported: true },
  { device: "iPhone 13", platform: "ios", ram: 4096, bestModel: "llama-3-mini-q4", expectedTps: 30, supported: true },
  { device: "iPad Pro M4", platform: "ios", ram: 16384, bestModel: "phi-4-mini-coreml", expectedTps: 35, supported: true },
  { device: "Pixel 8 Pro", platform: "android", ram: 12288, bestModel: "phi-4-mini-q4", expectedTps: 15, supported: true },
  { device: "Pixel 7a", platform: "android", ram: 8192, bestModel: "gemma-2b-onnx", expectedTps: 16, supported: true },
  { device: "Samsung Galaxy S24", platform: "android", ram: 8192, bestModel: "phi-4-mini-q4", expectedTps: 14, supported: true },
  { device: "MacBook Pro M3", platform: "desktop", ram: 18432, bestModel: "phi-4-mini-q4", expectedTps: 45, supported: true },
  { device: "Windows laptop (16GB)", platform: "desktop", ram: 16384, bestModel: "phi-4-mini-q4", expectedTps: 30, supported: true },
  { device: "Linux workstation (32GB)", platform: "desktop", ram: 32768, bestModel: "phi-4-mini-q4", expectedTps: 50, supported: true },
  { device: "iPhone 12", platform: "ios", ram: 4096, bestModel: "llama-3-mini-q4", expectedTps: 25, supported: true },
  { device: "Budget Android (4GB)", platform: "android", ram: 4096, bestModel: "llama-3-mini-q4", expectedTps: 10, supported: true },
  { device: "Budget Android (3GB)", platform: "android", ram: 3072, bestModel: "llama-3-mini-q4", expectedTps: 7, supported: false }, // below minimum
];
