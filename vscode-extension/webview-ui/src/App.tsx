import { useState, useEffect } from "react";
import type { PanelData } from "./types";
import PlayDetail from "./panels/PlayDetail";
import PlayBrowser from "./panels/PlayBrowser";
import Configurator from "./panels/Configurator";
import Evaluation from "./panels/Evaluation";
import ScaffoldWizard from "./panels/ScaffoldWizard";
import McpExplorer from "./panels/McpExplorer";
import ProductSystemHome from "./panels/ProductSystemHome";
import Account from "./panels/Account";
import RepositoryIntelligence from "./panels/RepositoryIntelligence";
import PrimitivesCatalog from "./panels/PrimitivesCatalog";
import Marketplace from "./panels/Marketplace";
import AgentFai from "./panels/AgentFai";
import ProtocolExplainer from "./panels/ProtocolExplainer";
import FederationExplorer from "./panels/FederationExplorer";
import FaiChrome from "./components/FaiChrome";
import Workbench from "./panels/Workbench";

declare global {
  interface Window {
    panelData?: PanelData;
  }
}

export default function App() {
  const [data, setData] = useState<PanelData>(
    window.panelData ?? { panel: "playDetail" }
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "update") {
        setData(msg.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  let content: React.ReactNode;
  switch (data.panel) {
    case "workbench":
      content = <Workbench initialRoute={data.route} plays={data.plays ?? []} account={data.account} />; break;
    case "playDetail":
      content = <PlayDetail play={data.play} />; break;
    case "playBrowser":
      content = <PlayBrowser plays={data.plays ?? []} />; break;
    case "configurator":
      content = <Configurator plays={data.plays ?? []} />; break;
    case "evaluation":
      content = <Evaluation evalData={data.evalData} />; break;
    case "scaffold":
      content = <ScaffoldWizard plays={data.plays ?? []} />; break;
    case "mcpExplorer":
      content = <McpExplorer tools={data.tools ?? []} />; break;
    case "welcome":
      content = <ProductSystemHome account={data.account} />; break;
    case "account":
      content = <Account account={data.account} />; break;
    case "repositoryIntelligence":
      content = <RepositoryIntelligence report={data.repositoryReport} />; break;
    case "primitivesCatalog":
      content = <PrimitivesCatalog primitives={data.primitives ?? { agents: [], skills: [], instructions: [], hooks: [], plugins: [] }} />; break;
    case "marketplace":
      content = <Marketplace plugins={data.plugins ?? []} />; break;
    case "agentFai":
      content = <AgentFai initialMessages={data.agentMessages} account={data.account} />; break;
    case "protocolExplainer":
      content = <ProtocolExplainer logoUri={data.logoUri} />; break;
    case "federationExplorer":
      content = (
        <FederationExplorer
          initialMarketplace={data.federationMarketplace}
          initialAttached={data.federationAttached}
          initialTab={data.federationInitialTab}
        />
      ); break;
    default:
      content = <div className="container"><p>Unknown panel: {data.panel}</p></div>;
  }
  return <div className={`fai-app-shell fai-panel-${data.panel}`}><FaiChrome panel={data.panel} logoUri={data.logoUri} /><div className="fai-page">{content}</div></div>;
}
