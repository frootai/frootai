// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();
let Sidebar: ComponentType;

beforeAll(async () => {
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  (window as any).sidebarData = { logoUri: "vscode-resource://frootai-mark.png" };
  Sidebar = (await import("./Sidebar")).default;
});
afterEach(() => { cleanup(); postMessage.mockClear(); localStorage.clear(); });
afterAll(() => vi.unstubAllGlobals());

describe("five-stage FrootAI sidebar", () => {
  it("shows the real logo and always-visible Home, Account, Agent, and Search actions", () => {
    render(<Sidebar />);
    expect(screen.getByRole("img", { name: "FrootAI" })).toHaveAttribute("src", "vscode-resource://frootai-mark.png");
    for (const action of ["Home", "Connect Account", "Ask Agent FAI", "Solution Plays", "Search FAI"]) expect(screen.getAllByRole("button", { name: new RegExp(`^${action}`, "i") })[0]).toBeVisible();
    for (const stage of ["01.*Discover", "02.*Define", "03.*Develop", "04.*Govern", "05.*Verify & improve"]) expect(screen.getByRole("button", { name: new RegExp(`^${stage}`, "i") })).toHaveAttribute("aria-expanded", "false");
  });

  it("routes stage entries into the singleton workbench", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const configurator = screen.getByRole("button", { name: /Solution Configurator/i });
    const accelerator = screen.getByRole("button", { name: /Solution Accelerator/i });
    expect(configurator.compareDocumentPosition(accelerator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Solution Accelerator/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "frootai.openWelcome", args: ["/solution-accelerator"] });
    fireEvent.click(screen.getByRole("button", { name: /^Skills/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "frootai.openWelcome", args: ["/primitives/skills"] });
    fireEvent.click(screen.getByRole("button", { name: /^Search FAI/i }));
    expect(postMessage).toHaveBeenCalledWith({ command: "frootai.searchAll" });
  });
  it("supports explicit collapse and expand all without VS Code view resizing", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByRole("button", { name: /^Skills/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.getByRole("button", { name: /^01.*Discover/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /^Skills/i })).toBeNull();
  });
});
