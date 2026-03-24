import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "FrootAI",
  tagline: "The open glue — from root to fruit. Binding infrastructure, platform, and application for AI architecture.",
  favicon: "img/favicon.ico",

  url: "https://frootai.dev",
  baseUrl: "/",

  organizationName: "gitpavleenbali",
  projectName: "frootai",
  trailingSlash: false,

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    mermaid: true,
    format: "detect",
  },

  themes: ["@docusaurus/theme-mermaid", "@easyops-cn/docusaurus-search-local"],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "/docs",
          include: ["**/*.md"],
          exclude: ["node_modules/**"],
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/gitpavleenbali/frootai/tree/main/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/aifroot-logo.svg",

    metadata: [
      { name: "description", content: "FrootAI — The open glue for AI architecture. 22 MCP tools, 20 solution plays, 18 knowledge modules. From the roots to the fruits." },
      { property: "og:title", content: "FrootAI — From the Roots to the Fruits" },
      { property: "og:description", content: "The open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem. 22 MCP tools, 20 solution plays, VS Code extension." },
      { property: "og:image", content: "https://frootai.dev/img/aifroot-logo.svg" },
      { property: "og:url", content: "https://frootai.dev" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FrootAI — From the Roots to the Fruits" },
      { name: "twitter:description", content: "22 MCP tools, 20 solution plays, 18 knowledge modules. The open glue for AI architecture." },
      { name: "twitter:image", content: "https://frootai.dev/img/aifroot-logo.svg" },
    ],

    headTags: [
      {
        tagName: "script",
        attributes: {
          defer: "true",
          "data-domain": "frootai.dev",
          src: "https://static.cloudflareinsights.com/beacon.min.js",
          "data-cf-beacon": '{"token": "frootai-analytics"}',
        },
      },
    ],

    announcementBar: {
      id: "frootai_mcp",
      content:
        '🌱 <b>FrootAI Developer Kit</b> (MCP Server + VS Code Extension) — Add <b style="color:#10b981">Infra</b>, <b style="color:#06b6d4">Platform</b> &amp; <b style="color:#7c3aed">App</b> knowledge to your development ecosystem <a href="/setup-guide" style="color:#f59e0b;font-weight:700;text-decoration:none">→ Setup Guide</a>',
      backgroundColor: "#0a0a0f",
      textColor: "#e0e0e0",
      isCloseable: true,
    },

    navbar: {
      title: "FrootAI",
      logo: {
        alt: "FrootAI",
        src: "img/aifroot-logo.svg",
        href: "/",
      },
      items: [
        {
          type: "dropdown",
          label: "FAI Platform",
          position: "left",
          items: [
            { to: "/configurator", label: "⚙️ Solution Configurator" },
            { to: "/solution-plays", label: "🎯 Solution Plays (20)" },
            { to: "/packages", label: "📦 Packages" },
          ],
        },
        {
          type: "dropdown",
          label: "FAI Solutions",
          position: "left",
          items: [
            { to: "/ecosystem", label: "🔗 Ecosystem Overview" },
            { to: "/vscode-extension", label: "🖥️ VS Code Extension" },
            { to: "/mcp-tooling", label: "🔌 MCP Server (22 tools)" },
            { to: "/setup-guide", label: "📋 Setup Guide" },
          ],
        },
        {
          type: "dropdown",
          label: "FAI Community",
          position: "left",
          items: [
            { to: "/partners", label: "🤝 Partner Integrations" },
            { to: "/marketplace", label: "🏪 Plugin Marketplace" },
            { to: "/community", label: "🌱 Open Source Community" },
            { to: "/adoption", label: "📊 FrootAI Adoption" },
          ],
        },
        {
          type: "dropdown",
          label: "FAI Learning Hub",
          position: "left",
          items: [
            { to: "/learning-hub", label: "📚 FAI Learning Center" },
            { type: "docSidebar" as const, sidebarId: "frootSidebar", label: "📖 Knowledge Modules (18)" },
            { to: "/docs/F3-AI-Glossary-AZ", label: "🔤 AI Glossary (200+ terms)" },
            { href: "https://github.com/gitpavleenbali/frootai/tree/main/workshops", label: "🎓 Workshop Materials" },
            { to: "/docs/Quiz-Assessment", label: "📝 Quiz & Assessment" },
          ],
        },
        {
          type: "dropdown",
          label: "FAI Developer Hub",
          position: "left",
          items: [
            { to: "/dev-hub", label: "🛠️ Developer Center" },
            { to: "/feature-spec", label: "📋 Feature Spec (A-Z)" },
            { to: "/docs/admin-guide", label: "📋 Admin Guide" },
            { to: "/docs/user-guide-complete", label: "📖 User Guide" },
            { to: "/docs/contributor-guide", label: "🤝 Contributor Guide" },
            { to: "/docs/api-reference", label: "📡 API Reference" },
            { to: "/docs/architecture-overview", label: "🏗️ Architecture" },
            { to: "/dev-hub-changelog", label: "📰 Changelog & Releases" },
          ],
        },
        {
          to: "/hi-fai",
          label: "🖐️ Hi FAI",
          position: "right",
          className: "navbar__item--hifai-glow",
        },
        {
          to: "/chatbot",
          label: "✨ FAI Agent",
          position: "right",
          className: "navbar__item--agent-glow",
        },
        {
          href: "https://github.com/gitpavleenbali/frootai",
          label: "GitHub",
          position: "right",
        },
      ],
    },

    footer: {
      style: "dark",
      links: [
        {
          title: "Explore",
          items: [
            { label: "AI Knowledge Hub", to: "/docs/" },
            { label: "Ecosystem", to: "/ecosystem" },
            { label: "Solution Plays", to: "/solution-plays" },
            { label: "Packages", to: "/packages" },
            { label: "Setup Guide", to: "/setup-guide" },
            { label: "AI Assistant", to: "/chatbot" },
            { label: "Configurator", to: "/configurator" },
          ],
        },
        {
          title: "Ecosystem",
          items: [
            { label: "Partner Integrations", to: "/partners" },
            { label: "Plugin Marketplace", to: "/marketplace" },
            { label: "Enterprise & Certification", to: "/enterprise" },
            { label: "Workshops", href: "https://github.com/gitpavleenbali/frootai/tree/main/workshops" },
          ],
        },
        {
          title: "Install",
          items: [
            { label: "FrootAI MCP (npm)", href: "https://www.npmjs.com/package/frootai-mcp" },
            { label: "VS Code Extension", href: "https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" },
          ],
        },
        {
          title: "Connect",
          items: [
            { label: "LinkedIn", href: "https://linkedin.com/in/pavleenbali" },
            { label: "GitHub", href: "https://github.com/gitpavleenbali" },
            { label: "Newsletter", href: "https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7001119707667832832" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Pavleen Bali — FrootAI™: From the Roots to the Fruits.`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["powershell", "bicep", "bash", "json", "yaml", "csharp", "python"],
      magicComments: [],
    },

    docs: {
      sidebar: {
        hideable: true,
      },
    },

    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    mermaid: {
      theme: { light: "neutral", dark: "dark" },
    },

    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },

    codeBlock: {
      showCopyButton: true,
    },
  } satisfies Preset.ThemeConfig,

  plugins: [],
};

export default config;

