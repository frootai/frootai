/**
 * FAI Engine — Harness Portfolio Report
 * One view of how every play is harnessed: profile adoption, exemptions,
 * waivers about to expire and plays carrying warnings.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { compileManifest, DEFAULT_PROFILES_ROOT } from './harness-resolver.js';

/**
 * @param {string} playsRoot - solution-plays directory
 * @param {{ now?: Date, profilesRoot?: string, exemptionsPath?: string }} [options]
 */
function buildHarnessReport(playsRoot, { now = new Date(), profilesRoot = DEFAULT_PROFILES_ROOT, exemptionsPath } = {}) {
  const exemptionsFile = exemptionsPath ?? resolve(profilesRoot, '..', 'exemptions.json');
  const exemptions = existsSync(exemptionsFile) ? JSON.parse(readFileSync(exemptionsFile, 'utf8')).plays || {} : {};
  const today = now.toISOString().slice(0, 10);

  const report = {
    generatedAt: now.toISOString(),
    plays: 0,
    harnessed: 0,
    exempt: 0,
    unharnessed: [],
    failing: [],
    byProfile: {},
    waivers: [],
    warnings: [],
    exemptions: []
  };

  for (const play of readdirSync(playsRoot).filter(name => /^\d{2,3}-/.test(name)).sort()) {
    const manifestPath = join(playsRoot, play, 'spec', 'fai-manifest.json');
    if (!existsSync(manifestPath)) continue;
    report.plays++;
    const compiled = compileManifest(manifestPath, { now, profilesRoot });
    if (compiled.errors.length > 0) report.failing.push({ play, errors: compiled.errors });
    for (const warning of compiled.warnings || []) report.warnings.push({ play, warning });

    if (compiled.harness) {
      report.harnessed++;
      report.byProfile[compiled.harness.extends] = (report.byProfile[compiled.harness.extends] || 0) + 1;
      for (const waiver of compiled.harness.waivers) report.waivers.push({ play, ...waiver });
    } else if (exemptions[play]) {
      report.exempt++;
      report.exemptions.push({ play, ...exemptions[play], overdue: exemptions[play].review_by < today });
    } else {
      report.unharnessed.push(play);
    }
  }

  report.waivers.sort((a, b) => a.expires.localeCompare(b.expires));
  report.exemptions.sort((a, b) => a.review_by.localeCompare(b.review_by) || a.play.localeCompare(b.play));
  report.coverage = report.plays === 0 ? 0 : Math.round((report.harnessed / report.plays) * 1000) / 10;
  report.healthy = report.failing.length === 0 && report.unharnessed.length === 0 && !report.exemptions.some(e => e.overdue);
  return report;
}

export { buildHarnessReport };
