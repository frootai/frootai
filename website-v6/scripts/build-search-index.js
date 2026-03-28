/**
 * Build comprehensive search index from /docs markdown files.
 * Indexes EVERY heading level (H1-H4), table rows, and full body text.
 * Run: node scripts/build-search-index.js
 * Output: public/search-index.json
 */
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', '..', 'docs');
const outFile = path.join(__dirname, '..', 'public', 'search-index.json');

const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
const index = [];

// Helper: create anchor hash from heading text
function toHash(text) {
  return '#' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').replace(/^-+/, '');
}

// Helper: clean markdown formatting
function clean(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/`(.+?)`/g, '$1')         // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[#>|_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Page routes — static entries for non-doc pages
const pages = [
  { title: "Home — FrootAI", url: "/", body: "FrootAI from the roots to the fruits BIY build it yourself AI LEGO kit infrastructure platform application teams ecosystem" },
  { title: "Solution Configurator", url: "/configurator", body: "configurator wizard 3 questions recommend play RAG agent document voice content moderation landing zone" },
  { title: "Solution Plays (20)", url: "/solution-plays", body: "20 solution plays DevKit TuneKit SpecKit enterprise RAG deterministic agent multi-agent call center IT ticket document intelligence copilot content moderation landing zone model serving fine-tuning gateway multi-modal teams observability prompt edge anomaly" },
  { title: "FROOT Packages", url: "/packages", body: "packages modules download foundations reasoning orchestration operations transformation MCP tools knowledge" },
  { title: "Ecosystem Overview", url: "/ecosystem", body: "ecosystem telescope microscope MCP VS Code Docker CLI solution plays packages" },
  { title: "VS Code Extension", url: "/vscode-extension", body: "VS Code extension 16 commands DevKit TuneKit sidebar solution plays modules MCP tools glossary" },
  { title: "MCP Server (22 tools)", url: "/mcp-tooling", body: "MCP model context protocol server 22 tools agent knowledge search lookup architecture Claude Copilot Cursor Windsurf Foundry static live chain ecosystem pricing cost compare" },
  { title: "CLI (npx frootai)", url: "/cli", body: "CLI command line terminal scaffold search cost deploy doctor validate init" },
  { title: "Docker Image", url: "/docker", body: "Docker container multi-arch arm64 amd64 kubernetes sidecar zero install" },
  { title: "Setup Guide", url: "/setup-guide", body: "setup install configure MCP VS Code CLI Docker Claude Cursor Foundry getting started" },
  { title: "Hi FAI — 5-Minute Quickstart", url: "/hi-fai", body: "quickstart 5 minutes getting started welcome DevKit TuneKit auto-chain extension MCP" },
  { title: "Agent FAI Chatbot", url: "/chatbot", body: "chatbot AI assistant agent GPT-4.1 streaming cost estimation play search recommendation" },
  { title: "Partner Integrations", url: "/partners", body: "partners ServiceNow Salesforce SAP Datadog PagerDuty Jira MCP enterprise ITSM CRM ERP" },
  { title: "Plugin Marketplace", url: "/marketplace", body: "marketplace plugins community publish agent skill prompt discover RAG code review security" },
  { title: "Open Source Community", url: "/community", body: "community open source MIT free forever contribute star GitHub" },
  { title: "FrootAI Adoption", url: "/adoption", body: "adoption metrics stats ecosystem health integration VS Code Claude Cursor Windsurf Foundry" },
  { title: "Developer Hub", url: "/dev-hub", body: "developer hub admin guide user guide contributor API architecture changelog CI pipeline" },
  { title: "Feature Specification", url: "/feature-spec", body: "feature specification complete A-Z platform plays DevKit TuneKit MCP extension website" },
  { title: "REST API", url: "/api-docs", body: "REST API endpoints chat stream search-plays estimate-cost health plays POST GET" },
  { title: "Evaluation Dashboard", url: "/eval-dashboard", body: "evaluation dashboard groundedness coherence relevance fluency safety cost quality metrics CI gate" },
  { title: "Changelog & Releases", url: "/dev-hub-changelog", body: "changelog releases versions v3 v2 v1 features fixes MCP extension website" },
  { title: "User Guide", url: "/user-guide", body: "user guide play DevKit TuneKit deploy auto-chain agents step by step production" },
  { title: "Knowledge Modules (18)", url: "/docs", body: "knowledge modules 18 FROOT foundations reasoning orchestration operations transformation AI glossary" },
  { title: "Enterprise", url: "/enterprise", body: "enterprise community free MIT license everything is free" },
  { title: "Learning Hub", url: "/learning-hub", body: "learning hub modules glossary workshops quiz certification study" },
];

for (const p of pages) {
  index.push({ t: p.title, u: p.url, b: p.body, type: "page" });
}

// Parse each markdown file deeply — every heading, table row, body paragraph
for (const file of files) {
  const slug = file.replace('.md', '');
  const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
  const lines = content.split('\n');

  let docTitle = slug.replace(/-/g, ' ');
  let currentH2 = '';
  let currentH2Hash = '';
  let currentH3 = '';
  let currentH3Hash = '';
  let sectionBody = [];
  let inCodeBlock = false;

  function flushBody(heading, hash, parentHeading) {
    if (heading && sectionBody.length > 0) {
      const body = sectionBody.join(' ').replace(/\s+/g, ' ').trim();
      if (body.length > 10) {
        index.push({
          t: heading,
          u: `/docs/${slug}${hash}`,
          b: body.substring(0, 500),
          type: "section",
          parent: parentHeading || docTitle,
        });
      }
    }
    sectionBody = [];
  }

  for (const line of lines) {
    // Track code blocks to skip them
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (line.startsWith('# ')) {
      // H1: document title
      flushBody(currentH3 || currentH2, currentH3Hash || currentH2Hash, currentH2 || docTitle);
      docTitle = clean(line.replace(/^#\s+/, ''));
      currentH2 = '';
      currentH3 = '';
      index.push({ t: docTitle, u: `/docs/${slug}`, b: '', type: "doc" });

    } else if (line.startsWith('## ')) {
      // H2: major section — flush previous, start new
      flushBody(currentH3 || currentH2, currentH3Hash || currentH2Hash, currentH2 || docTitle);
      currentH2 = clean(line.replace(/^##\s+/, ''));
      currentH2Hash = toHash(currentH2);
      currentH3 = '';
      currentH3Hash = '';
      // Add H2 as its own entry
      index.push({ t: currentH2, u: `/docs/${slug}${currentH2Hash}`, b: '', type: "heading", parent: docTitle });

    } else if (line.startsWith('### ')) {
      // H3: sub-section — flush previous H3, start new
      flushBody(currentH3 || currentH2, currentH3Hash || currentH2Hash, currentH2 || docTitle);
      currentH3 = clean(line.replace(/^###\s+/, ''));
      currentH3Hash = toHash(currentH3);
      // Add H3 as its own entry
      index.push({ t: currentH3, u: `/docs/${slug}${currentH3Hash}`, b: '', type: "heading", parent: currentH2 || docTitle });

    } else if (line.startsWith('#### ')) {
      // H4: add as searchable entry
      const h4 = clean(line.replace(/^####\s+/, ''));
      const h4Hash = toHash(h4);
      index.push({ t: h4, u: `/docs/${slug}${h4Hash}`, b: '', type: "heading", parent: currentH3 || currentH2 || docTitle });
      sectionBody.push(h4);

    } else if (line.startsWith('| ') && !line.startsWith('| ---') && !line.startsWith('|---')) {
      // Table row — extract cell content as searchable body
      const cells = line.split('|').map(c => clean(c)).filter(c => c.length > 1);
      if (cells.length > 0) {
        sectionBody.push(cells.join(' — '));
      }

    } else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\.\s/)) {
      // List items
      const item = clean(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      if (item.length > 3) sectionBody.push(item);

    } else if (line.trim() && !line.startsWith('---')) {
      // Regular paragraph text
      const cleaned = clean(line);
      if (cleaned.length > 3) sectionBody.push(cleaned);
    }
  }

  // Flush final section
  flushBody(currentH3 || currentH2, currentH3Hash || currentH2Hash, currentH2 || docTitle);
}

// Deduplicate: remove entries with same title+url, keep the one with longest body
const seen = new Map();
for (const entry of index) {
  const key = `${entry.t}|||${entry.u}`;
  const existing = seen.get(key);
  if (!existing || (entry.b || '').length > (existing.b || '').length) {
    seen.set(key, entry);
  }
}
const deduped = Array.from(seen.values());

fs.writeFileSync(outFile, JSON.stringify(deduped));
const headings = deduped.filter(e => e.type === 'heading').length;
const sections = deduped.filter(e => e.type === 'section').length;
const docs = deduped.filter(e => e.type === 'doc').length;
console.log(`Search index: ${deduped.length} entries (${docs} docs, ${headings} headings, ${sections} sections, ${pages.length} pages) from ${files.length} files [deduped from ${index.length}]`);
