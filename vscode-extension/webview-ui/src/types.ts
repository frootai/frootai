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
}

export interface PlayCategory {
  id: string;
  label: string;
  icon: string;
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

export type PanelType = "playDetail" | "evaluation" | "scaffold" | "mcpExplorer" | "playBrowser" | "configurator";

export interface PanelData {
  panel: PanelType;
  play?: SolutionPlay;
  scores?: Record<string, number>;
  tools?: McpTool[];
  plays?: SolutionPlay[];
}
