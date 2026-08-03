#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { LEARNING_MODULES, SPECIALTY_META, moduleSlug } = require('./factory/adapters/docs');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const GENERATED_DIR = path.join(ROOT, '.factory', 'docs', 'learning');
const GENERATED_SPECIALTIES_DIR = path.join(ROOT, '.factory', 'docs', 'specialties');
const REVIEW_DATE = process.env.FROOT_DOCS_AUDIT_DATE
  ? new Date(`${process.env.FROOT_DOCS_AUDIT_DATE}T00:00:00Z`)
  : new Date();
const STALE_AFTER_DAYS = 120;
const VOLATILE_MODULES = new Set(['F2', 'F4', 'R1', 'R3', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'T1', 'T2', 'T3', 'REF', 'QUIZ']);
const FORBIDDEN_PATTERNS = [
  { pattern: /\/\.well-known\/agent\.json/g, label: 'legacy A2A Agent Card path' },
  { pattern: /api_version\s*=\s*["'][^"']*preview["']/g, label: 'hard-coded preview API version' }
];

if (Number.isNaN(REVIEW_DATE.getTime())) {
  throw new Error('FROOT_DOCS_AUDIT_DATE must use YYYY-MM-DD format');
}

function parseReviewDate(content) {
  const match = content.match(/\*\*Last Updated:\*\*\s+([A-Za-z]+\s+\d{4})/);
  if (!match) return null;
  const parsed = new Date(`${match[1]} 1 00:00:00 UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function countExternalLinks(content) {
  return new Set(content.match(/https:\/\/[^\s)>]+/g) || []).size;
}

let errors = 0;
let warnings = 0;

console.log(`FROOT documentation audit (${LEARNING_MODULES.length} modules)`);
console.log('ID    Source  MDX  Review       Links  Findings');

for (const module of LEARNING_MODULES) {
  const sourcePath = path.join(DOCS_DIR, module.file);
  const generatedPath = path.join(GENERATED_DIR, `${moduleSlug(module)}.mdx`);
  const sourceExists = fs.existsSync(sourcePath);
  const generatedExists = fs.existsSync(generatedPath);
  const findings = [];
  let reviewLabel = 'missing';
  let linkCount = 0;

  if (!sourceExists) {
    errors++;
    findings.push('missing source');
  } else {
    const content = fs.readFileSync(sourcePath, 'utf8');
    const reviewDate = parseReviewDate(content);
    linkCount = countExternalLinks(content);

    if (!reviewDate) {
      warnings++;
      findings.push('missing Last Updated');
    } else {
      reviewLabel = reviewDate.toISOString().slice(0, 7);
      if (daysBetween(reviewDate, REVIEW_DATE) > STALE_AFTER_DAYS) {
        warnings++;
        findings.push('full review stale');
      }
    }

    if (VOLATILE_MODULES.has(module.id) && !/\*\*[^*]*verified:\*\*\s+\d{4}-\d{2}-\d{2}/i.test(content)) {
      warnings++;
      findings.push('volatile facts not dated');
    }

    if (linkCount === 0) {
      warnings++;
      findings.push('no external sources');
    }

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(content)) {
        errors++;
        findings.push(rule.label);
      }
      rule.pattern.lastIndex = 0;
    }
  }

  if (!generatedExists) {
    errors++;
    findings.push('missing generated MDX');
  }

  console.log(
    `${module.id.padEnd(5)} ${sourceExists ? 'yes' : 'NO '}     ${generatedExists ? 'yes' : 'NO '}  ${reviewLabel.padEnd(12)} ${String(linkCount).padEnd(6)} ${findings.join('; ') || 'ok'}`
  );
}

for (const specialty of SPECIALTY_META.filter(item => item.guide)) {
  const sourcePath = path.join(DOCS_DIR, specialty.guide);
  const generatedPath = path.join(GENERATED_SPECIALTIES_DIR, `${specialty.key}-deep-dive.mdx`);
  const sourceExists = fs.existsSync(sourcePath);
  const generatedExists = fs.existsSync(generatedPath);
  const findings = [];

  if (!sourceExists) {
    errors++;
    findings.push('missing specialty source');
  }
  if (!generatedExists) {
    errors++;
    findings.push('missing specialty MDX');
  }
  if (sourceExists) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    if (!parseReviewDate(content)) {
      warnings++;
      findings.push('missing Last Updated');
    }
    if (!/\*\*[^*]*verified:\*\*\s+\d{4}-\d{2}-\d{2}/i.test(content)) {
      warnings++;
      findings.push('specialty facts not dated');
    }
  }

  console.log(`${specialty.id.padEnd(5)} ${sourceExists ? 'yes' : 'NO '}     ${generatedExists ? 'yes' : 'NO '}  specialty                ${findings.join('; ') || 'ok'}`);
}

console.log(`\nResult: ${errors} error(s), ${warnings} warning(s)`);
console.log('Warnings identify the refresh queue; structural errors fail the command.');

if (errors > 0) process.exitCode = 1;