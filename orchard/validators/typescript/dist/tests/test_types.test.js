/**
 * Type-mismatch tests — mirror of test_types.py.
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, cultivatedExample, harvestedExample } from './_fixtures.js';
function hasTypeErrorAt(errors, pathSuffix) {
    return errors.some((e) => e.keyword === 'type' && (e.path.endsWith(pathSuffix) || e.path === pathSuffix));
}
describe('types', () => {
    it('id must be string (integer rejected)', () => {
        const ex = harvestedExample();
        ex.id = 12345;
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'type' || e.keyword === 'pattern')).toBe(true);
    });
    it('categories must be array (string rejected)', () => {
        const ex = harvestedExample();
        ex.categories = 'rag';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasTypeErrorAt(result.errors, '/categories')).toBe(true);
    });
    it('ripeness_signals.stars must be integer (string rejected)', () => {
        const ex = harvestedExample();
        ex.ripeness_signals.stars = 'lots';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasTypeErrorAt(result.errors, '/ripeness_signals/stars')).toBe(true);
    });
    it('fai_compatible must be string (boolean rejected)', () => {
        const ex = harvestedExample();
        ex.fai_compatible = true;
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'type' || e.keyword === 'enum')).toBe(true);
    });
    it('composed_from must be array (object rejected)', () => {
        const ex = cultivatedExample();
        ex.composed_from = { module_path: 'avm/ptn/ai-ml/ai-foundry' };
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(hasTypeErrorAt(result.errors, '/composed_from')).toBe(true);
    });
});
//# sourceMappingURL=test_types.test.js.map