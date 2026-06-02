"""Format & pattern tests. Cover the 8 regex patterns + the uri / date-time
format checkers.
"""
from __future__ import annotations

from frootai_orchard import validate


def _has_keyword_at(result, keyword: str, path_suffix: str) -> bool:
    return any(e.keyword == keyword and path_suffix in e.path for e in result.errors)


def test_id_pattern_violation_fails(accelerator_schema, harvested_example):
    """id regex: ^[a-z0-9][a-z0-9._-]*__[a-z0-9][a-z0-9._-]*$ — uppercase, spaces, single underscore all reject."""
    harvested_example["id"] = "Has Spaces"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert _has_keyword_at(result, "pattern", "/id")


def test_repo_url_must_be_github(accelerator_schema, harvested_example):
    """repo_url regex pins to https://github.com/<owner>/<repo>."""
    harvested_example["repo_url"] = "https://gitlab.com/owner/repo"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    # Could fail pattern or format (uri passes since gitlab IS a valid uri)
    assert _has_keyword_at(result, "pattern", "/repo_url")


def test_integrity_sha256_wrong_length_fails(accelerator_schema, cultivated_example):
    """composed_from[].integrity_sha256 must be exactly 64 hex chars."""
    cultivated_example["composed_from"][0]["integrity_sha256"] = "deadbeef"
    result = validate(accelerator_schema, cultivated_example)
    assert not result.ok
    assert any(e.keyword == "pattern" and "/composed_from/0/integrity_sha256" in e.path for e in result.errors)
