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

export type PanelType = "playDetail" | "evaluation" | "scaffold" | "mcpExplorer";

export interface PanelData {
  panel: PanelType;
  play?: SolutionPlay;
  scores?: Record<string, number>;
  tools?: McpTool[];
  plays?: SolutionPlay[];
}
