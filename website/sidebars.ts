import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  frootSidebar: [
    {
      type: "category",
      label: "🌳 AI Hub — FrootAI",
      collapsible: true,
      collapsed: false,
      items: [
        "README",
        {
          type: "category",
          label: "🌱 F — Foundations",
          items: [
            "GenAI-Foundations",
            "LLM-Landscape",
            "F3-AI-Glossary-AZ",
          ],
        },
        {
          type: "category",
          label: "🪵 R — Reasoning",
          items: [
            "Prompt-Engineering",
            "RAG-Architecture",
            "R3-Deterministic-AI",
          ],
        },
        {
          type: "category",
          label: "🌿 O — Orchestration",
          items: [
            "Semantic-Kernel",
            "AI-Agents-Deep-Dive",
            "O3-MCP-Tools-Functions",
          ],
        },
        {
          type: "category",
          label: "🍃 O — Operations",
          items: [
            "Azure-AI-Foundry",
            "AI-Infrastructure",
            "Copilot-Ecosystem",
          ],
        },
        {
          type: "category",
          label: "🍎 T — Transformation",
          items: [
            "T1-Fine-Tuning-MLOps",
            "Responsible-AI-Safety",
            "T3-Production-Patterns",
          ],
        },
        {
          type: "category",
          label: "📋 Reference",
          items: [
            "Quick-Reference-Cards",
            "Quiz-Assessment",
          ],
        },
      ],
    },
  ],
};

export default sidebars;
