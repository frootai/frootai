import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "FrootAI",
  tagline: "The open glue — from root to fruit. Binding infrastructure, platform, and application for AI architecture.",
  favicon: "img/favicon.ico",

  url: "https://gitpavleenbali.github.io",
  baseUrl: "/frootai/",

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

  themes: ["@docusaurus/theme-mermaid"],

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

    announcementBar: {
      id: "frootai_mcp",
      content:
        '🌱 <b>FrootAI Developer Kit</b> (MCP Server + VS Code Extension) — Add <b style="color:#10b981">Infra</b>, <b style="color:#06b6d4">Platform</b> &amp; <b style="color:#7c3aed">App</b> knowledge to your development ecosystem <a href="/frootai/setup-guide" style="color:#f59e0b;font-weight:700;text-decoration:none">→ Setup Guide</a>',
      backgroundColor: "#0a0a0f",
      textColor: "#e0e0e0",
      isCloseable: true,
    },

    navbar: {
      title: "FrootAI",
      logo: {
        alt: "FrootAI",
        src: "img/aifroot-logo.svg",
        href: "/frootai/",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "frootSidebar",
          position: "left",
          label: "FAI Knowledge Hub",
        },
        {
          to: "/ecosystem",
          label: "FAI Ecosystem",
          position: "left",
        },
        {
          to: "/solution-plays",
          label: "FAI Solution Plays",
          position: "left",
        },
        {
          to: "/packages",
          label: "FAI Packages",
          position: "left",
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
      copyright: `Copyright © ${new Date().getFullYear()} Pavleen Bali — FrootAI: From the Roots to the Fruits.`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["powershell", "bicep", "bash", "json", "yaml", "csharp", "python"],
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
  } satisfies Preset.ThemeConfig,

  plugins: [],
};

export default config;

