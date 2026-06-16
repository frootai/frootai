/**
 * Round-trip tests — mirror of test_round_trip.py.
 *
 * Every fixture in fai-accelerator.example.json must validate cleanly. This is
 * the contract between A0.2 (schema) and A0.3 (examples), now enforced from
 * both Python AND TypeScript.
 */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator.js';
import { ACCELERATOR_SCHEMA, ALL_EXAMPLES } from './_fixtures.js';
const EXAMPLE_LABELS = [
    '01-azure-search-openai-demo',
    '02-googlecloudplatform-generative-ai',
    '03-aws-samples-amazon-bedrock-samples',
    '04-frootai-ai-foundry-rag-production-cultivated',
    '05-frootai-solution-play-21-baseline-infra-first_party',
];
describe('round-trip: every example validates', () => {
    it.each(ALL_EXAMPLES.map((ex, i) => [EXAMPLE_LABELS[i] ?? `example-${i + 1}`, ex]))('example %s validates', (_label, example) => {
        const result = validate(ACCELERATOR_SCHEMA, example);
        if (!result.ok) {
            const details = result.errors
                .map((e) => `  ${e.path}  ${e.keyword}  ${e.message}`)
                .join('\n');
            throw new Error(`example ${example.id} failed validation:\n${details}`);
        }
        expect(result.ok).toBe(true);
    });
});
describe('round-trip: matrix invariants', () => {
    it('examples cover all 3 origins (harvested + cultivated + first_party)', () => {
        const origins = new Set(ALL_EXAMPLES.map((ex) => ex.origin));
        expect(origins).toEqual(new Set(['harvested', 'cultivated', 'first_party']));
    });
    it('examples cover at least 3 cloud varieties (azure + gcp + aws)', () => {
        const varieties = new Set(ALL_EXAMPLES.map((ex) => ex.variety));
        expect(varieties.has('azure')).toBe(true);
        expect(varieties.has('gcp')).toBe(true);
        expect(varieties.has('aws')).toBe(true);
    });
});
//# sourceMappingURL=test_round_trip.test.js.map