// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../vscode", () => ({ vscode: { postMessage: vi.fn() } }));
import ProductSystemHome from "./ProductSystemHome";

describe("Product System Home stages", () => {
  afterEach(() => cleanup());

  it("renders one stage tab row with the selected content immediately beneath it", () => {
    render(<ProductSystemHome />);
    const tabs = screen.getByRole("tablist", { name: "FrootAI delivery stages" });
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: /02.*Define.*Solution Plays/i }));
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Choose a complete architecture contract");
    expect(panel).toHaveTextContent("An architecture contract");
    expect(tabs.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("orders and highlights the primary onboarding actions", () => {
    render(<ProductSystemHome />);
    const labels = ["Connect Account", "What is FrootAI?", "Ask Agent FAI", "Solution Plays", "Search FAI", "Start Configurator", "Browse Docs", "AI Glossary"];
    const buttons = labels.map((label) => screen.getAllByRole("button", { name: new RegExp(label.replace(/[?]/g, "\\?"), "i") })[0]);
    for (let index = 1; index < buttons.length; index += 1) expect(buttons[index - 1].compareDocumentPosition(buttons[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const button of buttons.slice(0, 4)) expect(button).toHaveClass("fai-home-primary");
    for (const button of buttons.slice(4)) expect(button).not.toHaveClass("fai-home-primary");
  });
});