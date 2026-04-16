import { useState, useEffect } from "react";
import type { PanelData } from "./types";
import PlayDetail from "./panels/PlayDetail";
import PlayBrowser from "./panels/PlayBrowser";
import Configurator from "./panels/Configurator";
import Evaluation from "./panels/Evaluation";
import ScaffoldWizard from "./panels/ScaffoldWizard";
import McpExplorer from "./panels/McpExplorer";
import Welcome from "./panels/Welcome";
import PrimitivesCatalog from "./panels/PrimitivesCatalog";
import Marketplace from "./panels/Marketplace";
import AgentFai from "./panels/AgentFai";

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

  switch (data.panel) {
    case "playDetail":
      return <PlayDetail play={data.play} />;
    case "playBrowser":
      return <PlayBrowser plays={data.plays ?? []} />;
    case "configurator":
      return <Configurator plays={data.plays ?? []} />;
    case "evaluation":
      return <Evaluation scores={data.scores} />;
    case "scaffold":
      return <ScaffoldWizard plays={data.plays ?? []} />;
    case "mcpExplorer":
      return <McpExplorer tools={data.tools ?? []} />;
    case "welcome":
      return <Welcome />;
    case "primitivesCatalog":
      return <PrimitivesCatalog primitives={data.primitives ?? { agents: [], skills: [], instructions: [], hooks: [], plugins: [] }} />;
    case "marketplace":
      return <Marketplace plugins={data.plugins ?? []} />;
    case "agentFai":
      return <AgentFai />;
    default:
      return <div className="container"><p>Unknown panel: {data.panel}</p></div>;
  }
}
