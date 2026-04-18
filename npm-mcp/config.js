/**
 * Centralized endpoint configuration for FrootAI MCP Server.
 *
 * Architecture Decision: All external URLs are defined in this single file so that
 * environment-specific overrides (staging, air-gapped, proxy) can swap endpoints
 * without hunting through tool handlers. Every tool imports from here — never
 * hardcodes a URL. The `urls` object uses a hierarchical namespace (github.*,
 * website.*, external.*) to make intent clear at call sites.
 *
 * Environment Variables:
 *   FAI_GITHUB_RAW_BASE  — Base URL for raw GitHub content
 *   FAI_WEBSITE_URL      — FrootAI website URL
 *   FAI_GITHUB_REPO      — GitHub repository URL
 *   FAI_GITHUB_API       — GitHub API base URL
 *   FAI_MS_LEARN_API     — Microsoft Learn API endpoint
 *   FAI_MCP_REGISTRY     — MCP registry API endpoint
 *   FAI_COMMUNITY_PLAYS  — GitHub API URL for community plays listing
 */

const GITHUB_RAW_BASE = process.env.FAI_GITHUB_RAW_BASE || 'https://raw.githubusercontent.com/frootai/frootai/main';
const WEBSITE_URL = process.env.FAI_WEBSITE_URL || 'https://frootai.dev';
const GITHUB_REPO = process.env.FAI_GITHUB_REPO || 'https://github.com/frootai/frootai';
const GITHUB_API = process.env.FAI_GITHUB_API || 'https://api.github.com/repos/frootai/frootai';
const MS_LEARN_API = process.env.FAI_MS_LEARN_API || 'https://learn.microsoft.com/api/search';
const MCP_REGISTRY = process.env.FAI_MCP_REGISTRY || 'https://registry.mcp.so/api';
const COMMUNITY_PLAYS = process.env.FAI_COMMUNITY_PLAYS || `${GITHUB_API}/contents/solution-plays`;

export const urls = {
  github: {
    raw: GITHUB_RAW_BASE,
    repo: GITHUB_REPO,
    api: GITHUB_API,
    communityPlays: COMMUNITY_PLAYS,
    knowledgeJson: `${GITHUB_RAW_BASE}/npm-mcp/knowledge.json`,
    playTree: (slug) => `${GITHUB_REPO}/tree/main/solution-plays/${slug}`,
    tree: (path) => `${GITHUB_REPO}/tree/main/${path}`,
  },
  website: {
    base: WEBSITE_URL,
    plays: `${WEBSITE_URL}/solution-plays`,
    playDetail: (folder) => `${WEBSITE_URL}/solution-plays/${folder}`,
    userGuide: (playId) => `${WEBSITE_URL}/user-guide?play=${playId}`,
    primitives: (type) => `${WEBSITE_URL}/primitives/${type}`,
    configurator: `${WEBSITE_URL}/configurator`,
  },
  external: {
    msLearnApi: MS_LEARN_API,
    mcpRegistry: MCP_REGISTRY,
    smithery: 'https://smithery.ai',
    mcpSo: 'https://mcp.so',
    npmPackage: 'https://www.npmjs.com/package/frootai-mcp',
  },
};

/** Backward-compatible ENDPOINTS object matching endpoints.js shape */
export const ENDPOINTS = {
  FROOTAI_WEBSITE: WEBSITE_URL,
  GITHUB_RAW: GITHUB_RAW_BASE,
  GITHUB_API: GITHUB_API,
  MICROSOFT_LEARN_API: MS_LEARN_API,
  MCP_REGISTRY: MCP_REGISTRY,
  GITHUB_COMMUNITY_PLAYS: COMMUNITY_PLAYS,
};
