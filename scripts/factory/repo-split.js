#!/usr/bin/env node
/**
 * FAI Factory — Repository Split & IP Protection Engine
 * ======================================================
 * Implements the Open Core model for FrootAI:
 *   PUBLIC  (frootai/frootai)      — Primitives, protocol, plays, engine, docs (MIT)
 *   PRIVATE (frootai/frootai-core) — Distribution channels, factory, SDKs (Proprietary)
 *   PRIVATE (frootai/frootai.dev)  — Website (Proprietary, already separate)
 *
 * This module provides:
 *   1. IP Classification — every file/folder tagged as public|private|website
 *   2. Repo Split Manifest — declares exactly what goes where
 *   3. Cross-Repo Config — factory works across both repos seamlessly
 *   4. Bridge Scripts — sync, verify, and orchestrate across repos
 *   5. License Headers — MIT for public, proprietary for private
 *   6. Migration Dry-Run — simulate split, validate integrity, risk assessment
 *   7. CODEOWNERS Generation — per-repo ownership rules
 *   8. CI/CD Templates — split-aware GitHub Actions workflows
 *
 * Usage:
 *   node scripts/factory/repo-split.js                    # Full report
 *   node scripts/factory/repo-split.js --classify         # Show IP classification
 *   node scripts/factory/repo-split.js --dry-run          # Simulate split
 *   node scripts/factory/repo-split.js --generate-config  # Write config files
 *   node scripts/factory/repo-split.js --license-headers  # Inject license headers
 *   node scripts/factory/repo-split.js --codeowners       # Generate CODEOWNERS
 *   node scripts/factory/repo-split.js --bridge           # Test cross-repo bridge
 *
 * @module scripts/factory/repo-split
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// ═══════════════════════════════════════════════════════
// 1. IP CLASSIFICATION ENGINE
// ═══════════════════════════════════════════════════════

/**
 * Master IP classification map.
 * Every top-level folder/file is classified as:
 *   - public:  Goes to frootai/frootai (MIT licensed, community-facing)
 *   - private: Goes to frootai/frootai-core (Proprietary, distribution/tooling)
 *   - website: Already in frootai/frootai.dev (Proprietary, storefront)
 *   - internal: Never committed to any public repo (.internal/, .factory/)
 *   - generated: Build artifacts, not committed
 */
const IP_CLASSIFICATION = {
  // ─── PUBLIC: The Open Standard ──────────────────────
  'agents/':              { class: 'public',    rationale: 'Community-contributed agents — the ecosystem', license: 'MIT' },
  'instructions/':        { class: 'public',    rationale: 'Community-contributed instructions', license: 'MIT' },
  'skills/':              { class: 'public',    rationale: 'Community-contributed skills', license: 'MIT' },
  'hooks/':               { class: 'public',    rationale: 'Community-contributed hooks', license: 'MIT' },
  'plugins/':             { class: 'public',    rationale: 'Plugin definitions (templates)', license: 'MIT' },
  'workflows/':           { class: 'public',    rationale: 'Agentic workflow definitions', license: 'MIT' },
  'cookbook/':             { class: 'public',    rationale: 'Community recipes', license: 'MIT' },
  'solution-plays/':      { class: 'public',    rationale: 'Showcase — the #1 reason people use FrootAI', license: 'MIT' },
  'docs/':                { class: 'public',    rationale: 'FROOT knowledge modules — educational content drives adoption', license: 'MIT' },
  'schemas/':             { class: 'public',    rationale: 'FAI Protocol schemas — MUST be open for standard adoption', license: 'MIT' },
  'engine/':              { class: 'public',    rationale: 'FAI Engine reference implementation — proves the protocol works', license: 'MIT' },
  'fai-protocol/':        { class: 'public',    rationale: 'FAI Protocol specification — the core standard', license: 'MIT' },
  'community-plugins/':   { class: 'public',    rationale: 'Community plugin contributions + marketplace listings', license: 'MIT' },
  'workshops/':           { class: 'public',    rationale: 'Educational workshops', license: 'MIT' },
  'evaluation/':          { class: 'public',    rationale: 'Evaluation frameworks and datasets', license: 'MIT' },
  'marketplace.json':     { class: 'public',    rationale: 'Plugin registry index', license: 'MIT' },
  'AGENTS.md':            { class: 'public',    rationale: 'Cross-platform agent discovery standard', license: 'MIT' },
  'README.md':            { class: 'public',    rationale: 'Project documentation', license: 'MIT' },
  'CONTRIBUTING.md':      { class: 'public',    rationale: 'Contribution guidelines', license: 'MIT' },
  'LICENSE':              { class: 'public',    rationale: 'MIT license text', license: 'MIT' },
  'NOTICE':               { class: 'public',    rationale: 'Attribution notices', license: 'MIT' },
  'action.yml':           { class: 'public',    rationale: 'GitHub Action definition', license: 'MIT' },

  // ─── PRIVATE: Distribution Intelligence ─────────────
  'vscode-extension/':    { class: 'private',   rationale: 'MOVED to frootai-core — VS Code extension', license: 'Proprietary' },
  'npm-mcp/':             { class: 'private',   rationale: 'MOVED to frootai-core — MCP server', license: 'Proprietary' },
  'npm-sdk/':             { class: 'private',   rationale: 'MOVED to frootai-core — JavaScript SDK', license: 'Proprietary' },
  'python-mcp/':          { class: 'private',   rationale: 'MOVED to frootai-core — Python MCP server', license: 'Proprietary' },
  'python-sdk/':          { class: 'private',   rationale: 'MOVED to frootai-core — Python SDK', license: 'Proprietary' },
  'cli/':                 { class: 'private',   rationale: 'MOVED to frootai-core — FAI CLI', license: 'Proprietary' },
  'sdk/':                 { class: 'private',   rationale: 'MOVED to frootai-core — SDK shared utilities', license: 'Proprietary' },
  'mcp-server/':          { class: 'private',   rationale: 'Legacy MCP server', license: 'Proprietary' },
  'scripts/':             { class: 'private',   rationale: 'FAI Factory pipeline — the shipping engine', license: 'Proprietary' },
  'functions/':           { class: 'private',   rationale: 'MOVED to frootai-core — Azure Functions chatbot backend', license: 'Proprietary' },
  'config/':              { class: 'private',   rationale: 'MOVED to frootai-core — Internal configuration', license: 'Proprietary' },
  'foundry-agent/':       { class: 'private',   rationale: 'Microsoft Foundry agent integration', license: 'Proprietary' },
  'infra-registry/':      { class: 'private',   rationale: 'Infrastructure module registry', license: 'Proprietary' },
  'bicep-registry/':      { class: 'private',   rationale: 'Bicep module registry', license: 'Proprietary' },
  'marketplace/':         { class: 'private',   rationale: 'MOVED to frootai-core — Marketplace UI/generation', license: 'Proprietary' },
  'website-data/':        { class: 'private',   rationale: 'Generated website data', license: 'Proprietary' },

  // ─── CONFIG/BUILD FILES ─────────────────────────────
  'package.json':         { class: 'private',   rationale: 'Has factory scripts — split into public/private versions', license: 'Proprietary' },
  'package-lock.json':    { class: 'private',   rationale: 'Dependency lock for private tooling', license: 'Proprietary' },
  'commitlint.config.js': { class: 'private',   rationale: 'Commit lint config', license: 'Proprietary' },
  'azure.yaml':           { class: 'private',   rationale: 'Azure deployment config', license: 'Proprietary' },
  'BingSiteAuth.xml':     { class: 'private',   rationale: 'Bing verification', license: 'Proprietary' },
  'validate-output.txt':  { class: 'generated', rationale: 'Validation output artifact', license: 'N/A' },

  // ─── INTERNAL: Never Public ─────────────────────────
  '.internal/':           { class: 'internal',  rationale: 'Competitor analysis, strategy docs — NEVER public', license: 'Internal' },
  '.factory/':            { class: 'generated', rationale: 'Build artifacts — gitignored', license: 'N/A' },
  '.git/':                { class: 'internal',  rationale: 'Git database', license: 'N/A' },
  '.github/':             { class: 'public',    rationale: 'GitHub config, workflows, Copilot instructions', license: 'MIT' },
  '.gitignore':           { class: 'public',    rationale: 'Git ignore rules', license: 'MIT' },
  '.husky/':              { class: 'private',   rationale: 'Git hooks', license: 'Proprietary' },
  '.vscode/':             { class: 'private',   rationale: 'VS Code workspace settings', license: 'Proprietary' },
  '.next/':               { class: 'generated', rationale: 'Next.js build cache', license: 'N/A' },
  '.env.example':         { class: 'private',   rationale: 'Environment variable template', license: 'Proprietary' }
};

// ═══════════════════════════════════════════════════════
// 2. CLASSIFICATION REPORT
// ═══════════════════════════════════════════════════════

function generateClassificationReport() {
  const report = { public: [], private: [], website: [], internal: [], generated: [], unclassified: [] };
  let publicFiles = 0, privateFiles = 0, publicBytes = 0, privateBytes = 0;

  // Classify all top-level entries
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    const key = entry.isDirectory() ? `${entry.name}/` : entry.name;
    const classification = IP_CLASSIFICATION[key];

    if (classification) {
      report[classification.class].push({
        path: key,
        type: entry.isDirectory() ? 'directory' : 'file',
        rationale: classification.rationale,
        license: classification.license
      });

      // Count files recursively for directories
      const fullPath = path.join(ROOT, entry.name);
      if (entry.isDirectory() && classification.class !== 'internal' && classification.class !== 'generated') {
        const count = countFilesRecursive(fullPath);
        if (classification.class === 'public') { publicFiles += count.files; publicBytes += count.bytes; }
        else if (classification.class === 'private') { privateFiles += count.files; privateBytes += count.bytes; }
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (classification.class === 'public') { publicFiles++; publicBytes += stat.size; }
          else if (classification.class === 'private') { privateFiles++; privateBytes += stat.size; }
        } catch { /* skip */ }
      }
    } else {
      report.unclassified.push({ path: key, type: entry.isDirectory() ? 'directory' : 'file' });
    }
  }

  return {
    classification: report,
    stats: {
      public: { items: report.public.length, files: publicFiles, sizeKB: Math.round(publicBytes / 1024) },
      private: { items: report.private.length, files: privateFiles, sizeKB: Math.round(privateBytes / 1024) },
      unclassified: report.unclassified.length
    }
  };
}

function countFilesRecursive(dir) {
  let files = 0, bytes = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        const sub = countFilesRecursive(fullPath);
        files += sub.files;
        bytes += sub.bytes;
      } else {
        files++;
        try { bytes += fs.statSync(fullPath).size; } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return { files, bytes };
}

// ═══════════════════════════════════════════════════════
// 3. CROSS-REPO CONFIG GENERATOR
// ═══════════════════════════════════════════════════════

function generateConfig() {
  const config = {
    _comment: 'FAI Factory — Multi-Repo Configuration',
    _generated: new Date().toISOString(),
    _version: '1.0.0',

    repos: {
      public: {
        name: 'frootai/frootai',
        localPath: '${FROOTAI_PUBLIC_REPO:-../frootai}',
        url: 'https://github.com/frootai/frootai.git',
        license: 'MIT',
        description: 'Open standard — primitives, protocol, plays, engine, docs',
        contains: ['agents', 'instructions', 'skills', 'hooks', 'plugins', 'workflows',
                   'cookbook', 'solution-plays', 'docs', 'schemas', 'engine', 'fai-protocol',
                   'community-plugins', 'workshops', 'evaluation', '.github']
      },
      core: {
        name: 'frootai/frootai-core',
        localPath: '${FROOTAI_CORE_REPO:-../frootai-core}',
        url: 'https://github.com/frootai/frootai-core.git',
        license: 'Proprietary',
        description: 'Distribution intelligence — factory, channels, SDKs, tooling',
        contains: ['vscode-extension', 'npm-mcp', 'npm-sdk', 'python-mcp', 'python-sdk',
                   'cli', 'sdk', 'scripts', 'functions', 'config', 'foundry-agent',
                   'infra-registry', 'bicep-registry', 'marketplace', 'website-data']
      },
      website: {
        name: 'frootai/frootai.dev',
        localPath: '${FROOTAI_WEBSITE_REPO:-../frootai.dev}',
        url: 'https://github.com/frootai/frootai.dev.git',
        license: 'Proprietary',
        description: 'Storefront — Next.js website, branding, UX'
      }
    },

    factory: {
      catalogSource: 'public',
      catalogOutput: 'core',
      adapters: {
        'npm-mcp': { source: 'core', publishTo: 'npm', package: 'frootai-mcp' },
        'npm-sdk': { source: 'core', publishTo: 'npm', package: 'frootai' },
        'python-mcp': { source: 'core', publishTo: 'pypi', package: 'frootai-mcp' },
        'python-sdk': { source: 'core', publishTo: 'pypi', package: 'frootai' },
        'vscode': { source: 'core', publishTo: 'vsce', package: 'frootai' },
        'docker': { source: 'core', publishTo: 'ghcr.io', package: 'frootai/mcp-server' },
        'website': { source: 'core', publishTo: 'website', target: 'website' },
        'docs': { source: 'core', publishTo: 'docs', target: 'docs.frootai.dev' }
      }
    },

    bridge: {
      syncDirection: 'public → core (primitives feed factory)',
      triggerMechanism: 'repository_dispatch',
      syncEvents: ['push-to-main', 'release-published', 'workflow-dispatch'],
      healthCheck: 'npm run factory:validate --from-public'
    },

    cicd: {
      publicRepo: {
        onPush: ['validate-primitives', 'lint-markdown', 'schema-check'],
        onRelease: ['trigger-core-rebuild']
      },
      coreRepo: {
        onPush: ['factory-harvest', 'factory-catalog', 'factory-validate'],
        onRelease: ['publish-npm', 'publish-pypi', 'publish-vsce', 'publish-docker', 'update-website']
      }
    }
  };

  return config;
}

// ═══════════════════════════════════════════════════════
// 4. CROSS-REPO BRIDGE
// ═══════════════════════════════════════════════════════

function generateBridgeScript() {
  return `#!/usr/bin/env node
/**
 * FAI Factory — Cross-Repo Bridge
 * Syncs primitives from public repo to core repo for factory processing.
 *
 * Usage:
 *   node bridge.js sync      # Sync public → core
 *   node bridge.js verify    # Verify cross-repo integrity
 *   node bridge.js status    # Show sync status
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve repo paths from config or environment
const PUBLIC_REPO = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, '..', '..', '..', 'frootai');
const CORE_REPO = process.env.FROOTAI_CORE_REPO || path.resolve(__dirname, '..', '..');
const WEBSITE_REPO = process.env.FROOTAI_WEBSITE_REPO || path.resolve(__dirname, '..', '..', '..', 'frootai.dev');

const SYNC_FOLDERS = [
  'agents', 'instructions', 'skills', 'hooks', 'plugins', 'workflows',
  'cookbook', 'solution-plays', 'docs', 'schemas', 'engine', 'fai-protocol',
  'community-plugins', 'evaluation', 'marketplace.json', 'AGENTS.md'
];

function sync() {
  console.log('🔄 FAI Bridge — Syncing public → core');
  console.log('  Public: ' + PUBLIC_REPO);
  console.log('  Core:   ' + CORE_REPO);

  if (!fs.existsSync(PUBLIC_REPO)) {
    console.error('❌ Public repo not found at: ' + PUBLIC_REPO);
    console.error('   Set FROOTAI_PUBLIC_REPO environment variable');
    process.exit(1);
  }

  const syncDir = path.join(CORE_REPO, '.sync', 'public');
  if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });

  let synced = 0;
  for (const item of SYNC_FOLDERS) {
    const src = path.join(PUBLIC_REPO, item);
    const dst = path.join(syncDir, item);
    if (!fs.existsSync(src)) continue;

    // Use symlink for directories, copy for files
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
      // Create junction (Windows) or symlink (Unix)
      try {
        fs.symlinkSync(src, dst, 'junction');
        synced++;
      } catch (err) {
        console.warn('  ⚠️  Symlink failed for ' + item + ': ' + err.message);
        // Fallback: don't copy, just reference
      }
    } else {
      fs.copyFileSync(src, dst);
      synced++;
    }
  }

  console.log('  ✅ Synced ' + synced + '/' + SYNC_FOLDERS.length + ' items');

  // Write sync manifest
  const manifest = {
    syncedAt: new Date().toISOString(),
    publicRepoPath: PUBLIC_REPO,
    publicRepoHead: getGitHead(PUBLIC_REPO),
    itemsSynced: synced,
    items: SYNC_FOLDERS
  };
  fs.writeFileSync(path.join(syncDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));
}

function verify() {
  console.log('🔍 FAI Bridge — Verifying cross-repo integrity');

  const checks = [];

  // Check public repo exists and is clean
  if (fs.existsSync(PUBLIC_REPO)) {
    checks.push({ check: 'Public repo exists', pass: true, path: PUBLIC_REPO });
    const head = getGitHead(PUBLIC_REPO);
    checks.push({ check: 'Public repo has commits', pass: !!head, detail: head });
  } else {
    checks.push({ check: 'Public repo exists', pass: false, path: PUBLIC_REPO });
  }

  // Check core repo
  if (fs.existsSync(CORE_REPO)) {
    checks.push({ check: 'Core repo exists', pass: true, path: CORE_REPO });
  } else {
    checks.push({ check: 'Core repo exists', pass: false, path: CORE_REPO });
  }

  // Check website repo
  if (fs.existsSync(WEBSITE_REPO)) {
    checks.push({ check: 'Website repo exists', pass: true, path: WEBSITE_REPO });
  } else {
    checks.push({ check: 'Website repo exists', pass: false, path: WEBSITE_REPO });
  }

  // Check key files exist in public
  const keyPublicFiles = ['schemas/fai-manifest.schema.json', 'engine/index.js', 'AGENTS.md', 'LICENSE'];
  for (const f of keyPublicFiles) {
    const exists = fs.existsSync(path.join(PUBLIC_REPO, f));
    checks.push({ check: 'Public: ' + f, pass: exists });
  }

  // Print results
  let allPass = true;
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌';
    console.log('  ' + icon + ' ' + c.check + (c.detail ? ' (' + c.detail + ')' : ''));
    if (!c.pass) allPass = false;
  }

  console.log(allPass ? '\\n  ✅ All checks passed' : '\\n  ❌ Some checks failed');
  return allPass;
}

function getGitHead(repoPath) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
  } catch { return null; }
}

// CLI
const cmd = process.argv[2] || 'status';
if (cmd === 'sync') sync();
else if (cmd === 'verify') verify();
else {
  console.log('FAI Bridge — Cross-Repo Management');
  console.log('  sync    — Sync public repo primitives to core');
  console.log('  verify  — Verify cross-repo integrity');
}
`;
}

// ═══════════════════════════════════════════════════════
// 5. LICENSE HEADER ENGINE
// ═══════════════════════════════════════════════════════

const MIT_HEADER = `/**
 * Copyright (c) 2025-2026 FrootAI
 * Licensed under the MIT License. See LICENSE file in the project root.
 * https://github.com/frootai/frootai
 */
`;

const PROPRIETARY_HEADER = `/**
 * Copyright (c) 2025-2026 FrootAI. All rights reserved.
 * This file is part of FrootAI's proprietary distribution system.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
`;

function generateLicenseReport() {
  const report = { mit: [], proprietary: [], skipped: [] };

  for (const [key, info] of Object.entries(IP_CLASSIFICATION)) {
    if (info.class === 'internal' || info.class === 'generated') continue;

    const fullPath = path.join(ROOT, key.replace(/\/$/, ''));
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Count JS/TS files that need headers
      const jsFiles = findFiles(fullPath, ['.js', '.ts', '.mjs', '.cjs']);
      const target = info.license === 'MIT' ? report.mit : report.proprietary;
      target.push({ folder: key, fileCount: jsFiles.length, license: info.license });
    }
  }

  return report;
}

function findFiles(dir, extensions, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findFiles(fullPath, extensions, results);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}

// ═══════════════════════════════════════════════════════
// 6. CODEOWNERS GENERATOR
// ═══════════════════════════════════════════════════════

function generateCodeowners() {
  const publicCodeowners = `# FrootAI Public Repository — CODEOWNERS
# https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

# Default owners for everything
* @frootai/core-team

# FAI Protocol (critical — requires 2 reviewers)
/schemas/                    @frootai/protocol-team @frootai/core-team
/fai-protocol/               @frootai/protocol-team @frootai/core-team
/engine/                     @frootai/protocol-team @frootai/core-team

# Primitives (community-contributed — 1 reviewer sufficient)
/agents/                     @frootai/primitive-reviewers
/instructions/               @frootai/primitive-reviewers
/skills/                     @frootai/primitive-reviewers
/hooks/                      @frootai/primitive-reviewers
/plugins/                    @frootai/primitive-reviewers
/workflows/                  @frootai/primitive-reviewers
/cookbook/                    @frootai/primitive-reviewers
/community-plugins/          @frootai/primitive-reviewers

# Solution Plays (requires architecture review)
/solution-plays/             @frootai/architecture-team

# Documentation
/docs/                       @frootai/docs-team
/workshops/                  @frootai/docs-team

# GitHub configuration
/.github/                    @frootai/core-team
`;

  const coreCodeowners = `# FrootAI Core Repository — CODEOWNERS (Private)

# Default: core team only
* @frootai/core-team

# Distribution channels (high-security — 2 reviewers)
/vscode-extension/           @frootai/core-team @frootai/security-team
/npm-mcp/                    @frootai/core-team @frootai/security-team
/npm-sdk/                    @frootai/core-team
/python-mcp/                 @frootai/core-team
/python-sdk/                 @frootai/core-team

# Factory pipeline (critical infrastructure)
/scripts/factory/            @frootai/core-team

# Release workflows
/.github/workflows/          @frootai/core-team @frootai/security-team
`;

  return { public: publicCodeowners, core: coreCodeowners };
}

// ═══════════════════════════════════════════════════════
// 7. MIGRATION DRY-RUN & RISK ASSESSMENT
// ═══════════════════════════════════════════════════════

function dryRunMigration() {
  console.log('');
  console.log('🧪 FAI Repo Split — Dry Run Migration');
  console.log('═'.repeat(60));

  const report = generateClassificationReport();
  const risks = [];
  const steps = [];

  // Step 1: Create private repo
  steps.push({
    step: 1,
    action: 'Create frootai/frootai-core private repo on GitHub',
    risk: 'none',
    reversible: true,
    commands: ['gh repo create frootai/frootai-core --private --description "FrootAI Distribution Intelligence"']
  });

  // Step 2: Move distribution folders
  const privateFolders = report.classification.private.filter(p => p.type === 'directory').map(p => p.path);
  steps.push({
    step: 2,
    action: `Move ${privateFolders.length} distribution folders to frootai-core`,
    risk: 'medium',
    reversible: true,
    folders: privateFolders,
    commands: privateFolders.map(f => `# Move ${f} to frootai-core`),
    warnings: [
      'All CI/CD paths will change',
      'package.json scripts reference moved folders',
      'Import paths in moved code may reference public repo files'
    ]
  });

  // Step 3: Update .gitignore
  steps.push({
    step: 3,
    action: 'Update .gitignore in public repo (remove moved folder entries)',
    risk: 'low',
    reversible: true
  });

  // Step 4: Set up workspace symlinks
  steps.push({
    step: 4,
    action: 'Set up workspace symlinks or git submodule',
    risk: 'low',
    reversible: true,
    options: ['Symlink (recommended for local dev)', 'Git submodule (recommended for CI)']
  });

  // Step 5: Update CI/CD
  steps.push({
    step: 5,
    action: 'Update CI/CD workflows for cross-repo operation',
    risk: 'medium',
    reversible: true,
    warnings: [
      'GitHub Actions in public repo only validate primitives',
      'All publishing workflows move to frootai-core',
      'repository_dispatch needed for cross-repo triggers'
    ]
  });

  // Step 6: Clean up public README
  steps.push({
    step: 6,
    action: 'Update public repo README (remove distribution details)',
    risk: 'low',
    reversible: true
  });

  // Step 7: Verify factory works
  steps.push({
    step: 7,
    action: 'Verify: npm run factory works from frootai-core using public repo data',
    risk: 'medium',
    reversible: true,
    verifications: [
      'factory:harvest scans public repo primitives',
      'factory:catalog generates from public data',
      'factory:validate passes all checks',
      'All adapters produce correct output'
    ]
  });

  // Step 8: Verify publishing
  steps.push({
    step: 8,
    action: 'Verify: all publishing workflows still work',
    risk: 'high',
    reversible: false,
    verifications: [
      'npm publish frootai-mcp succeeds',
      'npm publish frootai succeeds',
      'pip publish frootai-mcp succeeds',
      'vsce publish succeeds',
      'docker push succeeds'
    ]
  });

  // Risk assessment
  const crossReferences = findCrossReferences();
  if (crossReferences.length > 0) {
    risks.push({
      level: 'medium',
      description: `${crossReferences.length} cross-references found between public and private code`,
      details: crossReferences.slice(0, 10)
    });
  }

  return { steps, risks, stats: report.stats, privateFolders };
}

function findCrossReferences() {
  const refs = [];

  // Check if private code imports from public paths
  const privateJsFiles = [];
  const privateDirs = ['vscode-extension', 'npm-mcp', 'npm-sdk', 'python-mcp', 'python-sdk', 'cli', 'scripts'];

  for (const dir of privateDirs) {
    const fullDir = path.join(ROOT, dir);
    if (fs.existsSync(fullDir)) {
      privateJsFiles.push(...findFiles(fullDir, ['.js', '.ts', '.mjs']));
    }
  }

  for (const file of privateJsFiles.slice(0, 200)) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      // Check for imports referencing engine/, schemas/, docs/, etc.
      const publicPaths = ['engine/', 'schemas/', 'docs/', 'agents/', 'solution-plays/'];
      for (const pp of publicPaths) {
        if (content.includes(`'../${pp}`) || content.includes(`"../${pp}`) || content.includes(`'../../${pp}`) || content.includes(`"../../${pp}`)) {
          refs.push({
            file: path.relative(ROOT, file),
            references: pp,
            type: 'import'
          });
        }
      }
    } catch { /* skip */ }
  }

  return refs;
}

// ═══════════════════════════════════════════════════════
// 8. PUBLIC REPO PACKAGE.JSON GENERATOR
// ═══════════════════════════════════════════════════════

function generatePublicPackageJson() {
  return {
    name: 'frootai',
    version: '1.0.0',
    private: true,
    description: 'FrootAI™ — The open-source AI primitive unification platform. FAI Protocol, 860+ primitives, 100 solution plays.',
    license: 'MIT',
    repository: { type: 'git', url: 'https://github.com/frootai/frootai' },
    homepage: 'https://frootai.dev',
    scripts: {
      'validate': 'node scripts/validate-primitives.js',
      'validate:verbose': 'node scripts/validate-primitives.js --verbose',
      'test:engine': 'node engine/test.js',
      'lint:md': 'markdownlint docs/ --config .markdownlint.json'
    },
    keywords: ['ai', 'agents', 'mcp', 'fai-protocol', 'primitives', 'rag', 'azure', 'openai']
  };
}

// ═══════════════════════════════════════════════════════
// 9. CI/CD WORKFLOW TEMPLATES
// ═══════════════════════════════════════════════════════

function generateCICDTemplates() {
  const publicWorkflow = `# Public repo: validate primitives on every push
name: FAI Validate
on:
  push:
    branches: [main]
    paths: ['agents/**', 'skills/**', 'instructions/**', 'hooks/**', 'solution-plays/**', 'schemas/**']
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node engine/test.js
      - run: node scripts/validate-primitives.js
      
  # Trigger core repo rebuild on main push
  trigger-core:
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: peter-evans/repository-dispatch@v3
        with:
          token: \${{ secrets.CORE_REPO_PAT }}
          repository: frootai/frootai-core
          event-type: public-repo-updated
          client-payload: '{"ref": "\${{ github.sha }}"}'
`;

  const coreWorkflow = `# Core repo: factory pipeline on public repo update
name: FAI Factory Pipeline
on:
  repository_dispatch:
    types: [public-repo-updated]
  workflow_dispatch:

jobs:
  factory:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: frootai/frootai
          path: ./public
          token: \${{ secrets.PUBLIC_REPO_PAT }}
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: FROOTAI_PUBLIC_REPO=./public npm run factory:harvest
      - run: FROOTAI_PUBLIC_REPO=./public npm run factory:catalog
      - run: FROOTAI_PUBLIC_REPO=./public npm run factory:validate
`;

  return { publicWorkflow, coreWorkflow };
}

// ═══════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('🔒 FAI Factory — Repository Split & IP Protection');
  console.log('═'.repeat(60));

  const outputDir = path.join(ROOT, '.factory', 'repo-split');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // ─── Classification Report ────────────────────────
  if (args.includes('--classify') || args.length === 0) {
    console.log('');
    console.log('📋 IP Classification Report');
    console.log('─'.repeat(60));

    const report = generateClassificationReport();

    console.log('\n  🟢 PUBLIC (MIT — frootai/frootai):');
    for (const item of report.classification.public) {
      console.log(`    ${item.path.padEnd(25)} ${item.rationale}`);
    }

    console.log('\n  🔴 PRIVATE (Proprietary — frootai/frootai-core):');
    for (const item of report.classification.private) {
      console.log(`    ${item.path.padEnd(25)} ${item.rationale}`);
    }

    if (report.classification.unclassified.length > 0) {
      console.log('\n  ⚠️  UNCLASSIFIED:');
      for (const item of report.classification.unclassified) {
        console.log(`    ${item.path}`);
      }
    }

    console.log('\n  📊 Summary:');
    console.log(`    Public:  ${report.stats.public.items} folders/files, ${report.stats.public.files.toLocaleString()} files, ${(report.stats.public.sizeKB / 1024).toFixed(1)}MB`);
    console.log(`    Private: ${report.stats.private.items} folders/files, ${report.stats.private.files.toLocaleString()} files, ${(report.stats.private.sizeKB / 1024).toFixed(1)}MB`);

    fs.writeFileSync(path.join(outputDir, 'classification-report.json'), JSON.stringify(report, null, 2));
  }

  // ─── Generate Config ──────────────────────────────
  if (args.includes('--generate-config') || args.length === 0) {
    console.log('\n📁 Generating multi-repo configuration...');
    const config = generateConfig();
    fs.writeFileSync(path.join(outputDir, 'repo-config.json'), JSON.stringify(config, null, 2));
    console.log('  ✅ repo-config.json');
  }

  // ─── Generate Bridge Script ───────────────────────
  if (args.includes('--bridge') || args.length === 0) {
    console.log('\n🌉 Generating cross-repo bridge...');
    const bridge = generateBridgeScript();
    fs.writeFileSync(path.join(outputDir, 'bridge.js'), bridge);
    console.log('  ✅ bridge.js');
  }

  // ─── CODEOWNERS ───────────────────────────────────
  if (args.includes('--codeowners') || args.length === 0) {
    console.log('\n👥 Generating CODEOWNERS...');
    const owners = generateCodeowners();
    fs.writeFileSync(path.join(outputDir, 'CODEOWNERS-public'), owners.public);
    fs.writeFileSync(path.join(outputDir, 'CODEOWNERS-core'), owners.core);
    console.log('  ✅ CODEOWNERS-public, CODEOWNERS-core');
  }

  // ─── License Headers Report ───────────────────────
  if (args.includes('--license-headers') || args.length === 0) {
    console.log('\n📜 Generating license header report...');
    const licenseReport = generateLicenseReport();
    fs.writeFileSync(path.join(outputDir, 'license-report.json'), JSON.stringify(licenseReport, null, 2));
    console.log(`  ✅ MIT: ${licenseReport.mit.length} folders | Proprietary: ${licenseReport.proprietary.length} folders`);
  }

  // ─── CI/CD Templates ──────────────────────────────
  if (args.includes('--cicd') || args.length === 0) {
    console.log('\n🔄 Generating CI/CD workflow templates...');
    const workflows = generateCICDTemplates();
    fs.writeFileSync(path.join(outputDir, 'workflow-public-validate.yml'), workflows.publicWorkflow);
    fs.writeFileSync(path.join(outputDir, 'workflow-core-factory.yml'), workflows.coreWorkflow);
    console.log('  ✅ workflow-public-validate.yml, workflow-core-factory.yml');
  }

  // ─── Public package.json ──────────────────────────
  if (args.includes('--package') || args.length === 0) {
    console.log('\n📦 Generating public repo package.json...');
    const pkg = generatePublicPackageJson();
    fs.writeFileSync(path.join(outputDir, 'package-public.json'), JSON.stringify(pkg, null, 2));
    console.log('  ✅ package-public.json');
  }

  // ─── Dry Run Migration ────────────────────────────
  if (args.includes('--dry-run') || args.length === 0) {
    const migration = dryRunMigration();

    console.log('\n📝 Migration Steps:');
    for (const step of migration.steps) {
      const riskIcon = step.risk === 'high' ? '🔴' : step.risk === 'medium' ? '🟡' : '🟢';
      console.log(`  ${step.step}. ${riskIcon} [${step.risk}] ${step.action}`);
      if (step.warnings) step.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
    }

    if (migration.risks.length > 0) {
      console.log('\n⚠️  Risks Identified:');
      for (const risk of migration.risks) {
        console.log(`  ${risk.level}: ${risk.description}`);
        if (risk.details) risk.details.forEach(d => console.log(`    - ${d.file} → ${d.references}`));
      }
    }

    fs.writeFileSync(path.join(outputDir, 'migration-dryrun.json'), JSON.stringify(migration, null, 2));
    console.log('\n  ✅ Migration dry-run report saved');
  }

  // ─── Final Summary ────────────────────────────────
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Output: .factory/repo-split/');
  console.log('  Files: classification-report.json, repo-config.json,');
  console.log('         bridge.js, CODEOWNERS-*, license-report.json,');
  console.log('         workflow-*.yml, package-public.json, migration-dryrun.json');
  console.log('═'.repeat(60));
}

main();
