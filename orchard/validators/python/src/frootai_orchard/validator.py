"""The validate() function — auto-selects JSON Schema draft and runs
jsonschema's iter_errors, mapping each failure into our normalized
ValidationError shape.
"""
from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, Draft202012Validator, FormatChecker
from jsonschema.validators import validator_for

from .errors import Result, ValidationError

# Map declared $schema URIs to validator classes.
_DRAFT_TO_VALIDATOR: dict[str, type] = {
    "https://json-schema.org/draft/2020-12/schema": Draft202012Validator,
    "http://json-schema.org/draft-07/schema#": Draft7Validator,
    "http://json-schema.org/draft-07/schema": Draft7Validator,
}


def _format_path(parts: Iterable[Any]) -> str:
    """Render a jsonschema absolute_path into a JSON Pointer-ish string."""
    parts = list(parts)
    if not parts:
        return "<root>"
    return "".join(f"/{p}" for p in parts)


def _select_validator_cls(schema: dict[str, Any]) -> type:
    declared = schema.get("$schema", "")
    if declared in _DRAFT_TO_VALIDATOR:
        return _DRAFT_TO_VALIDATOR[declared]
    # Fallback heuristic from jsonschema itself.
    return validator_for(schema)


def _coerce_param(value: Any) -> Any:
    """Make `validator_value` JSON-serializable. Drop callables / objects we
    can't safely round-trip; coerce sets/tuples to lists.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple, set)):
        return [_coerce_param(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _coerce_param(v) for k, v in value.items()}
    return repr(value)


def validate(schema: dict[str, Any] | str | Path, payload: Any) -> Result:
    """Validate `payload` against `schema`.

    Args:
        schema: A parsed JSON Schema dict OR a path (str / Path) to a .json file.
        payload: Any JSON-compatible value.

    Returns:
        Result(ok=bool, errors=tuple[ValidationError, ...]).

    Raises:
        FileNotFoundError: if `schema` is a path and doesn't exist.
        json.JSONDecodeError: if the schema file isn't valid JSON.
        jsonschema.SchemaError: if the schema itself is malformed.
    """
    if isinstance(schema, (str, Path)):
        with open(schema, "r", encoding="utf-8") as f:
            schema = json.load(f)

    validator_cls = _select_validator_cls(schema)
    # Meta-validate first — catches schema bugs early.
    validator_cls.check_schema(schema)

    validator = validator_cls(schema, format_checker=FormatChecker())
    raw_errors = list(validator.iter_errors(payload))

    if not raw_errors:
        return Result(ok=True, errors=())

    errors = tuple(
        ValidationError(
            path=_format_path(err.absolute_path),
            keyword=err.validator or "unknown",
            message=err.message,
            severity="error",
            params={
                "validator_value": _coerce_param(err.validator_value),
                "schema_path": _format_path(err.absolute_schema_path),
            },
        )
        for err in raw_errors
    )
    return Result(ok=False, errors=errors)
