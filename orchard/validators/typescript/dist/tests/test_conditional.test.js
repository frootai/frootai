/**
 * Conditional-rule tests — mirror of test_conditional.py.
 *
 * Rules (from fai-accelerator.schema.json v1.0.0):
 *   1. origin=cultivated  => composed_from + composition_method + composed_at + composed_by_agent + gold_iac REQUIRED
 *   2. gold_iac=true      => gold_iac_reason REQUIRED (non-empty)
 *   3. cost_estimate present => structural shape held
 *   4. origin=cultivated  => provenance.source MUST equal 'frootai-greenhouse'
 *   5. origin=harvested   => provenance.source MUST equal 'github-api'
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, cultivatedExample, harvestedExample } from './_fixtures.js';
describe('conditional rules', () => {
    it('rule 1: cultivated without composed_from fails', () => {
        const ex = cultivatedExample();
        delete ex.composed_from;
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.message.includes('composed_from'))).toBe(true);
    });
    it('rule 4: cultivated with provenance.source=github-api fails', () => {
        const ex = cultivatedExample();
        ex.provenance.source = 'github-api';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'const' && e.path.includes('/provenance/source'))).toBe(true);
    });
    it('rule 5: harvested with provenance.source=frootai-greenhouse fails', () => {
        const ex = harvestedExample();
        ex.provenance.source = 'frootai-greenhouse';
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.keyword === 'const' && e.path.includes('/provenance/source'))).toBe(true);
    });
    it('rule 2: gold_iac=true without gold_iac_reason fails (doctrine line 9 escape valve)', () => {
        const ex = cultivatedExample();
        ex.gold_iac = true;
        ex.gold_iac_reason = null;
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.message.includes('gold_iac_reason') ||
            e.path.includes('/gold_iac_reason'))).toBe(true);
    });
    it('positive: known-good cultivated example passes', () => {
        const ex = cultivatedExample();
        const result = validate(ACCELERATOR_SCHEMA, ex);
        expect(result.ok, `cultivated example should pass; got errors: ${JSON.stringify(result.errors, null, 2)}`).toBe(true);
    });
});
//# sourceMappingURL=test_conditional.test.js.map