/**
 * Enum-boundary tests — mirror of test_enums.py.
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, harvestedExample } from './_fixtures.js';
function hasEnumErrorAt(errors, pathSuffix) {
    return errors.some((e) => e.keyword === 'enum' && e.path.includes(pathSuffix));
}
describe('enums', () => {
    it('variety outside {azure,gcp,aws,oss,hybrid} fails', () => {
        const ex = harvestedExample();
        ex.variety = 'atari';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasEnumErrorAt(result.errors, '/variety')).toBe(true);
    });
    it('ripeness outside {Seedling,Sapling,Bearing,Mature} fails', () => {
        const ex = harvestedExample();
        ex.ripeness = 'Compost';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasEnumErrorAt(result.errors, '/ripeness')).toBe(true);
    });
    it('categories[] item outside the 19-value vocab fails', () => {
        const ex = harvestedExample();
        ex.categories = ['frooting'];
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasEnumErrorAt(result.errors, '/categories')).toBe(true);
    });
    it('origin outside {harvested,cultivated,first_party} fails', () => {
        const ex = harvestedExample();
        ex.origin = 'abandoned';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasEnumErrorAt(result.errors, '/origin')).toBe(true);
    });
    it('trust_badges[] outside the 10-value vocab fails', () => {
        const ex = harvestedExample();
        ex.trust_badges = ['unknown_badge'];
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasEnumErrorAt(result.errors, '/trust_badges')).toBe(true);
    });
});
//# sourceMappingURL=test_enums.test.js.map