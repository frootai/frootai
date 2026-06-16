/**
 * Required-field tests — mirror of test_required_fields.py.
 *
 * Removes one required field from a known-good fixture and asserts the
 * validator complains with keyword='required'.
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, harvestedExample } from './_fixtures.js';
const REQUIRED_FIELDS = [
    'schema_version',
    'id',
    'name',
    'slug',
    'variety',
    'owner',
    'repo_url',
    'tagline',
    'categories',
    'tech',
    'ripeness',
    'season',
    'last_commit',
    'license',
    'fai_compatible',
    'origin',
    'provenance',
];
describe('top-level required fields', () => {
    it.each(REQUIRED_FIELDS)('rejects payload missing %s', (field) => {
        const ex = harvestedExample();
        delete ex[field];
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        const requiredErrors = result.errors.filter((e) => e.keyword === 'required');
        expect(requiredErrors.some((e) => e.message.includes(field)), `expected a 'required' error mentioning ${field}`).toBe(true);
    });
});
describe('nested provenance required fields', () => {
    it.each(['harvested_at', 'harvested_by', 'source'])('rejects provenance missing %s', (field) => {
        const ex = harvestedExample();
        const provenance = { ...ex.provenance };
        delete provenance[field];
        ex.provenance = provenance;
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        const requiredErrors = result.errors.filter((e) => e.keyword === 'required');
        expect(requiredErrors.some((e) => e.message.includes(field))).toBe(true);
    });
});
//# sourceMappingURL=test_required_fields.test.js.map