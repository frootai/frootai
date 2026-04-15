export type Complexity = 'Low' | 'Medium' | 'High' | 'Very High' | 'Foundation';

export interface PlayData {
  id: string;
  name: string;
  services: string[];
  pattern: string;
  cx: Complexity;
}

export interface ServicePricing {
  dev: number;
  prod: number;
  unit: string;
}

export interface CostEstimate {
  play: PlayData;
  scale: 'dev' | 'prod';
  services: Array<{ name: string; cost: number; unit: string }>;
  total: number;
}
