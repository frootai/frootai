"""Required-field tests. Each removes one required field from a known-good
fixture and asserts the validator complains with keyword='required'.

Required fields (17, per fai-accelerator.schema.json v1.0.0):
  schema_version, id, name, slug, variety, owner, repo_url, tagline,
  categories, tech, ripeness, season, last_commit, license,
  fai_compatible, origin, provenance
"""
from __future__ import annotations

import pytest

from frootai_orchard import validate


def _assert_missing(result, field: str) -> None:
    assert not result.ok, f"expected failure when {field!r} is missing"
    msgs = [e.message for e in result.errors if e.keyword == "required"]
    assert any(field in m for m in msgs), (
        f"expected a 'required' error mentioning {field!r}; got: "
        + " | ".join(f"{e.keyword}:{e.message}" for e in result.errors)
    )


@pytest.mark.parametrize(
    "field",
    [
        "schema_version",
        "id",
        "name",
        "slug",
        "variety",
        "owner",
        "repo_url",
        "tagline",
        "categories",
        "tech",
        "ripeness",
        "season",
        "last_commit",
        "license",
        "fai_compatible",
        "origin",
        "provenance",
    ],
)
def test_top_level_required_field_missing_fails(accelerator_schema, harvested_example, field):
    """Removing any of the 17 top-level required fields must fail validation."""
    del harvested_example[field]
    result = validate(accelerator_schema, harvested_example)
    _assert_missing(result, field)


def test_nested_provenance_required_fields(accelerator_schema, harvested_example):
    """provenance.harvested_at / harvested_by / source are all required."""
    for field in ("harvested_at", "harvested_by", "source"):
        bad = {**harvested_example, "provenance": {k: v for k, v in harvested_example["provenance"].items() if k != field}}
        result = validate(accelerator_schema, bad)
        _assert_missing(result, field)
