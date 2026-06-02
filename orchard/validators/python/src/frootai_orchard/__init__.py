"""FAI Orchard — reference Python validator.

Validates documents against:
  - fai-accelerator.schema.json  (JSON Schema 2020-12 — Accelerators)
  - fai-manifest.schema.json     (JSON Schema draft-07  — Solution Plays)

Public API:
    from frootai_orchard import validate, Result, ValidationError

    result = validate(schema_or_path, payload)
    if result.ok:
        ...
    else:
        for err in result.errors:
            print(err.path, err.keyword, err.message)

License: Apache-2.0
"""
from .errors import Result, ValidationError
from .validator import validate

__all__ = ["validate", "Result", "ValidationError"]
__version__ = "0.1.0"
