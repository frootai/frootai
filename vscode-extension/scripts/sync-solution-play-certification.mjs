#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);
const source = path.resolve(sourceArg || process.env.FROOTAI_CERTIFICATION_INDEX || path.join(root, '..', '..', '..', 'frootai', '.tmp-certified-plays', 'orchard', 'registry', 'solution-play-certification-index.v1.json'));
const target = path.join(root, 'src', 'data', 'solution-play-certification.json');
if (!fs.existsSync(source)) throw new Error(`Certification index not found: ${source}`);
const document = JSON.parse(fs.readFileSync(source, 'utf8'));
if (document.count !== 101 || document.plays?.length !== 101) throw new Error('Certification index must contain 101 plays');
const levels = new Set(['designed', 'scaffold_verified', 'build_verified', 'evaluation_verified', 'deploy_verified', 'production_observed']);
const slugs = new Set();
for (const record of document.plays) {
	if (!/^\d{2,3}-[a-z0-9-]+$/.test(record.slug) || slugs.has(record.slug)) throw new Error(`Invalid or duplicate certification slug: ${record.slug}`);
	slugs.add(record.slug);
	if (record.level !== null && !levels.has(record.level)) throw new Error(`Unsupported certification level: ${record.level}`);
	if (!/^[a-f0-9]{64}$/.test(record.content_sha256)) throw new Error(`Invalid content hash: ${record.slug}`);
	if (!/^[a-f0-9]{40}$/.test(record.commit_sha) || record.commit_sha === '0'.repeat(40)) throw new Error(`Invalid commit provenance: ${record.slug}`);
	if (record.valid !== (record.level !== null)) throw new Error(`Certification validity mismatch: ${record.slug}`);
	if (record.valid && (!Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= Date.now())) throw new Error(`Expired certification cannot be synchronized: ${record.slug}`);
}
if (document.plays.filter((record) => record.level === 'evaluation_verified').length !== 5) throw new Error('Expected exactly five Evaluation Verified flagships');
if (document.plays.some((record) => ['deploy_verified', 'production_observed'].includes(record.level))) throw new Error('No play may claim deployment or production evidence in this release');
fs.writeFileSync(target, `${JSON.stringify(document)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ count: document.count, target })}\n`);
