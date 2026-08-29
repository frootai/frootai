// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../vscode", () => ({ vscode: { postMessage: vi.fn() } }));
import PrimitivesCatalog from "./PrimitivesCatalog";
import MarkdownDocument from "../components/MarkdownDocument";

const primitives = {
  agents: [{ id: "grounded-builder", name: "Grounded Builder", description: "Builds from verified evidence." }],
  skills: [], instructions: [], hooks: [], plugins: [],
};

describe("accessible primitive and architecture details", () => {
  afterEach(() => cleanup());

  it("opens an exact primitive through an explicit keyboard-focusable detail button", () => {
    render(<PrimitivesCatalog primitives={primitives} />);
    const detail = screen.getByRole("button", { name: "Open Grounded Builder details" });
    detail.focus();
    expect(detail).toHaveFocus();
    fireEvent.click(detail);
    expect(screen.getByRole("heading", { name: /Grounded Builder/i })).toBeInTheDocument();
    expect(screen.getByText("Builds from verified evidence.")).toBeInTheDocument();
  });

  it("gives rendered architecture tables an accessible caption and scoped headers", () => {
    render(<MarkdownDocument markdown={"| Service | Role |\n|---|---|\n| Search | Grounding |"} />);
    expect(screen.getByRole("table", { name: "Structured architecture and reference data" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Service" })).toHaveAttribute("scope", "col");
  });
});
