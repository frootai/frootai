import type { Result } from './errors.js';
/**
 * Validate `payload` against `schema`.
 *
 * @param schema A parsed JSON Schema object OR a filesystem path to a `.json` file.
 * @param payload Any JSON-compatible value.
 * @returns A `Result` with `ok` (boolean) and `errors` (readonly array).
 *
 * Throws if the schema cannot be compiled (catches malformed schemas early).
 */
export declare function validate(schema: object | string, payload: unknown): Result;
//# sourceMappingURL=validator.d.ts.map