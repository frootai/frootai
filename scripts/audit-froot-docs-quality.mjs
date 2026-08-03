#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const REPORT_PATH = path.join(ROOT, '.factory', 'docs', 'quality-report.json');
const require = createRequire(import.meta.url);
const { LEARNING_MODULES, SPECIALTY_META } = require('./factory/adapters/docs');

const AUTHORED_DOCUMENTS = [
  ...LEARNING_MODULES.map((module) => ({ ...module, type: documentType(module.id) })),
  ...SPECIALTY_META
    .filter((specialty) => specialty.guide)
    .map((specialty) => ({ id: specialty.id, file: specialty.guide, title: specialty.title, type: 'specialty' })),
];

function documentType(id) {
  if (id === 'QUIZ') return 'assessment';
  if (id === 'F3' || id === 'REF') return 'reference';
  return 'teaching';
}

function countMatches(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function codeBlocks(content) {
  return [...content.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```\s*$/gm)].map((match) => ({
    language: match[1].trim().split(/\s+/)[0].toLowerCase(),
    line: content.slice(0, match.index).split(/\r?\n/).length,
    preview: match[2].trim().split(/\r?\n/)[0]?.slice(0, 100) || '(empty)',
  }));
}

export function labelUnlabeledCodeBlocks(content) {
  let insideFence = false;
  return content.replace(/^```([^\r\n]*)$/gm, (line, info) => {
    if (insideFence) {
      insideFence = false;
      return line;
    }
    insideFence = true;
    return info.trim() ? line : '```text';
  });
}

function fixCodeFences() {
  let changed = 0;
  for (const metadata of AUTHORED_DOCUMENTS) {
    const sourcePath = path.join(DOCS_DIR, metadata.file);
    const content = fs.readFileSync(sourcePath, 'utf8');
    const fixed = labelUnlabeledCodeBlocks(content);
    if (fixed === content) continue;
    fs.writeFileSync(sourcePath, fixed, 'utf8');
    changed++;
  }
  return changed;
}

function slugifyHeading(heading) {
  return heading.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function duplicateHeadings(content) {
  const seen = new Set();
  const duplicates = new Set();
  for (const match of content.matchAll(/^#{2,4}\s+(.+)$/gm)) {
    const slug = slugifyHeading(match[1]);
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  return [...duplicates];
}

function inspectDocument(metadata) {
  const sourcePath = path.join(DOCS_DIR, metadata.file);
  if (!fs.existsSync(sourcePath)) {
    return {
      ...metadata,
      errors: ['missing canonical source'],
      warnings: [],
    };
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  const blocks = codeBlocks(content);
  const diagrams = blocks.filter((block) => block.language === 'mermaid').length;
  const executableBlocks = blocks.length - diagrams;
  const hasLearningOutcomes = /^##\s+(Learning (Objectives|Outcomes)|What You(?:'|’)ll Learn)/im.test(content);
  const hasPrerequisites = /\*\*Prerequisites:\*\*/i.test(content) || /^##\s+Prerequisites/im.test(content);
  const scenarios = countMatches(content, /^#{2,4}\s+.*(Case Study|Scenario|Hands-On|Lab|Workshop)/gim);
  const knowledgeChecks = metadata.type === 'assessment'
    ? countMatches(content, /^###\s+Q\d+:/gm)
    : countMatches(content, /^#{2,4}\s+.*(Knowledge Check|Check Your Understanding|Self-Check)/gim);
  const externalSources = new Set(content.match(/https:\/\/[^\s)>]+/g) || []).size;
  const hasLastUpdated = /\*\*Last Updated:\*\*\s+[A-Za-z]+\s+\d{4}/.test(content);
  const hasVerification = /\*\*[^*]*verified:\*\*\s+\d{4}-\d{2}-\d{2}/i.test(content);
  const unlabeledBlocks = blocks.filter((block) => !block.language);
  const unlabeledCodeBlocks = unlabeledBlocks.length;
  const fenceMarkers = countMatches(content, /^```/gm);
  const errors = [];
  const warnings = [];

  if (!/^#\s+\S+/m.test(content)) errors.push('missing title');
  if (!hasLastUpdated) errors.push('missing Last Updated metadata');
  if (!hasVerification) errors.push('missing dated verification');
  if (externalSources === 0) errors.push('missing external authority');
  if (unlabeledCodeBlocks > 0) errors.push(`${unlabeledCodeBlocks} unlabeled code block(s)`);
  if (fenceMarkers % 2 !== 0) errors.push('unbalanced fenced code block');

  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && !hasLearningOutcomes) warnings.push('missing learning outcomes');
  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && !hasPrerequisites) warnings.push('missing prerequisites');
  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && diagrams < 2) warnings.push('fewer than 2 diagrams');
  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && executableBlocks < 2) warnings.push('fewer than 2 code or configuration examples');
  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && scenarios < 1) warnings.push('missing scenario or lab');
  if ((metadata.type === 'teaching' || metadata.type === 'specialty') && knowledgeChecks < 1) warnings.push('missing knowledge check');

  return {
    id: metadata.id,
    file: metadata.file,
    title: metadata.title,
    type: metadata.type,
    words: content.split(/\s+/).filter(Boolean).length,
    headings: countMatches(content, /^#{2,4}\s+/gm),
    tables: countMatches(content, /^\|.+\|\s*$/gm),
    diagrams,
    codeBlocks: executableBlocks,
    codeLanguages: [...new Set(blocks.map((block) => block.language).filter(Boolean))].sort(),
    unlabeledCodeBlocks,
    unlabeledCodeBlockDetails: unlabeledBlocks.map(({ line, preview }) => ({ line, preview })),
    externalSources,
    learningOutcomes: hasLearningOutcomes,
    prerequisites: hasPrerequisites,
    scenarios,
    knowledgeChecks,
    hasLastUpdated,
    hasVerification,
    duplicateHeadingIds: duplicateHeadings(content),
    errors,
    warnings,
  };
}

export function auditDocuments({ auditDate = process.env.FROOT_DOCS_AUDIT_DATE || new Date().toISOString().slice(0, 10) } = {}) {
  const documents = AUTHORED_DOCUMENTS.map(inspectDocument);
  const types = Object.fromEntries(
    ['assessment', 'reference', 'specialty', 'teaching'].map((type) => [type, documents.filter((document) => document.type === type).length]),
  );
  const coverage = Object.fromEntries(
    ['learningOutcomes', 'prerequisites'].map((field) => [field, documents.filter((document) => document[field]).length]),
  );
  coverage.diagrams = documents.reduce((sum, document) => sum + (document.diagrams || 0), 0);
  coverage.codeBlocks = documents.reduce((sum, document) => sum + (document.codeBlocks || 0), 0);
  coverage.scenarios = documents.reduce((sum, document) => sum + (document.scenarios || 0), 0);
  coverage.knowledgeChecks = documents.reduce((sum, document) => sum + (document.knowledgeChecks || 0), 0);

  return {
    schemaVersion: 1,
    auditDate,
    summary: {
      documents: documents.length,
      errors: documents.reduce((sum, document) => sum + document.errors.length, 0),
      warnings: documents.reduce((sum, document) => sum + document.warnings.length, 0),
      types,
      coverage,
    },
    documents,
  };
}

function run() {
  if (process.argv.includes('--fix-code-fences')) {
    console.log(`Labeled code fences in ${fixCodeFences()} document(s)`);
  }
  const report = auditDocuments();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`FROOT docs quality: ${report.summary.documents} documents, ${report.summary.errors} error(s), ${report.summary.warnings} modernization warning(s)`);
  console.log(`Coverage: ${report.summary.coverage.diagrams} diagrams, ${report.summary.coverage.codeBlocks} code/config blocks, ${report.summary.coverage.scenarios} scenarios/labs, ${report.summary.coverage.knowledgeChecks} knowledge checks`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (report.summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) run();