/**
 * Format & pattern tests — mirror of test_formats.py.
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, cultivatedExample, harvestedExample } from './_fixtures.js';
describe('formats and patterns', () => {
    it('id with spaces fails (regex ^[a-z0-9][a-z0-9._-]*__[a-z0-9][a-z0-9._-]*$)', () => {
        const ex = harvestedExample();
        ex.id = 'Has Spaces';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'pattern' && e.path.includes('/id'))).toBe(true);
    });
    it('repo_url not on github.com fails (pattern locked)', () => {
        const ex = harvestedExample();
        ex.repo_url = 'https://gitlab.com/owner/repo';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'pattern' && e.path.includes('/repo_url'))).toBe(true);
    });
    it('integrity_sha256 wrong length fails (must be 64 hex chars)', () => {
        const ex = cultivatedExample();
        const composed = ex.composed_from[0];
        composed.integrity_sha256 = 'deadbeef';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'pattern' && e.path.includes('/composed_from/0/integrity_sha256'))).toBe(true);
    });
});
//# sourceMappingURL=test_formats.test.js.map