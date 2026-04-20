import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: '🚀 Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/first-play',
      ],
    },
    {
      type: 'category',
      label: '💡 Concepts',
      items: [
        'concepts/fai-protocol',
        'concepts/primitives',
        'concepts/solution-plays',
        'concepts/well-architected',
      ],
    },
    {
      type: 'category',
      label: '🧩 Primitives',
      items: [
        'primitives/agents',
        'primitives/instructions',
        'primitives/skills',
        'primitives/hooks',
        'primitives/plugins',
        'primitives/workflows',
      ],
    },
    {
      type: 'category',
      label: '📖 Guides',
      items: [
        'guides/create-agent',
        'guides/create-skill',
        'guides/create-instruction',
        'guides/create-hook',
        'guides/deploy-play',
        'guides/evaluate-play',
        'guides/build-mcp-server',
        'guides/package-plugin',
        'guides/wire-fai-context',
        'guides/agentic-loop',
        'guides/error-handling',
        'guides/configure-vscode',
      ],
    },
    {
      type: 'category',
      label: '📦 Distribution',
      items: [
        'distribution/mcp-server',
        'distribution/vscode-extension',
        'distribution/npm-sdk',
        'distribution/python-sdk',
        'distribution/cli',
        'distribution/docker',
      ],
    },
    {
      type: 'category',
      label: '🏗️ Solution Plays',
      items: [
        'solution-plays/overview',
        'solution-plays/catalog',
      ],
    },
    {
      type: 'category',
      label: '🔬 Workshops',
      items: [
        'workshops/build-rag-pipeline',
        'workshops/ai-landing-zone',
        'workshops/multi-agent-service',
      ],
    },
    {
      type: 'category',
      label: '🤝 Contributing',
      items: [
        'contributing/how-to-contribute',
        'contributing/naming-conventions',
        'contributing/pr-checklist',
      ],
    },
  ],

  learnSidebar: [
    {
      type: 'category',
      label: '🌱 Foundations',
      collapsed: false,
      items: [
        'learning/f1-genai-foundations',
        'learning/f2-llm-landscape',
        'learning/f3-glossary',
        'learning/f4-agentic-os',
      ],
    },
    {
      type: 'category',
      label: '🧠 Reasoning',
      items: [
        'learning/r1-prompt-engineering',
        'learning/r2-rag-architecture',
        'learning/r3-deterministic-ai',
      ],
    },
    {
      type: 'category',
      label: '⚙️ Orchestration',
      items: [
        'learning/o1-semantic-kernel',
        'learning/o2-agents-deep-dive',
        'learning/o3-mcp-tools',
      ],
    },
    {
      type: 'category',
      label: '🏗️ Operations',
      items: [
        'learning/o4-azure-ai-foundry',
        'learning/o5-infrastructure',
        'learning/o6-copilot-ecosystem',
      ],
    },
    {
      type: 'category',
      label: '🍎 Transformation',
      items: [
        'learning/t1-fine-tuning',
        'learning/t2-responsible-ai',
        'learning/t3-production-patterns',
      ],
    },
  ],

  apiSidebar: [
    {
      type: 'category',
      label: '📚 API Reference',
      collapsed: false,
      items: [
        'api-reference/mcp-tools',
        'api-reference/cli-commands',
        'api-reference/schemas',
        'api-reference/fai-manifest',
      ],
    },
  ],
};

export default sidebars;
