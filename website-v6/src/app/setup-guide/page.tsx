import type { Metadata } from "next";
import { SetupGuideClient } from "./setup-guide-client";

export const metadata: Metadata = {
  title: "Setup Guide",
  description: "Step-by-step guide to set up FrootAI MCP Server, VS Code Extension, CLI, and Docker.",
};

export default function SetupGuidePage() {
  return <SetupGuideClient />;
}
