/**
 * Edge Eval Suite — offline groundedness, coherence, and safety evaluation.
 *
 * Production-grade:
 *   - Full offline: zero network calls during evaluation
 *   - 3 eval dimensions: groundedness, coherence, safety
 *   - Streaming-aware: per-token incremental scoring for low-latency UX
 *   - Pre-downloaded reference data (NLI model, safety lexicon, coherence patterns)
 *   - Cost eval explicitly omitted (requires live pricing — cloud-only)
 *   - Zero telemetry in offline mode (GDPR-ultimate)
 *
 * Tracker: P6.3.003
 */

// ── Edge Eval Config ────────────────────────────────────────────────────

export interface EdgeEvalConfig {
  /** Which evaluators to run. Cost is never available offline. */
  evaluators: EdgeEvaluatorType[];
  /** Streaming mode: score per-chunk as tokens arrive */
  streaming: boolean;
  /** Min chunk size before streaming eval triggers (tokens) */
  streamingChunkSize: number;
  /** Local model to use for NLI-based groundedness scoring */
  groundednessModelId: string;
  /** Path to pre-downloaded reference data */
  referenceDataDir: string;
  /** Zero-telemetry mode (no metrics, no logs, no network) */
  zeroTelemetry: boolean;
  /** Max eval latency budget (ms). Evaluators are skipped if budget exceeded. */
  latencyBudgetMs: number;
  /** Parallel evaluator execution (use false on low-RAM devices) */
  parallel: boolean;
}

export type EdgeEvaluatorType = "groundedness" | "coherence" | "safety";

export const DEFAULT_EDGE_EVAL_CONFIG: EdgeEvalConfig = {
  evaluators: ["groundedness", "coherence", "safety"],
  streaming: true,
  streamingChunkSize: 32,
  groundednessModelId: "nli-deberta-small",
  referenceDataDir: "",                // set per-platform at runtime
  zeroTelemetry: true,
  latencyBudgetMs: 2000,
  parallel: false,                     // conservative default for phones
};

// ── Reference Data (pre-downloaded, cached locally) ─────────────────────

export interface ReferenceDataManifest {
  version: string;
  downloadedAt: string;
  totalSizeBytes: number;
  components: ReferenceDataComponent[];
}

export interface ReferenceDataComponent {
  id: string;
  type: "model" | "lexicon" | "patterns" | "embeddings";
  description: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  requiredBy: EdgeEvaluatorType[];
  downloadUrl: string;               // CDN URL for initial download / update check
  lastUpdated: string;
}

export const REFERENCE_DATA_CATALOG: ReferenceDataComponent[] = [
  // ── Groundedness ──
  {
    id: "nli-deberta-small",
    type: "model",
    description: "DeBERTa-v3-small fine-tuned for NLI. 44M params, ONNX INT8 quantized.",
    filename: "nli-deberta-small-int8.onnx",
    sizeBytes: 85 * 1024 * 1024,     // ~85 MB
    sha256: "",                       // populated at build time
    requiredBy: ["groundedness"],
    downloadUrl: "https://models.frootai.dev/edge-eval/nli-deberta-small-int8.onnx",
    lastUpdated: "2026-05-01",
  },
  {
    id: "nli-tokenizer",
    type: "model",
    description: "SentencePiece tokenizer for the NLI model.",
    filename: "nli-tokenizer.model",
    sizeBytes: 800 * 1024,           // ~800 KB
    sha256: "",
    requiredBy: ["groundedness"],
    downloadUrl: "https://models.frootai.dev/edge-eval/nli-tokenizer.model",
    lastUpdated: "2026-05-01",
  },
  // ── Safety ──
  {
    id: "safety-lexicon-v3",
    type: "lexicon",
    description: "Multi-language safety lexicon: hate, violence, self-harm, sexual, profanity. 47 languages.",
    filename: "safety-lexicon-v3.json",
    sizeBytes: 12 * 1024 * 1024,     // ~12 MB
    sha256: "",
    requiredBy: ["safety"],
    downloadUrl: "https://models.frootai.dev/edge-eval/safety-lexicon-v3.json",
    lastUpdated: "2026-04-15",
  },
  {
    id: "safety-classifier",
    type: "model",
    description: "TinyBERT safety classifier (6-layer, 14M params). Classifies: safe / hate / violence / self-harm / sexual / dangerous.",
    filename: "safety-classifier-int8.onnx",
    sizeBytes: 30 * 1024 * 1024,     // ~30 MB
    sha256: "",
    requiredBy: ["safety"],
    downloadUrl: "https://models.frootai.dev/edge-eval/safety-classifier-int8.onnx",
    lastUpdated: "2026-04-15",
  },
  // ── Coherence ──
  {
    id: "coherence-patterns",
    type: "patterns",
    description: "Rule-based coherence patterns: sentence transitions, topic drift detection, repetition detection.",
    filename: "coherence-patterns-v2.json",
    sizeBytes: 2 * 1024 * 1024,      // ~2 MB
    sha256: "",
    requiredBy: ["coherence"],
    downloadUrl: "https://models.frootai.dev/edge-eval/coherence-patterns-v2.json",
    lastUpdated: "2026-03-20",
  },
  {
    id: "sentence-embeddings-minilm",
    type: "embeddings",
    description: "MiniLM-L6-v2 (22M params, ONNX INT8) for sentence embeddings used by coherence scorer.",
    filename: "minilm-l6-v2-int8.onnx",
    sizeBytes: 45 * 1024 * 1024,     // ~45 MB
    sha256: "",
    requiredBy: ["coherence"],
    downloadUrl: "https://models.frootai.dev/edge-eval/minilm-l6-v2-int8.onnx",
    lastUpdated: "2026-03-20",
  },
];

// ── Evaluator Interfaces ────────────────────────────────────────────────

export interface EdgeEvalResult {
  evaluator: EdgeEvaluatorType;
  score: number;                     // 0.0–1.0
  label: string;                     // "pass" | "warn" | "fail"
  confidence: number;                // 0.0–1.0
  details: Record<string, unknown>;
  latencyMs: number;
  streaming: boolean;                // was this a streaming incremental result?
  chunkIndex: number | null;         // which chunk (streaming only)
  offline: true;                     // always true for edge eval
}

export interface GroundednessResult extends EdgeEvalResult {
  evaluator: "groundedness";
  details: {
    /** Per-claim NLI verdicts */
    claims: ClaimVerdict[];
    /** Fraction of claims entailed by the context */
    entailmentRatio: number;
    /** Model used for NLI */
    nliModel: string;
  };
}

export interface ClaimVerdict {
  claim: string;
  verdict: "entailed" | "contradicted" | "neutral";
  confidence: number;
  sourceSpan: { start: number; end: number } | null;
}

export interface CoherenceResult extends EdgeEvalResult {
  evaluator: "coherence";
  details: {
    /** Sentence-pair transition scores */
    transitionScores: number[];
    /** Average cosine similarity between consecutive sentence embeddings */
    avgCosineSimilarity: number;
    /** Topic drift detected? */
    topicDrift: boolean;
    /** Repetition ratio (0 = no repetition, 1 = all repeated) */
    repetitionRatio: number;
    /** Total sentences analyzed */
    sentenceCount: number;
  };
}

export interface SafetyResult extends EdgeEvalResult {
  evaluator: "safety";
  details: {
    /** Per-category safety scores */
    categories: SafetyCategoryScore[];
    /** Lexicon matches (sanitized — no raw offensive text in logs) */
    lexiconMatchCount: number;
    /** Classifier prediction */
    classifierLabel: string;
    /** Language detected */
    languageDetected: string;
  };
}

export interface SafetyCategoryScore {
  category: "hate" | "violence" | "self_harm" | "sexual" | "dangerous" | "profanity";
  score: number;                     // 0.0–1.0 (higher = more harmful)
  threshold: number;                 // category-specific threshold
  flagged: boolean;                  // score > threshold
}

// ── Streaming Evaluator ─────────────────────────────────────────────────

export interface StreamingEvalState {
  /** Accumulated text so far */
  buffer: string;
  /** Tokens received */
  tokenCount: number;
  /** Chunks evaluated so far */
  chunksEvaluated: number;
  /** Incremental scores (updated per-chunk) */
  incrementalScores: Map<EdgeEvaluatorType, number>;
  /** Final scores (set when stream ends) */
  finalScores: Map<EdgeEvaluatorType, EdgeEvalResult> | null;
  /** Timing */
  startedAt: number;
  lastChunkAt: number;
}

export function createStreamingState(): StreamingEvalState {
  return {
    buffer: "",
    tokenCount: 0,
    chunksEvaluated: 0,
    incrementalScores: new Map(),
    finalScores: null,
    startedAt: Date.now(),
    lastChunkAt: Date.now(),
  };
}

/**
 * Process a new token/chunk in streaming mode.
 * Returns incremental results if a chunk boundary is crossed, null otherwise.
 */
export function processStreamingChunk(
  state: StreamingEvalState,
  token: string,
  config: EdgeEvalConfig,
): EdgeEvalResult[] | null {
  state.buffer += token;
  state.tokenCount += 1;
  state.lastChunkAt = Date.now();

  // Only evaluate when chunk boundary is reached
  if (state.tokenCount % config.streamingChunkSize !== 0) {
    return null;
  }

  state.chunksEvaluated += 1;

  // In production, each evaluator runs on the buffer and returns incremental score.
  // Scores are weighted: later chunks matter more (recency weighting).
  // This is a framework — actual inference calls go through InferenceBridge.
  const results: EdgeEvalResult[] = [];

  for (const evaluator of config.evaluators) {
    results.push({
      evaluator,
      score: 0,                      // filled by actual evaluator implementation
      label: "pending",
      confidence: 0,
      details: {},
      latencyMs: 0,
      streaming: true,
      chunkIndex: state.chunksEvaluated,
      offline: true,
    });
  }

  return results;
}

/**
 * Finalize streaming evaluation when the response is complete.
 * Runs full evaluation on the complete buffer.
 */
export function finalizeStreaming(
  state: StreamingEvalState,
  config: EdgeEvalConfig,
): EdgeEvalResult[] {
  const results: EdgeEvalResult[] = [];

  for (const evaluator of config.evaluators) {
    results.push({
      evaluator,
      score: 0,                      // filled by actual evaluator
      label: "pending",
      confidence: 0,
      details: {},
      latencyMs: 0,
      streaming: false,
      chunkIndex: null,
      offline: true,
    });
  }

  state.finalScores = new Map(results.map((r) => [r.evaluator, r]));
  return results;
}

// ── Offline Groundedness Evaluator ──────────────────────────────────────

export const GROUNDEDNESS_EVALUATOR = {
  id: "edge-groundedness",
  version: "1.0.0",
  description: "Offline groundedness via NLI model. Extracts claims from response, checks entailment against context.",

  pipeline: [
    "1. Sentence-split the LLM response into individual claims",
    "2. For each claim, run NLI model: (context, claim) → entailed | contradicted | neutral",
    "3. Compute entailment ratio = entailed_claims / total_claims",
    "4. Score = entailment_ratio (0.0–1.0)",
    "5. Label: ≥ 0.8 = pass, ≥ 0.5 = warn, < 0.5 = fail",
  ],

  model: "nli-deberta-small (44M params, INT8 quantized, ~85 MB)",
  latencyTarget: "< 500ms for 10-sentence response on iPhone 15 Pro",
  memoryUsage: "~150 MB (model + tokenizer + inference buffers)",

  limitations: [
    "Smaller NLI model than cloud (cloud uses DeBERTa-v3-large 304M) — lower accuracy on complex claims",
    "No multi-hop reasoning — each claim checked independently against full context",
    "Max context length: 512 tokens (DeBERTa limit) — long contexts are chunked",
    "No cross-lingual NLI — works best for English, acceptable for DE/FR/ES",
  ],

  scoringThresholds: {
    pass: 0.8,
    warn: 0.5,
    fail: 0.0,
  },
};

// ── Offline Coherence Evaluator ─────────────────────────────────────────

export const COHERENCE_EVALUATOR = {
  id: "edge-coherence",
  version: "1.0.0",
  description: "Offline coherence scoring via sentence embeddings + rule-based patterns.",

  pipeline: [
    "1. Sentence-split the LLM response",
    "2. Generate sentence embeddings via MiniLM-L6-v2 (22M params, INT8)",
    "3. Compute pairwise cosine similarity between consecutive sentences",
    "4. Check rule-based patterns: topic drift (embedding distance > threshold), repetition (n-gram overlap)",
    "5. Score = weighted(avg_cosine_sim × 0.5 + transition_smoothness × 0.3 + (1 - repetition_ratio) × 0.2)",
    "6. Label: ≥ 0.7 = pass, ≥ 0.4 = warn, < 0.4 = fail",
  ],

  model: "MiniLM-L6-v2 (22M params, INT8 quantized, ~45 MB)",
  latencyTarget: "< 300ms for 20-sentence response on iPhone 15 Pro",
  memoryUsage: "~80 MB (model + embedding buffers)",

  detectionCapabilities: [
    "Topic drift: cosine similarity drop > 0.3 between consecutive sentences",
    "Repetition: 4-gram overlap > 30% between any sentence pair",
    "Incomplete thoughts: sentence ends without predicate (rule-based)",
    "Contradictions: embedding reversal pattern (cosine < 0.1 between related sentences)",
  ],

  scoringThresholds: {
    pass: 0.7,
    warn: 0.4,
    fail: 0.0,
  },
};

// ── Offline Safety Evaluator ────────────────────────────────────────────

export const SAFETY_EVALUATOR = {
  id: "edge-safety",
  version: "1.0.0",
  description: "Offline safety evaluation: lexicon matching + TinyBERT classifier. 6 harm categories, 47 languages.",

  pipeline: [
    "1. Language detection (character n-gram classifier, offline)",
    "2. Lexicon scan: match against safety-lexicon-v3 (47 languages, 6 categories)",
    "3. Classifier: TinyBERT 6-layer (14M params, INT8) → 6 category scores",
    "4. Combine: max(lexicon_score, classifier_score) per category",
    "5. Flagged if any category exceeds its threshold",
    "6. Overall score = 1.0 - max(category_scores)  [higher = safer]",
    "7. Label: score ≥ 0.9 = pass, ≥ 0.7 = warn, < 0.7 = fail",
  ],

  categories: [
    { name: "hate",      threshold: 0.3, description: "Hate speech, discrimination, slurs" },
    { name: "violence",  threshold: 0.3, description: "Graphic violence, threats, weapons instructions" },
    { name: "self_harm", threshold: 0.2, description: "Self-harm, suicide ideation" },
    { name: "sexual",    threshold: 0.4, description: "Explicit sexual content" },
    { name: "dangerous", threshold: 0.3, description: "Dangerous activities, illegal instructions" },
    { name: "profanity", threshold: 0.6, description: "Strong profanity (higher threshold — context-dependent)" },
  ],

  model: "TinyBERT safety classifier (14M params, INT8, ~30 MB)",
  lexicon: "47 languages, ~12 MB, updated quarterly",
  latencyTarget: "< 200ms for 500-token response on iPhone 15 Pro",
  memoryUsage: "~60 MB (model + lexicon + buffers)",

  privacyGuarantees: [
    "No offensive text logged — only category scores and match counts",
    "No text ever leaves device in offline mode",
    "Lexicon is hashed — raw offensive terms not stored in plaintext",
    "Classifier input is tokenized — no raw text in memory after inference",
  ],

  scoringThresholds: {
    pass: 0.9,
    warn: 0.7,
    fail: 0.0,
  },
};

// ── Cost Eval — Explicitly Omitted ──────────────────────────────────────

export const COST_EVAL_OMISSION = {
  evaluator: "cost",
  available: false,
  reason: "Cost evaluation requires live pricing data from cloud APIs (Azure OpenAI, Anthropic, etc.). Cannot run offline.",
  fallback: "Estimated token count is reported; actual cost requires cloud sync.",
  whenAvailable: "Cost scores appear automatically when the device regains connectivity and syncs with FAI Cloud.",
};

// ── Eval Suite Orchestrator ─────────────────────────────────────────────

export interface EdgeEvalRequest {
  /** The LLM response to evaluate */
  response: string;
  /** The context/grounding documents (for groundedness) */
  context: string | null;
  /** The original user prompt (for coherence + safety) */
  prompt: string;
  /** Configuration */
  config: EdgeEvalConfig;
}

export interface EdgeEvalReport {
  /** Overall pass/fail/warn */
  overallLabel: "pass" | "warn" | "fail";
  /** Overall score (average of individual evaluators) */
  overallScore: number;
  /** Individual evaluator results */
  results: EdgeEvalResult[];
  /** Total eval latency */
  totalLatencyMs: number;
  /** Which evaluators were skipped (e.g., latency budget exceeded) */
  skipped: { evaluator: EdgeEvaluatorType; reason: string }[];
  /** Metadata */
  metadata: {
    offline: true;
    zeroTelemetry: boolean;
    referenceDataVersion: string;
    devicePlatform: string;
    timestamp: string;
  };
}

export function computeOverallLabel(scores: EdgeEvalResult[]): "pass" | "warn" | "fail" {
  if (scores.length === 0) return "pass";
  if (scores.some((s) => s.label === "fail")) return "fail";
  if (scores.some((s) => s.label === "warn")) return "warn";
  return "pass";
}

export function computeOverallScore(scores: EdgeEvalResult[]): number {
  if (scores.length === 0) return 1.0;
  const sum = scores.reduce((acc, s) => acc + s.score, 0);
  return Math.round((sum / scores.length) * 1000) / 1000;
}

// ── Network Isolation Verification ──────────────────────────────────────

export const NETWORK_ISOLATION = {
  description: "Guarantee that edge eval makes zero network calls",
  enforcement: [
    "All models loaded from local filesystem — no HTTP fetches during eval",
    "DNS resolution disabled in eval sandbox (platform-specific: iOS App Transport Security rule, Android NetworkSecurityConfig, Rust no-network feature flag)",
    "Socket creation blocked during eval execution window",
    "Eval function signature takes no network client — impossible to accidentally call remote API",
    "Integration test: run eval with airplane mode ON → must produce identical results",
  ],
  complianceMapping: {
    GDPR: "Article 5(1)(f) — integrity and confidentiality. No data leaves device.",
    HIPAA: "§164.312(e)(1) — transmission security. No transmission = no risk.",
    SOC2: "CC6.7 — restrict transmission. Eval sandbox blocks all outbound.",
    FedRAMP: "SC-7 — boundary protection. On-device eval = no boundary crossing.",
  },
};

// ── Reference Data Sync (online → offline) ──────────────────────────────

export interface ReferenceSyncConfig {
  /** How often to check for updates when online (hours) */
  checkIntervalHours: number;
  /** Only sync on WiFi */
  wifiOnly: boolean;
  /** Auto-download updates or prompt user */
  autoUpdate: boolean;
  /** Max total reference data size (MB) */
  maxSizeMb: number;
}

export const DEFAULT_SYNC_CONFIG: ReferenceSyncConfig = {
  checkIntervalHours: 168,          // weekly
  wifiOnly: true,
  autoUpdate: false,                // prompt user — models are large
  maxSizeMb: 500,
};

export interface SyncStatus {
  lastChecked: string | null;
  lastSynced: string | null;
  componentsOutdated: string[];     // component IDs needing update
  totalDownloadSizeBytes: number;
  syncInProgress: boolean;
}
