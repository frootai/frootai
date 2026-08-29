export interface SolutionPlay {
  id: string;
  name: string;
  icon?: string;
  codicon?: string;
  status?: string;
  dir: string;
  layer: string;
  desc?: string;
  cx?: string;
  infra?: string;
  cat?: string;
  slug?: string;
  tagline?: string;
  pattern?: string;
  devkit?: string[];
  tunekit?: string[];
  tuningParams?: string[];
  costDev?: string;
  costProd?: string;
  certification?: SolutionPlayCertification;
}

export type SolutionPlayCertificationLevel = "designed" | "scaffold_verified" | "build_verified" | "evaluation_verified" | "deploy_verified" | "production_observed";

export interface SolutionPlayCertification {
  id: string;
  slug: string;
  level: SolutionPlayCertificationLevel | null;
  valid: boolean;
  reasons: string[];
  commit_sha: string;
  profile: string;
  expires_at: string;
}

export interface PlayCategory {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  color: string;
}

export interface ConfigQuestion {
  q: string;
  options: { label: string; tags: string[]; icon: string; color: string }[];
}

export interface ConfigRecommendation {
  plays: string[];
  why: string;
}

export interface McpTool {
  name: string;
  description: string;
  category: string;
  readOnly: boolean;
}

export interface KnowledgeModuleView {
  id: string;
  title: string;
  layer: string;
  content: string;
}

export interface AcceleratorView {
  id: string;
  name: string;
  fullName: string;
  description: string;
  sourceUrl: string;
  guideUrl: string | null;
  stars: number | null;
  forks: number | null;
  language: string;
  topics: string[];
  updatedAt: string | null;
  owner: string;
  license: string;
  publisher: "frootai" | "microsoft" | "google" | "aws" | "community";
  category: string;
  verificationState: string;
  playId?: string;
}

export interface EvalMetric {
  name: string;
  score: number;
  threshold: number;
  icon: string;
}

export interface WafPillar {
  name: string;
  icon: string;
  color: string;
}

export type PanelType = "workbench" | "playDetail" | "evaluation" | "scaffold" | "mcpExplorer" | "playBrowser" | "configurator" | "welcome" | "account" | "repositoryIntelligence" | "primitivesCatalog" | "marketplace" | "agentFai" | "protocolExplainer" | "federationExplorer";

export interface AccountView { configured: boolean; status: "disconnected" | "configured" | "verified" | "invalid"; redacted: string | null; lastError: string | null }
export interface RepositoryReportView { name: string; fileCount: number; inspectedMetadataCount: number; truncated: boolean; generatedAt: string; source: "local-read-only"; recommendationMode: "evidence-ranked" | "generic-starters"; signals: Array<{ id: string; label: string; evidence: string[] }>; technologies: Array<{ name: string; files: number; evidence: string[] }>; readiness: Array<{ id: string; label: string; status: "detected" | "gap"; detail: string; evidence: string[] }>; recommendations: Array<{ play: SolutionPlay; score: number; reasons: string[] }> }

export interface PrimitiveItem {
  id: string;
  name?: string;
  description?: string;
  file?: string;
  folder?: string;
  waf?: string[];
  applyTo?: string;
  events?: string[];
  size?: number;
  version?: string;
  keywords?: string[];
  plays?: string[];
  items?: number;
}

export interface PanelData {
  panel: PanelType;
  route?: string;
  play?: SolutionPlay;
  scores?: Record<string, number>;
  tools?: McpTool[];
  plays?: SolutionPlay[];
  primitives?: Record<string, PrimitiveItem[]>;
  plugins?: any[];
  logoUri?: string;
  evalData?: EvalData;
  account?: AccountView;
  agentMessages?: Array<{ role: "user" | "assistant"; content: string; createdAt: string }>;
  repositoryReport?: RepositoryReportView;
  knowledgeModules?: KnowledgeModuleView[];
  accelerators?: AcceleratorView[];
  // [M5.12] Federation Explorer panel payload.
  federationMarketplace?: Array<{
    slug: string;
    name?: string;
    owner?: string;
    desc?: string;
    trust?: string;
    installs?: number;
  }>;
  federationAttached?: Array<{
    name: string;
    trust?: string;
    toolCount?: number;
    idleMinutes?: number;
    attachedAt?: string;
  }>;
  federationInitialTab?: "attached" | "catalog";
}

export interface EvalData {
  hasRealData: boolean;
  scores: Record<string, number>;
  thresholds: Record<string, number>;
  history: Array<{ label: string; date?: string; scores: Record<string, number> }>;
  configPath?: string;
  hasEvalPy?: boolean;
  hasTestSet?: boolean;
  resultFiles?: string[];
}
