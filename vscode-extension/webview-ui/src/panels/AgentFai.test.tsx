// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();
vi.mock("../vscode", () => ({ vscode: { postMessage: (message: unknown) => postMessage(message) } }));
import AgentFai, { renderMarkdown } from "./AgentFai";

const account = { configured: true, status: "verified" as const, redacted: "fai_live_••••abcd", lastError: null };
describe("persistent Agent FAI", () => {
  beforeEach(() => postMessage.mockClear());
  afterEach(() => cleanup());
  it("restores messages and announces readiness", () => {
    render(<AgentFai account={account} initialMessages={[{ role: "assistant", content: "Welcome back", createdAt: "2026-08-28T00:00:00Z" }]} />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith({ command: "agentFaiReady" });
  });
  it("sends through the extension host", () => {
    render(<AgentFai account={account} />);
    fireEvent.change(screen.getByLabelText("Ask Agent FAI"), { target: { value: "Build RAG" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "sendAgentFai", text: "Build RAG" });
  });
  it("shows a centered API-key action when Agent FAI cannot authenticate", () => {
    render(<AgentFai account={{ configured: true, status: "invalid", redacted: "fai_live_••••abcd", lastError: "Rejected" }} initialMessages={[{ role: "assistant", content: "Connect an API key before using hosted Agent FAI.", createdAt: "2026-08-29T00:00:00Z" }]} />);
    expect(screen.getByRole("heading", { name: "API key required" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Sign in & create key/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "accountSignIn" });
    fireEvent.click(screen.getByRole("button", { name: /Replace API key/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "accountSetKey" });
  });
  it("routes absolute Solution Play links inside VS Code", () => {
    render(<AgentFai account={account} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiResponse", reply: "Use [Play 01](https://frootai.dev/solution-plays/01-enterprise-rag)", citations: [] } }));
    fireEvent.click(screen.getByText("Play 01"));
    expect(postMessage).toHaveBeenCalledWith({ command: "openPlay", playId: "01" });
  });
  it("renders canonical absolute links as native Play links", () => {
    expect(renderMarkdown("[RAG](https://www.frootai.dev/solution-plays/21-agentic-rag)")).toContain('data-fai="play" data-arg="21"');
  });
  it("encodes dynamic link payloads before inserting webview attributes", () => {
    const html = renderMarkdown('[unsafe](https://example.test/path&quot; autofocus onfocus=&quot;alert(1))');
    expect(html).not.toContain(' autofocus ');
    expect(html).not.toContain(' onfocus=');
    expect(html).not.toContain('data-fai="external"');
  });
  it("allows only trusted ecosystem and documentation hosts", () => {
    expect(renderMarkdown("[FrootAI](https://frootai.dev/docs)")).toContain('data-fai="external"');
    expect(renderMarkdown("[Microsoft](https://learn.microsoft.com/azure/)")).toContain('data-fai="external"');
    expect(renderMarkdown("[Lookalike](https://frootai.dev.attacker.example/phish)")).toBe("Lookalike");
    expect(renderMarkdown("[Partner onboarding](https://frootai.dev/docs/partner-onboarding)")).toContain(encodeURIComponent("https://frootai.dev/partners"));
  });
  it("renders exact skill and agent links as native primitive links", () => {
    expect(renderMarkdown("[Deploy skill](https://frootai.dev/primitives/skills/deploy-multi-agent)")).toContain('data-fai="primitive" data-arg="skills%2Fdeploy-multi-agent"');
    expect(renderMarkdown("[Builder](/primitives/agents/multi-agent-builder)")).toContain('data-fai="primitive" data-arg="agents%2Fmulti-agent-builder"');
  });
  it("routes Solution Play citation cards inside VS Code", () => {
    render(<AgentFai account={account} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiResponse", reply: "Recommended play", citations: [{ label: "Agentic RAG", href: "https://www.frootai.dev/solution-plays/21-agentic-rag" }] } }));
    fireEvent.click(screen.getByRole("button", { name: /agentic rag/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "openPlay", playId: "21" });
  });
  it("shows thinking stages and incrementally renders ordered chunks", () => {
    render(<AgentFai account={account} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiStarted", phase: "grounding", message: "Searching grounded evidence…" } }));
    expect(screen.getByRole("status", { name: /agent fai thinking/i })).toHaveTextContent("Agent FAI is thinking");
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiThinking", phase: "responding", message: "Composing a grounded response…" } }));
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiChunk", content: "Grounded " } }));
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiChunk", content: "answer" } }));
    expect(screen.getByLabelText("Agent FAI streaming response")).toHaveTextContent("Grounded answer");
    expect(screen.getByRole("status", { name: /composing a grounded response/i })).toHaveTextContent("Grounded response streaming");
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiCompleted", reply: "Grounded answer", citations: [] } }));
    expect(screen.queryByLabelText("Agent FAI streaming response")).not.toBeInTheDocument();
    expect(screen.getByText("Grounded answer")).toBeInTheDocument();
  });
  it("routes exact plugin and Docs links into native workbench resources", () => {
    render(<AgentFai account={account} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiResponse", reply: "Use [plugin](/marketplace#multi-agent-service) and [MCP docs](/docs/O3-MCP-Tools-Functions)", citations: [] } }));
    fireEvent.click(screen.getByText("plugin"));
    expect(postMessage).toHaveBeenCalledWith({ command: "openPrimitive", primitiveType: "plugins", primitiveId: "multi-agent-service" });
    fireEvent.click(screen.getByText("MCP docs"));
    expect(postMessage).toHaveBeenCalledWith({ command: "workbenchNavigate", route: "/docs/O3-MCP-Tools-Functions" });
  });
  it("uses website-inspired dot activity and caret instead of an orbit spinner", () => {
    render(<AgentFai account={account} />);
    fireEvent(window, new MessageEvent("message", { data: { type: "agentFaiStarted", phase: "grounding", message: "Searching evidence" } }));
    expect(document.querySelectorAll(".fai-thinking-dots span")).toHaveLength(3);
    expect(document.querySelector(".fai-thinking-caret")).toBeInTheDocument();
    expect(document.querySelector(".fai-thinking-orbit")).not.toBeInTheDocument();
  });
});
