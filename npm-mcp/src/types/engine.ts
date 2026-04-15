export interface EngineResult {
  success: boolean;
  play?: string;
  version?: string;
  context?: EngineContext;
  wiring?: WiringStats;
  guardrails?: Guardrails;
  errors: string[];
  duration: number;
  error?: string;
}

export interface EngineContext {
  scope: string;
  knowledgeCount: number;
  wafCount: number;
  modules: string[];
}

export interface WiringStats {
  agents: number;
  instructions: number;
  skills: number;
  hooks: number;
  workflows: number;
  total: number;
}

export interface Guardrails {
  groundedness: number;
  coherence: number;
  relevance: number;
  safety: number;
  costPerQuery: number;
}

export interface EvaluationResult {
  pass: boolean;
  results: MetricResult[];
  summary: string;
}

export interface MetricResult {
  metric: string;
  score: number;
  threshold: number;
  pass: boolean;
  action: 'ok' | 'retry' | 'warn' | 'block' | 'alert';
}

export interface FaiEngine {
  available: boolean;
  reason?: string;
  runPlay?: (params: { playId?: string; manifestPath?: string }) => EngineResult;
  findManifest?: (playId: string) => string | null;
  initEngine?: (manifestPath: string) => any;
  createEvaluator?: (guardrails: Partial<Guardrails>) => any;
  loadManifest?: (path: string) => { manifest: any; playDir: string; errors: string[] };
  resolvePaths?: (manifest: any, playDir: string) => { resolved: any; missing: string[] };
  buildContext?: (config: any) => any;
  wirePrimitives?: (resolved: any, context: any) => any;
  loadPrimitive?: (path: string, type: string) => any;
}
