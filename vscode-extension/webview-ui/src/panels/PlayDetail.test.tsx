// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock the vscode wrapper BEFORE importing PlayDetail
const postMessageMock = vi.fn();
vi.mock("../vscode", () => ({
    vscode: { postMessage: (msg: unknown) => postMessageMock(msg) },
}));
import { parseFlowchart } from "../components/MermaidDiagram";
import PlayDetail, { normalizeArchitectureMarkdown, parseArchitectureBlocks } from "./PlayDetail";

const mockPlay = {
    id: "01",
    name: "Enterprise RAG Q&A",
    dir: "01-enterprise-rag",
    layer: "R",
    desc: "Production RAG pipeline",
    cx: "Medium",
    infra: "AI Search · Azure OpenAI",
    costDev: "$200-500",
    costProd: "$2000-5000",
};

describe("PlayDetail Tool Engineering and colocated actions", () => {
    beforeEach(() => {
        postMessageMock.mockClear();
        (window as any).panelData = { logoUri: "" };
    });

    afterEach(() => {
        cleanup();
    });

    // --- FULL PACKAGES (user reports these WORK) ---
    it("Initialize DevKit fires initDevKit", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize DevKit"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "initDevKit", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("Initialize TuneKit fires initTuneKit", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize TuneKit"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "initTuneKit", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("Initialize SpecKit fires initSpecKit", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize SpecKit"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "initSpecKit", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("installs the complete six-surface toolbox in one action", () => {
        render(<PlayDetail play={mockPlay} />);
        expect(screen.getByText("Complete Play Toolbox")).toBeInTheDocument();
        for (const item of ["DevKit", "TuneKit", "SpecKit", "Hooks", "Prompts", "Plugin"]) expect(screen.getAllByText(item).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: /Install Complete Toolbox/i }));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "installToolbox", playId: "01", playDir: "01-enterprise-rag" });
    });

    // --- STANDALONE (user reports these are BROKEN) ---
    it("Initialize Hooks fires initHooks", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize Hooks"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "initHooks", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("Initialize Prompts fires initPrompts", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize Prompts"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "initPrompts", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("Install as Plugin fires installPlugin", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Install as Plugin"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "installPlugin", playId: "01", playDir: "01-enterprise-rag" });
    });

    // --- ANALYZE & EVALUATE (user reports these are BROKEN) ---
    it("Estimate Cost fires cost", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Estimate Cost"));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "cost", playId: "01", playDir: "01-enterprise-rag" });
    });

    // 'Run Evaluation' also appears in Quick Start Guide <strong> tag, so use selector to pick the ActionItem
    it("Run Evaluation fires runEvaluation", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByRole("button", { name: /Run Evaluation/i }));
        expect(postMessageMock).toHaveBeenCalledWith({ command: "runEvaluation", playId: "01", playDir: "01-enterprise-rag" });
    });

    it("places pattern before architecture and colocates reload, evaluation, and cost actions", () => {
        render(<PlayDetail play={{ ...mockPlay, pattern: "RAG architecture pattern" }} />);
        const pattern = screen.getByText("Architecture Pattern");
        const architecture = screen.getByText("Source-backed Architecture");
        const toolbox = screen.getByText("Tool Engineering · FAI Toolbox");
        const evaluation = screen.getByText("Evaluation Readiness");
        const cost = screen.getByText("Estimated Monthly Cost");
        expect(pattern.compareDocumentPosition(architecture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(architecture.compareDocumentPosition(toolbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(evaluation.compareDocumentPosition(cost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole("button", { name: /Reload Architecture/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Estimate Cost/i })).toBeInTheDocument();
        expect(screen.queryByText("Quick Actions")).not.toBeInTheDocument();
        expect(screen.queryByText("Analyze & Evaluate")).not.toBeInTheDocument();
    });

    it("shows DevKit completion reported by the extension host", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent.click(screen.getByText("Initialize Hooks"));
        fireEvent(window, new MessageEvent("message", { data: { type: "playKitStatus", kit: "devkit", playId: "01", status: "succeeded", message: "DevKit ready: 12 downloaded, 1 existing file preserved." } }));
        expect(screen.getByText(/DevKit ready: 12 downloaded/)).toBeInTheDocument();
    });

    it("loads Architecture Diagram into the same page automatically", () => {
        render(<PlayDetail play={mockPlay} />);
        expect(screen.getByLabelText("Enterprise RAG Q&A architecture service map")).toBeInTheDocument();
        expect(screen.getByText(/Network-independent/)).toBeInTheDocument();
        expect(postMessageMock).toHaveBeenCalledWith({ command: "diagram", playId: "01", playDir: "01-enterprise-rag" });
        fireEvent(window, new MessageEvent("message", { data: { type: "architectureStatus", playId: "01", status: "succeeded", markdown: "# Architecture\n\nService flow", sourceUrl: "https://example.test/architecture" } }));
        expect(screen.getByRole("heading", { name: "Architecture" })).toBeInTheDocument();
        expect(screen.getByText("Service flow")).toBeInTheDocument();
    });

    it("keeps the architecture map and renders bundled evidence when live source degrades", () => {
        render(<PlayDetail play={mockPlay} />);
        fireEvent(window, new MessageEvent("message", { data: { type: "architectureStatus", playId: "01", status: "degraded", markdown: "# Bundled architecture\n\nDeclared service flow", message: "Live source unavailable. Showing the bundled Play contract instead." } }));
        expect(screen.getByLabelText("Enterprise RAG Q&A architecture service map")).toBeInTheDocument();
        expect(screen.getByText("Bundled contract active")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Bundled architecture" })).toBeInTheDocument();
    });

    it("parses and renders canonical Mermaid fences as SVG instead of source text", async () => {
        const markdown = "# Architecture\n\n```mermaid\ngraph TD\n  User --> API\n\n  API --> Search\n```\n\nGrounded flow";
        expect(parseArchitectureBlocks(markdown)).toContainEqual({ type: "code", language: "mermaid", content: "graph TD\n  User --> API\n\n  API --> Search" });
        render(<PlayDetail play={mockPlay} />);
        fireEvent(window, new MessageEvent("message", { data: { type: "architectureStatus", playId: "01", status: "succeeded", markdown } }));
        expect(screen.getByLabelText("Rendered solution architecture")).toBeInTheDocument();
        expect(screen.getByLabelText("Solution architecture diagram")).toBeInTheDocument();
        expect(screen.queryByText("graph TD", { exact: false })).not.toBeInTheDocument();
    });

    it("renders architecture tables, emphasis, and links instead of raw pipe syntax", () => {
        const markdown = "# Architecture\n\n| Role | Service |\n|---|---|\n| **Grounding** | [AI Search](https://frootai.dev/docs/R2) |";
        render(<PlayDetail play={mockPlay} />);
        fireEvent(window, new MessageEvent("message", { data: { type: "architectureStatus", playId: "01", status: "succeeded", markdown } }));
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("Grounding").tagName).toBe("STRONG");
        expect(screen.getByRole("link", { name: "AI Search" })).toBeInTheDocument();
        expect(screen.queryByText("| Role | Service |")).not.toBeInTheDocument();
    });

    it("preserves canonical unbracketed architecture layer names", () => {
        const model = parseFlowchart("graph TB\nsubgraph Application Layer\nAPI[REST API]\nend\nsubgraph AI Layer\nSearch[Azure AI Search]\nend\nAPI --> Search");
        expect(model.groups.map((group) => group.label)).toEqual(["Architecture flow", "Application Layer", "AI Layer"]);
    });

    it("repairs line-wrapped architecture headings, flows, lists, and tables", () => {
        const malformed = "##\nData Flow\n\n1. **Request**: Supervisor creates an execution\nplan\n2. **Execute**: Specialists run\n\n## Service Roles\n\n| Service | Layer | Role |\n|---------|-------|------|\n| Container Apps | Compute | Task routing and result\naggregation |\n\n## Scaling\n\n| Metric | Dev | Production |\nEnterprise |\n|---|---|---|---|\n| Tasks | 5 | 50 | 500 |";
        const normalized = normalizeArchitectureMarkdown(malformed);
        expect(normalized).toContain("## Data Flow");
        expect(normalized).toContain("1. **Request**: Supervisor creates an execution plan");
        expect(normalized).toContain("| Container Apps | Compute | Task routing and result aggregation |");
        expect(normalized).toContain("| Metric | Dev | Production | Enterprise |");
    });

    it("DEBUG — count and locate every label", () => {
        render(<PlayDetail play={mockPlay} />);
        const labels = [
            "Initialize DevKit", "Initialize TuneKit", "Initialize SpecKit",
            "Initialize Hooks", "Initialize Prompts", "Install as Plugin",
            "Install Complete Toolbox", "Estimate Cost", "Run Evaluation", "Reload Architecture",
        ];
        for (const label of labels) {
            const found = screen.queryAllByText(label);
            console.log(`\n  '${label}' → ${found.length} occurrences`);
            found.forEach((el, i) => {
                const parentTag = el.parentElement?.tagName ?? "?";
                const grandTag = el.parentElement?.parentElement?.tagName ?? "?";
                const onClickAttr = (el.parentElement as any)?.onclick ? "YES" : "no";
                const greatGrand = el.parentElement?.parentElement?.parentElement?.tagName ?? "?";
                console.log(`     [${i}] tag=${el.tagName} parent=${parentTag} grand=${grandTag} ggrand=${greatGrand} parentOnclick=${onClickAttr}`);
                console.log(`         text="${el.textContent?.substring(0, 60)}"`);
            });
        }
        expect(true).toBe(true);
    });
});
