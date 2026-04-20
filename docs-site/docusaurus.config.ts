import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'FrootAI Docs',
  tagline: 'The uniFAIng glue for the GenAI ecosystem',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.frootai.dev',
  baseUrl: '/',

  organizationName: 'frootai',
  projectName: 'frootai',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: true,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/frootai/frootai/edit/main/docs-site/',
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/frootai/frootai/edit/main/docs-site/',
          blogTitle: 'FrootAI Blog',
          blogDescription: 'Technical deep dives, announcements, and tutorials from the FrootAI team.',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/frootai-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'unifaing_release',
      content: '🍊 <b>FrootAI</b> — The uniFAIng glue for the GenAI ecosystem. <a href="https://frootai.dev" target="_blank">Learn more →</a>',
      backgroundColor: '#064e3b',
      textColor: '#ecfdf5',
      isCloseable: true,
    },
    navbar: {
      title: 'FrootAI',
      logo: {
        alt: 'FrootAI Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'learnSidebar',
          position: 'left',
          label: 'Learn',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API Reference',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://frootai.dev',
          label: 'frootai.dev',
          position: 'right',
        },
        {
          href: 'https://github.com/frootai/frootai',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/getting-started/introduction' },
            { label: 'FAI Protocol', to: '/concepts/fai-protocol' },
            { label: 'Primitives', to: '/primitives/agents' },
            { label: 'Solution Plays', to: '/solution-plays/overview' },
          ],
        },
        {
          title: 'Learn',
          items: [
            { label: 'FROOT Framework', to: '/learning/f1-genai-foundations' },
            { label: 'Guides', to: '/guides/create-agent' },
            { label: 'Workshops', to: '/workshops/build-rag-pipeline' },
          ],
        },
        {
          title: 'Distribution',
          items: [
            { label: 'MCP Server (npm)', href: 'https://www.npmjs.com/package/frootai-mcp' },
            { label: 'VS Code Extension', href: 'https://marketplace.visualstudio.com/items?itemName=frootai.frootai' },
            { label: 'Python SDK (PyPI)', href: 'https://pypi.org/project/frootai/' },
            { label: 'Docker', href: 'https://ghcr.io/frootai/frootai-mcp' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/frootai/frootai' },
            { label: 'GitHub Discussions', href: 'https://github.com/frootai/frootai/discussions' },
            { label: 'Blog', to: '/blog' },
            { label: 'FrootAI Website', href: 'https://frootai.dev' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} FrootAI. The uniFAIng glue for the GenAI ecosystem.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'python', 'bicep', 'docker'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
