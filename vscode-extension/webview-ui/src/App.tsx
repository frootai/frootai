import { useState, useEffect } from "react";
import type { PanelData } from "./types";
import PlayDetail from "./panels/PlayDetail";
import PlayBrowser from "./panels/PlayBrowser";
import Configurator from "./panels/Configurator";
import Evaluation from "./panels/Evaluation";
import ScaffoldWizard from "./panels/ScaffoldWizard";
import McpExplorer from "./panels/McpExplorer";

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
    default:
      return <div className="container"><p>Unknown panel: {data.panel}</p></div>;
  }
}
