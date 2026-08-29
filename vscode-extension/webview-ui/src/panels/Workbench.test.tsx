// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();
let savedState: unknown;
vi.mock("../vscode", () => ({ vscode: { postMessage: (message: unknown) => postMessage(message), getState: () => savedState, setState: (state: unknown) => { savedState = state; } } }));
import Workbench from "./Workbench";
import { parseGlossary } from "./GlossaryWorkbench";
import { parseMarkdown } from "../components/MarkdownDocument";

const plays = [{ id: "01", name: "Enterprise RAG Q&A", dir: "01-enterprise-rag", layer: "R", desc: "Grounded enterprise retrieval", infra: "Azure AI Search · Azure OpenAI", cat: "rag" }];
const modules = [
  { id: "F1", title: "GenAI Foundations", layer: "Foundations", content: "# Foundations\n\nLearn the transformer architecture.\n\n```mermaid\ntimeline\n  2017 : Transformers\n  2026 : Governed agents\n```" },
  { id: "F3", title: "AI Glossary A–Z", layer: "Foundations", content: "# Glossary\n\n## A\n\n### Agent 🌿\nAn AI system that can perceive, plan, and act.\n\n## R\n\n### Retrieval-Augmented Generation 🪵\nGrounds generation in retrieved evidence." },
];
const accelerators = [{ id: "Azure/sample-rag", name: "Sample RAG", fullName: "Azure/sample-rag", description: "A source-backed RAG implementation.", sourceUrl: "https://github.com/Azure/sample-rag", guideUrl: "https://www.frootai.dev/solution-accelerator/azure__sample-rag", stars: 120, forks: 20, language: "Python", topics: ["rag", "search"], updatedAt: "2026-08-01T00:00:00Z", owner: "Azure", license: "MIT", publisher: "microsoft" as const, category: "rag", verificationState: "source_verified" }];

describe("single-page FrootAI workbench", () => {
  beforeEach(() => { postMessage.mockClear(); savedState = undefined; Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true }); });
  afterEach(() => cleanup());

  it("keeps home and primary product navigation in one mounted workbench", () => {
    render(<Workbench plays={plays} account={{ configured: false, status: "disconnected", redacted: null, lastError: null }} />);
    expect(screen.getByText("Unified Fabric for AI")).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith({ command: "workbenchReady", route: "/" });
    fireEvent.click(screen.getByRole("button", { name: /^Accelerators$/i }));
    expect(screen.getByRole("heading", { name: "FAI Solution Accelerator" })).toBeInTheDocument();
    expect(document.querySelectorAll(".fai-workbench")).toHaveLength(1);
  });

  it("hydrates canonical data and opens accelerator cards and Play cards in place", () => {
    render(<Workbench plays={plays} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "workbenchHydrate", modules, accelerators, acceleratorsLoading: false } }));
    fireEvent.click(screen.getByRole("button", { name: /^Accelerators$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sample RAG/i }));
    expect(screen.getByRole("heading", { name: "Sample RAG" })).toBeInTheDocument();
    expect(screen.getByText("Azure/sample-rag")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Download repository \.github/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "installAcceleratorAssets", acceleratorId: "Azure/sample-rag" });
    fireEvent.click(screen.getByRole("button", { name: /Clone repository/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "cloneAccelerator", acceleratorId: "Azure/sample-rag" });
    expect(screen.queryByRole("button", { name: /Open implementation guide/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Download repository \.github/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "installAcceleratorAssets", acceleratorId: "Azure/sample-rag" });
    fireEvent.click(screen.getByRole("button", { name: /^Plays$/i }));
    fireEvent.click(screen.getByRole("button", { name: /View Play \+ Guide/i }));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: "navigate", panel: "playDetail" }));
    fireEvent(window, new MessageEvent("message", { data: { type: "workbenchNavigate", route: "/solution-plays/01" } }));
    expect(screen.getByRole("heading", { name: /Enterprise RAG Q&A/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Play 01/i).length).toBeGreaterThan(0);
  });

  it("renders Docs as a full catalog and reader with graphical Mermaid", () => {
    render(<Workbench plays={plays} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "workbenchHydrate", modules } }));
    fireEvent.click(screen.getByRole("button", { name: /^Docs$/i }));
    expect(screen.getByRole("heading", { name: /Understand the stack/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /GenAI Foundations/i }));
    expect(screen.getByRole("heading", { name: "GenAI Foundations" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rendered solution architecture")).toBeInTheDocument();
    expect(screen.queryByText("timeline", { exact: true })).not.toBeInTheDocument();
  });

  it("renders the searchable A-Z glossary as cards rather than dropdowns", () => {
    render(<Workbench plays={plays} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "workbenchHydrate", modules } }));
    fireEvent.click(screen.getByRole("button", { name: /^Glossary$/i }));
    expect(screen.getByRole("heading", { name: "AI Glossary A–Z" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Agent/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search glossary"), { target: { value: "retrieval" } });
    expect(screen.getByRole("heading", { name: /Retrieval-Augmented Generation/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Agent$/i })).not.toBeInTheDocument();
  });

  it("renders the federation-router MCP page natively", () => {
    render(<Workbench plays={plays} initialRoute="/mcp-tooling" />);
    expect(screen.getByRole("heading", { name: "FAI MCP Server" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Six tools govern every connection/i })).toBeInTheDocument();
    expect(screen.getByText("fai_attach_mcp")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Azure MCP")).toBeInTheDocument();
  });
});

describe("rendering parsers", () => {
  it("parses glossary layers and rich markdown blocks", () => {
    expect(parseGlossary(modules[1].content).flatMap((group) => group.terms).map((term) => term.layer)).toEqual(["Orchestration", "Reasoning"]);
    expect(parseMarkdown("# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```mermaid\ngraph TD\nA-->B\n```").map((block) => block.type)).toEqual(["heading", "table", "code"]);
  });
});
