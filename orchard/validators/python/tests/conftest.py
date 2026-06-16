"""Shared pytest fixtures + path constants.

Resolves the schema/ and example files from the canonical
frootai/orchard/schema/ folder — same source the JS smoke test uses.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from frootai_orchard import Result, validate  # noqa: F401 — re-exported for tests

HERE = Path(__file__).parent
SCHEMA_DIR = HERE.parent.parent.parent / "schema"
ACCELERATOR_SCHEMA = SCHEMA_DIR / "fai-accelerator.schema.json"
MANIFEST_SCHEMA = SCHEMA_DIR / "fai-manifest.schema.json"
EXAMPLES = SCHEMA_DIR / "fai-accelerator.example.json"


def _load(p: Path) -> Any:
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def accelerator_schema() -> dict[str, Any]:
    return _load(ACCELERATOR_SCHEMA)


@pytest.fixture(scope="session")
def manifest_schema() -> dict[str, Any]:
    return _load(MANIFEST_SCHEMA)


@pytest.fixture(scope="session")
def all_examples() -> list[dict[str, Any]]:
    return _load(EXAMPLES)


@pytest.fixture
def harvested_example(all_examples) -> dict[str, Any]:
    """Deep copy of example #1: clean harvested Azure fruit. Mutate freely."""
    return deepcopy(all_examples[0])


@pytest.fixture
def cultivated_example(all_examples) -> dict[str, Any]:
    """Deep copy of example #4: clean cultivated Azure fruit. Mutate freely."""
    return deepcopy(all_examples[3])


@pytest.fixture
def first_party_example(all_examples) -> dict[str, Any]:
    """Deep copy of example #5: clean first_party Azure fruit. Mutate freely."""
    return deepcopy(all_examples[4])
