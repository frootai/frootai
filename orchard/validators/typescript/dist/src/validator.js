/**
 * The validate() function — auto-selects JSON Schema draft based on the
 * schema's `$schema` field and runs Ajv, mapping each failure into our
 * normalized ValidationError shape.
 */
import { readFileSync } from 'node:fs';
import AjvDefault from 'ajv';
import Ajv2020Default from 'ajv/dist/2020.js';
import addFormatsDefault from 'ajv-formats';
// ESM-default interop — these packages still publish a `default` export under
// some moduleResolution settings. Coerce to the constructor either way.
const Ajv = (AjvDefault.default
    ?? AjvDefault);
const Ajv2020 = (Ajv2020Default.default
    ?? Ajv2020Default);
const addFormats = (addFormatsDefault.default
    ?? addFormatsDefault);
const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const DRAFT_07_HASH = 'http://json-schema.org/draft-07/schema#';
const DRAFT_07_NO_HASH = 'http://json-schema.org/draft-07/schema';
function selectAjv(schema) {
    const declared = typeof schema['$schema'] === 'string' ? schema['$schema'] : '';
    if (declared === DRAFT_2020) {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        addFormats(ajv);
        return ajv;
    }
    if (declared === DRAFT_07_HASH || declared === DRAFT_07_NO_HASH || declared === '') {
        const ajv = new Ajv({ strict: false, allErrors: true });
        addFormats(ajv);
        return ajv;
    }
    // Unknown draft — fall back to default (draft-07 compatible)
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    return ajv;
}
function formatPath(instancePath) {
    return instancePath && instancePath.length > 0 ? instancePath : '<root>';
}
function loadSchema(schema) {
    if (typeof schema === 'string') {
        return JSON.parse(readFileSync(schema, 'utf-8'));
    }
    return schema;
}
/**
 * Validate `payload` against `schema`.
 *
 * @param schema A parsed JSON Schema object OR a filesystem path to a `.json` file.
 * @param payload Any JSON-compatible value.
 * @returns A `Result` with `ok` (boolean) and `errors` (readonly array).
 *
 * Throws if the schema cannot be compiled (catches malformed schemas early).
 */
export function validate(schema, payload) {
    const parsed = loadSchema(schema);
    const ajv = selectAjv(parsed);
    const fn = ajv.compile(parsed);
    const ok = fn(payload);
    if (ok) {
        return { ok: true, errors: [] };
    }
    const errors = (fn.errors ?? []).map((err) => ({
        path: formatPath(err.instancePath),
        keyword: err.keyword,
        message: err.message ?? '',
        severity: 'error',
        params: {
            ajv_params: err.params,
            schema_path: err.schemaPath ?? '',
        },
    }));
    return { ok: false, errors };
}
//# sourceMappingURL=validator.js.map