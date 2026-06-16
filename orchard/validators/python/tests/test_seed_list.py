"""Seed-list validation tests — Phase [A0.28].

Validates `frootai/orchard/registry/seed-list.json` against
`orchard-seed-list.schema.json` (also from this folder).

Plus matrix invariants that lock the Phase A0 curation discipline:
  - exactly 50 entries (the A0.7 target)
  - all variety=azure (GCP/AWS/OSS seeds land in [A9])
  - all first_party=true (community seeds discovered via [A0.26] queries instead)
  - no duplicate full_name entries
  - all full_names match <owner>/<repo> regex
  - all reasons ≤200 chars (concise + doctrine-aligned)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from frootai_orchard import validate

HERE = Path(__file__).parent
SCHEMA_DIR = HERE.parent.parent.parent / "schema"
REGISTRY_DIR = HERE.parent.parent.parent / "registry"

SEED_SCHEMA_PATH = SCHEMA_DIR / "orchard-seed-list.schema.json"
SEED_LIST_PATH = REGISTRY_DIR / "seed-list.json"


@pytest.fixture(scope="session")
def seed_schema() -> dict:
    with open(SEED_SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def seed_list() -> list[dict]:
    with open(SEED_LIST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_seed_list_validates_against_schema(seed_schema, seed_list):
    """The whole seed-list.json validates against orchard-seed-list.schema.json."""
    result = validate(seed_schema, seed_list)
    if not result.ok:
        details = "\n".join(
            f"  {e.path}  {e.keyword}  {e.message}" for e in result.errors
        )
        pytest.fail(f"seed-list validation failed:\n{details}")
    assert result.ok


def test_seed_list_has_50_entries(seed_list):
    """Phase [A0.7] curated exactly 50 seeds. Drift = audit signal."""
    assert len(seed_list) == 50, f"expected 50 seeds, got {len(seed_list)}"


def test_seed_list_all_azure_variety(seed_list):
    """All 50 entries are variety=azure for Phase A0; GCP/AWS/OSS land in [A9]."""
    varieties = {entry["variety"] for entry in seed_list}
    assert varieties == {"azure"}, f"expected only {{azure}}, got {varieties}"


def test_seed_list_all_first_party(seed_list):
    """All 50 entries are first_party (cloud-vendor orgs).

    Community seeds enter via the [A0.26] discovery queries, not the seed list.
    """
    non_first_party = [e["full_name"] for e in seed_list if not e["first_party"]]
    assert non_first_party == [], f"unexpected community seeds: {non_first_party}"


def test_seed_list_no_duplicate_full_names(seed_list):
    """No duplicate full_name entries (case-insensitive)."""
    full_names = [entry["full_name"].lower() for entry in seed_list]
    seen = set()
    duplicates = []
    for name in full_names:
        if name in seen:
            duplicates.append(name)
        seen.add(name)
    assert duplicates == [], f"duplicate full_names: {duplicates}"


def test_seed_list_full_names_match_regex(seed_list):
    """Every full_name matches the <owner>/<repo> regex (no slashes, no spaces)."""
    pattern = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")
    bad = [e["full_name"] for e in seed_list if not pattern.match(e["full_name"])]
    assert bad == [], f"full_names violating regex: {bad}"


def test_seed_list_reasons_under_200_chars(seed_list):
    """Reasons are concise — ≤200 chars matches A0.7 curation discipline.

    The schema allows up to 500; this stricter test enforces the conciseness
    convention. If you bump this limit, update CONTRIBUTING.md too.
    """
    long_reasons = [
        (e["full_name"], len(e["reason"]))
        for e in seed_list
        if len(e["reason"]) > 200
    ]
    assert long_reasons == [], f"reasons over 200 chars: {long_reasons}"
