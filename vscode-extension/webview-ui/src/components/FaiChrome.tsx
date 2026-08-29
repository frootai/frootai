import type { PanelType } from "../types";

const LABELS: Partial<Record<PanelType, string>> = {
  workbench: "FAI Product System · Single-page Workbench",
  welcome: "FAI Product System",
  account: "Workspace · Account",
  repositoryIntelligence: "Discover · Repository Intelligence",
  playBrowser: "Define · Solution Plays",
  playDetail: "Define · Delivery Contract",
  configurator: "Discover · Configurator",
  primitivesCatalog: "Develop · Primitives",
  marketplace: "Develop · Plugin Marketplace",
  mcpExplorer: "Develop · Model Context Protocol",
  scaffold: "Develop · FAI Toolkit",
  evaluation: "Verify · Evaluation",
  agentFai: "Agent FAI",
  protocolExplainer: "FAI Framework",
  federationExplorer: "Develop · MCP Router",
};

export default function FaiChrome({ panel, logoUri }: { panel: PanelType; logoUri?: string }) {
  return (
    <header className="fai-chrome">
      <div className="fai-brand-lockup">
        {logoUri ? <img src={logoUri} alt="" className="fai-chrome-logo" /> : <span className="fai-brand-mark" aria-hidden="true" />}
        <strong>Froot<span>AI</span></strong>
      </div>
      <div className="fai-chrome-context"><span className="fai-pulse" aria-hidden="true" /><span>{LABELS[panel] ?? "FrootAI Workbench"}</span></div>
      <div className="fai-live"><span /> Native workbench</div>
    </header>
  );
}