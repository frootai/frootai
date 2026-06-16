"""Enum-boundary tests. Each sets a sealed-enum field to a value outside
the allowed set and asserts keyword='enum'.
"""
from __future__ import annotations

from frootai_orchard import validate


def _has_enum_error(result, path_suffix: str) -> bool:
    return any(e.keyword == "enum" and path_suffix in e.path for e in result.errors)


def test_variety_outside_enum_fails(accelerator_schema, harvested_example):
    """variety enum: azure | gcp | aws | oss | hybrid."""
    harvested_example["variety"] = "atari"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_enum_error(result, "/variety")


def test_ripeness_outside_enum_fails(accelerator_schema, harvested_example):
    """ripeness enum: Seedling | Sapling | Bearing | Mature."""
    harvested_example["ripeness"] = "Compost"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_enum_error(result, "/ripeness")


def test_category_outside_vocab_fails(accelerator_schema, harvested_example):
    """categories[] items must come from the controlled 19-value vocabulary."""
    harvested_example["categories"] = ["frooting"]
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_enum_error(result, "/categories")


def test_origin_outside_enum_fails(accelerator_schema, harvested_example):
    """origin enum: harvested | cultivated | first_party."""
    harvested_example["origin"] = "abandoned"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_enum_error(result, "/origin")


def test_trust_badge_outside_vocab_fails(accelerator_schema, harvested_example):
    """trust_badges[] items must come from the 10-value controlled vocab."""
    harvested_example["trust_badges"] = ["unknown_badge"]
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_enum_error(result, "/trust_badges")
