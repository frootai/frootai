/**
 * FAI Engine - Generic Subject Materializer
 * Renders profile-owned physical files into agent, product, and platform roots.
 */

import { resolve } from 'node:path';
import { DEFAULT_PROFILES_ROOT } from './harness-resolver.js';
import { applyRenderedFiles, renderHarnessFiles } from './harness-materializer.js';
import { compileHarnessSubject } from './harness-subject.js';

function materializeHarnessSubject(descriptorPath, { write = false, repoRoot, defaultProfile, profilesRoot, now } = {}) {
  const resolvedProfilesRoot = resolve(profilesRoot ?? DEFAULT_PROFILES_ROOT);
  const resolvedRepoRoot = resolve(repoRoot ?? resolve(resolvedProfilesRoot, '..', '..'));
  const compiled = compileHarnessSubject(descriptorPath, {
    repoRoot: resolvedRepoRoot,
    profilesRoot: resolvedProfilesRoot,
    defaultProfile,
    ...(now && { now })
  });
  const subject = compiled.descriptor?.subject ?? null;
  if (!compiled.harness || compiled.errors.length > 0) {
    return { subject, extends: compiled.effective?.extends ?? null, files: [], errors: compiled.errors };
  }
  const rendered = renderHarnessFiles(compiled, resolvedRepoRoot);
  const applied = applyRenderedFiles(rendered, { write });
  return { subject, extends: compiled.effective.extends, files: applied.files, errors: applied.errors };
}

export { materializeHarnessSubject };
