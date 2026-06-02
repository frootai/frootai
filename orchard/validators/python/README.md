# Python Validator

**Status**: ✅ Phase `[A0.5]` shipped 2026-05-24. **43/43 tests pass** in 4.47s on Python 3.13.

## Layout (live)

```
python/
├── README.md                    (this file)
├── pyproject.toml               (Apache-2.0; deps: jsonschema[format]>=4.21, pytest>=8)
├── src/
│   └── frootai_orchard/
│       ├── __init__.py         (re-exports validate, Result, ValidationError)
│       ├── errors.py           (ValidationError + Result dataclasses)
│       └── validator.py        (validate() + draft auto-selection)
└── tests/
    ├── conftest.py             (shared fixtures: schemas + examples)
    ├── test_conditional.py     (5 tests — the 5 allOf/if-then rules)
    ├── test_enums.py           (5 tests — sealed-enum violations)
    ├── test_formats.py         (3 tests — regex + sha256 pattern)
    ├── test_required_fields.py (18 tests — 17 top-level + 3 nested provenance)
    ├── test_round_trip.py      (7 tests — 5 examples + 2 matrix invariants)
    └── test_types.py           (5 tests — wrong-type rejection)
```

## Install + run

```bash
cd frootai/orchard/validators/python
pip install -e .[dev]        # or: pip install jsonschema[format] pytest
pytest tests/ -v
```

Expected: `43 passed in ~5s`.

## Public API

```python
from frootai_orchard import validate, Result, ValidationError

# Path-based: validate against fai-accelerator.schema.json
result = validate("orchard/schema/fai-accelerator.schema.json", payload)

# Or pass a parsed schema dict
import json
schema = json.load(open("orchard/schema/fai-accelerator.schema.json"))
result = validate(schema, payload)

if result.ok:
    print("OK")
else:
    for err in result.errors:
        print(f"{err.path}  {err.keyword}  {err.message}")
```

## Draft auto-selection

The validator auto-selects the right JSON Schema draft based on the schema's `$schema` field:

| `$schema` value | Validator used |
|---|---|
| `https://json-schema.org/draft/2020-12/schema` | `Draft202012Validator` (Accelerator schema) |
| `http://json-schema.org/draft-07/schema#` | `Draft7Validator` (Manifest schema) |
| anything else | jsonschema's `validator_for()` heuristic |

Format checks (`uri`, `date-time`) are always enabled via `FormatChecker()`.

## Error format contract

Every error is a `ValidationError` with these fields (the TypeScript validator in `[A0.6]` MUST produce the same shape; cross-validator contract test in `[A6.27]`):

```python
@dataclass(frozen=True)
class ValidationError:
    path: str            # JSON Pointer, e.g. "/categories/0" or "<root>"
    keyword: str         # JSON Schema keyword that failed ("required", "enum", "const", ...)
    message: str         # Human-readable from jsonschema
    severity: str        # "error" (reserved: "warning")
    params: dict         # {validator_value, schema_path}
```

Calling `.to_dict()` on a `Result` returns a fully JSON-serializable summary.

## What this validator is used by

- **Phase `[A1.24]`** — `frootai-core/scripts/orchard/validate.js` shells out to this validator as the canonical reference (JS validator in `[A0.6]` will mirror identical fixture matrix)
- **Phase `[A2.27]`** — nightly pipeline smoke test
- **Phase `[A6.27]`** — cross-validator contract test (compares this output to TS validator's output)
