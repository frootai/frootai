export interface FrootModule {
  id: string;
  name: string;
  file: string;
}

export interface FrootLayer {
  layer: string;
  color: string;
  modules: FrootModule[];
}

export const FROOT_MODULES: FrootLayer[] = [
  {
    layer: "🌱 Foundations", color: "#f59e0b", modules: [
      { id: "F1", name: "GenAI Foundations", file: "GenAI-Foundations.md" },
      { id: "F2", name: "LLM Landscape", file: "LLM-Landscape.md" },
      { id: "F3", name: "AI Glossary A–Z", file: "F3-AI-Glossary-AZ.md" },
      { id: "F4", name: ".github Agentic OS", file: "F4-GitHub-Agentic-OS.md" },
    ]
  },
  {
    layer: "🪵 Reasoning", color: "#10b981", modules: [
      { id: "R1", name: "Prompt Engineering", file: "Prompt-Engineering.md" },
      { id: "R2", name: "RAG Architecture", file: "RAG-Architecture.md" },
      { id: "R3", name: "Deterministic AI", file: "R3-Deterministic-AI.md" },
    ]
  },
  {
    layer: "🌿 Orchestration", color: "#06b6d4", modules: [
      { id: "O1", name: "Semantic Kernel", file: "Semantic-Kernel.md" },
      { id: "O2", name: "AI Agents", file: "AI-Agents-Deep-Dive.md" },
      { id: "O3", name: "MCP & Tools", file: "O3-MCP-Tools-Functions.md" },
    ]
  },
  {
    layer: "🍃 Operations", color: "#6366f1", modules: [
      { id: "O4", name: "Azure AI Platform", file: "Azure-AI-Foundry.md" },
      { id: "O5", name: "AI Infrastructure", file: "AI-Infrastructure.md" },
      { id: "O6", name: "Copilot Ecosystem", file: "Copilot-Ecosystem.md" },
    ]
  },
  {
    layer: "🍎 Transformation", color: "#7c3aed", modules: [
      { id: "T1", name: "Fine-Tuning", file: "T1-Fine-Tuning-MLOps.md" },
      { id: "T2", name: "Responsible AI", file: "Responsible-AI-Safety.md" },
      { id: "T3", name: "Production Patterns", file: "T3-Production-Patterns.md" },
    ]
  },
];
