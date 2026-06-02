"""Normalized error format. The TypeScript validator (Phase A0.6) MUST produce
the same shape — cross-validator contract test in Phase A6.27 will compare
outputs key-for-key.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class ValidationError:
    """A single validation failure.

    Attributes:
        path: JSON Pointer to the failing instance node. "<root>" when the
              error is at the document root.
        keyword: The JSON Schema keyword that failed (e.g. "required", "enum",
                 "pattern", "type", "if", "format").
        message: Human-readable explanation, taken from the underlying
                 validator.
        severity: Always "error" in v0.1; reserved for future "warning" tier.
        params: Extra structured context (validator_value, schema_path). Useful
                for tooling that wants to render rich diagnostics. Always
                JSON-serializable.
    """

    path: str
    keyword: str
    message: str
    severity: str = "error"
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Result:
    """The outcome of one validate() call.

    `ok == True` and `errors == ()` are the contract for a passing document.
    `ok == False` implies `len(errors) >= 1`.
    """

    ok: bool
    errors: tuple[ValidationError, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "errors": [e.to_dict() for e in self.errors]}

    def __bool__(self) -> bool:
        return self.ok
