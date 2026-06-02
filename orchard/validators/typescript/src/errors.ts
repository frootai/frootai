/**
 * Normalized error format. The Python validator (Phase A0.5) produces the same
 * shape (modulo idiomatic differences in `params` content) — cross-validator
 * contract test in Phase A6.27 will compare path / keyword / message / severity
 * outputs field-for-field.
 */

export type ValidationSeverity = 'error' | 'warning';

/**
 * Extra structured context for one validation failure.
 *
 * `ajv_params` is the underlying Ajv `params` object verbatim — its shape
 * depends on the failing keyword (e.g. `{ missingProperty: 'id' }` for
 * `required`, `{ allowedValues: [...] }` for `enum`). Always JSON-serializable.
 *
 * `schema_path` is the JSON Pointer-ish path into the schema, useful for
 * tooling that wants to render rich diagnostics.
 */
export interface ValidationErrorParams {
  ajv_params: Record<string, unknown> | unknown;
  schema_path: string;
}

/**
 * A single validation failure. Cross-runtime contract:
 *   path     : JSON Pointer into the failing instance ("<root>" at top level).
 *   keyword  : JSON Schema keyword that failed.
 *   message  : Human-readable.
 *   severity : Always "error" in v0.1.
 *   params   : See ValidationErrorParams.
 */
export interface ValidationError {
  path: string;
  keyword: string;
  message: string;
  severity: ValidationSeverity;
  params: ValidationErrorParams;
}

/**
 * Outcome of one `validate()` call.
 *
 * Contract: `ok === true` implies `errors.length === 0`; `ok === false`
 * implies `errors.length >= 1`.
 */
export interface Result {
  ok: boolean;
  errors: readonly ValidationError[];
}
