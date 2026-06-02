"""Type-mismatch tests. Each puts the wrong type into a field and asserts
the validator complains with keyword='type'.
"""
from __future__ import annotations

from frootai_orchard import validate


def _has_type_error(result, path_suffix: str) -> bool:
    return any(
        e.keyword == "type" and (e.path.endswith(path_suffix) or e.path == path_suffix)
        for e in result.errors
    )


def test_id_must_be_string(accelerator_schema, harvested_example):
    harvested_example["id"] = 12345
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    # Could fail on either 'type' or 'pattern' — pattern only applies to strings
    assert any(e.keyword in ("type", "pattern") for e in result.errors)


def test_categories_must_be_array(accelerator_schema, harvested_example):
    harvested_example["categories"] = "rag"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_type_error(result, "/categories")


def test_ripeness_signals_stars_must_be_integer(accelerator_schema, harvested_example):
    harvested_example["ripeness_signals"]["stars"] = "lots"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_type_error(result, "/ripeness_signals/stars")


def test_fai_compatible_must_be_string(accelerator_schema, harvested_example):
    harvested_example["fai_compatible"] = True
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    # Either 'type' or 'enum' will catch it; enum runs first if type passes
    assert any(e.keyword in ("type", "enum") for e in result.errors)


def test_composed_from_must_be_array(accelerator_schema, cultivated_example):
    cultivated_example["composed_from"] = {"module_path": "avm/ptn/ai-ml/ai-foundry"}
    result = validate(accelerator_schema, cultivated_example)
    assert not result.ok
    assert _has_type_error(result, "/composed_from")
