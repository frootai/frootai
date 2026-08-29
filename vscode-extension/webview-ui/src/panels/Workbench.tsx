import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Boxes, ChevronRight, Home, Network, Search, Sprout } from "lucide-react";
import type { AcceleratorView, AccountView, EvalData, KnowledgeModuleView, PrimitiveItem, RepositoryReportView, SolutionPlay } from "../types";
import { vscode } from "../vscode";
import ProductSystemHome from "./ProductSystemHome";
import PlayBrowser from "./PlayBrowser";
import PlayDetail from "./PlayDetail";
import { AcceleratorCatalog, AcceleratorDetail } from "./AcceleratorWorkbench";
import McpWorkbench from "./McpWorkbench";
import { DocsCatalog, DocsReader } from "./DocsWorkbench";
import GlossaryWorkbench from "./GlossaryWorkbench";
import ProductOverview from "./ProductOverview";
import Configurator from "./Configurator";
import Account from "./Account";
import AgentFai from "./AgentFai";
import RepositoryIntelligence from "./RepositoryIntelligence";
import PrimitivesCatalog from "./PrimitivesCatalog";
import Marketplace from "./Marketplace";
import ProtocolExplainer from "./ProtocolExplainer";
import Evaluation from "./Evaluation";
import ScaffoldWizard from "./ScaffoldWizard";

type State = {
  routes: string[];
  modules: KnowledgeModuleView[];
  accelerators: AcceleratorView[];
  acceleratorsLoading: boolean;
  primitives: Record<string, PrimitiveItem[]>;
  plugins: PrimitiveItem[];
  account?: AccountView;
  repositoryReport?: RepositoryReportView;
  repositoryError?: string;
  evalData?: EvalData;
};

export default function Workbench({ initialRoute = "/", plays, account }: { initialRoute?: string; plays: SolutionPlay[]; account?: AccountView }) {
  const restored = vscode.getState<Pick<State, "routes">>();
  const [state, setState] = useState<State>({ routes: restored?.routes?.length ? restored.routes : [initialRoute], modules: [], accelerators: [], acceleratorsLoading: true, primitives: { agents: [], skills: [], instructions: [], hooks: [], plugins: [] }, plugins: [], account });
  const route = state.routes.at(-1) ?? "/";
  const navigate = (next: string, replace = false) => setState((current) => {
    const replaced = replace ? [...current.routes.slice(0, -1), next] : current.routes;
    const routes = replace ? replaced.filter((item, index) => index === 0 || item !== replaced[index - 1]) : current.routes.at(-1) === next ? current.routes : [...current.routes.slice(-29), next];
    vscode.setState({ routes }); window.scrollTo({ top: 0, behavior: "smooth" }); return { ...current, routes };
  });
  const goBack = () => setState((current) => { const routes = current.routes.length > 1 ? current.routes.slice(0, -1) : ["/"]; vscode.setState({ routes }); return { ...current, routes }; });

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === "workbenchNavigate" && typeof message.route === "string") navigate(message.route, Boolean(message.replace));
      if (message?.type === "workbenchHydrate") setState((current) => ({ ...current, modules: message.modules ?? current.modules, accelerators: message.accelerators ?? current.accelerators, acceleratorsLoading: message.acceleratorsLoading ?? current.acceleratorsLoading, primitives: message.primitives ?? current.primitives, plugins: message.plugins ?? current.plugins, account: message.account ?? current.account, evalData: message.evalData ?? current.evalData }));
      if (message?.type === "workbenchRepositoryReport") setState((current) => ({ ...current, repositoryReport: message.report }));
      if (message?.type === "workbenchRepositoryError") setState((current) => ({ ...current, repositoryError: message.message ?? "Repository analysis could not start." }));
  if (message?.type === "agentFaiState" && message.account) setState((current) => ({ ...current, account: message.account }));
    };
    window.addEventListener("message", listener); vscode.postMessage({ command: "workbenchReady", route }); return () => window.removeEventListener("message", listener);
  }, []);

  const crumbs = useMemo(() => breadcrumbs(route, plays, state.modules, state.accelerators), [route, plays, state.accelerators, state.modules]);
  const content = renderRoute();
  return <div className="fai-workbench"><nav className="fai-workbench-nav" aria-label="FrootAI workbench navigation"><button className="fai-workbench-home" onClick={() => navigate("/")}><Home size={14} /><span>FrootAI</span></button><div>{[["/solution-accelerator", "Accelerators", Boxes], ["/solution-plays", "Plays", Sprout], ["/mcp-tooling", "MCP", Network], ["/docs", "Docs", BookOpen], ["/glossary", "Glossary", Search]].map(([path, label, Icon]) => <button key={String(path)} className={route.startsWith(String(path)) ? "active" : ""} onClick={() => navigate(String(path))}><Icon size={13} />{String(label)}</button>)}</div></nav>{route !== "/" && <div className="fai-workbench-breadcrumbs"><button onClick={goBack} aria-label="Go back"><ArrowLeft size={13} /></button>{crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`}>{index > 0 && <ChevronRight size={10} />}{crumb.route && index < crumbs.length - 1 ? <button onClick={() => navigate(crumb.route!)}>{crumb.label}</button> : <strong>{crumb.label}</strong>}</span>)}</div>}<div className="fai-workbench-route" data-workbench-route={route}>{content}</div></div>;

  function renderRoute(): React.ReactNode {
    if (route === "/") return <ProductSystemHome account={state.account} />;
    if (route === "/solution-plays") return <PlayBrowser plays={plays} />;
    if (route.startsWith("/solution-plays/")) {
      const play = plays.find((candidate) => candidate.id === route.split("/")[2] || candidate.dir === route.split("/")[2]);
      return play ? <PlayDetail play={play} /> : <main className="container"><div className="fai-loading-panel">This Solution Play is unavailable. <button className="btn btn-secondary" onClick={() => navigate("/solution-plays", true)}>Browse all Plays</button></div></main>;
    }
    if (route === "/solution-accelerator") return <AcceleratorCatalog entries={state.accelerators} loading={state.acceleratorsLoading} onNavigate={navigate} />;
    if (route.startsWith("/solution-accelerator/")) return <AcceleratorDetail entry={state.accelerators.find((entry) => entry.id === decodeURIComponent(route.slice("/solution-accelerator/".length)))} onNavigate={navigate} />;
    if (route === "/mcp-tooling") return <McpWorkbench onNavigate={navigate} />;
    if (route === "/docs") return <DocsCatalog modules={state.modules} onNavigate={navigate} />;
    if (route.startsWith("/docs/")) { const id = decodeURIComponent(route.split("/")[2]); return <DocsReader module={state.modules.find((module) => module.id.toLowerCase() === id.toLowerCase() || slug(module.title) === id.toLowerCase())} modules={state.modules} onNavigate={navigate} />; }
    if (route === "/glossary") return <GlossaryWorkbench module={state.modules.find((module) => module.id === "F3")} />;
    if (route === "/configurator") return <Configurator plays={plays} />;
    if (route === "/account") return <Account account={state.account} />;
    if (route === "/agent-fai") return <AgentFai account={state.account} />;
    if (route === "/repository-intelligence") return state.repositoryReport ? <RepositoryIntelligence report={state.repositoryReport} /> : <main className="container"><div className="fai-loading-panel">{state.repositoryError ? <><span>{state.repositoryError}</span><button className="btn btn-secondary" onClick={() => { setState((current) => ({ ...current, repositoryError: undefined })); vscode.postMessage({ command: "analyzeRepository" }); }}>Choose workspace</button></> : <><span className="fai-pulse" /> Mapping technology, architecture signals, readiness, and matching Plays…</>}</div></main>;
    if (route === "/primitives" || route.startsWith("/primitives/")) { const [, , category, ...id] = route.split("/"); return <PrimitivesCatalog primitives={state.primitives} initialCategory={category} initialId={id.join("/")} />; }
    if (route === "/marketplace") return <Marketplace plugins={state.plugins} />;
    if (route === "/about") return <ProtocolExplainer logoUri={(window as any).panelData?.logoUri} />;
    if (route === "/evaluation") return <Evaluation evalData={state.evalData} />;
    if (route === "/scaffold") return <ScaffoldWizard plays={plays} />;
    if (["/orchard", "/studio", "/lab", "/lean"].includes(route)) return <ProductOverview product={route.slice(1)} onNavigate={navigate} />;
    return <main className="container"><div className="fai-loading-panel">This FrootAI route is unavailable. <button className="btn btn-secondary" onClick={() => navigate("/")}>Return home</button></div></main>;
  }
}

function breadcrumbs(route: string, plays: SolutionPlay[], modules: KnowledgeModuleView[], accelerators: AcceleratorView[]) {
  const parts: Array<{ label: string; route?: string }> = [{ label: "Home", route: "/" }];
  if (route.startsWith("/solution-plays")) { parts.push({ label: "Solution Plays", route: "/solution-plays" }); const id = route.split("/")[2]; if (id) parts.push({ label: plays.find((play) => play.id === id || play.dir === id)?.name ?? id }); }
  else if (route.startsWith("/solution-accelerator")) { parts.push({ label: "Solution Accelerator", route: "/solution-accelerator" }); const id = route.slice("/solution-accelerator/".length); if (id && route !== "/solution-accelerator") parts.push({ label: accelerators.find((entry) => entry.id === decodeURIComponent(id))?.name ?? decodeURIComponent(id) }); }
  else if (route.startsWith("/docs")) { parts.push({ label: "Docs", route: "/docs" }); const id = route.split("/")[2]; if (id) parts.push({ label: modules.find((module) => module.id.toLowerCase() === id.toLowerCase())?.title ?? id }); }
  else parts.push({ label: route.slice(1).replace(/-/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) });
  return parts;
}
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
