"""Conditional-rule tests. Exercise the 5 `allOf` / `if`-`then` blocks
that encode the Greenhouse / doctrine invariants.

Rules (from fai-accelerator.schema.json v1.0.0):
  1. origin=cultivated  => composed_from + composition_method + composed_at + composed_by_agent + gold_iac REQUIRED
  2. gold_iac=true      => gold_iac_reason REQUIRED (non-empty)
  3. cost_estimate present => structural shape held
  4. origin=cultivated  => provenance.source MUST equal 'frootai-greenhouse'
  5. origin=harvested   => provenance.source MUST equal 'github-api'
"""
from __future__ import annotations

from frootai_orchard import validate


def test_cultivated_without_composed_from_fails(accelerator_schema, cultivated_example):
    """Rule 1: removing composed_from from a cultivated fruit must fail."""
    del cultivated_example["composed_from"]
    result = validate(accelerator_schema, cultivated_example)
    assert not result.ok
    msgs = [e.message for e in result.errors]
    assert any("composed_from" in m for m in msgs), msgs


def test_cultivated_with_wrong_source_fails(accelerator_schema, cultivated_example):
    """Rule 4: a cultivated fruit cannot claim provenance.source=github-api."""
    cultivated_example["provenance"]["source"] = "github-api"
    result = validate(accelerator_schema, cultivated_example)
    assert not result.ok
    # The const constraint will surface as keyword='const'
    assert any(e.keyword == "const" and "/provenance/source" in e.path for e in result.errors)


def test_harvested_with_wrong_source_fails(accelerator_schema, harvested_example):
    """Rule 5: a harvested fruit cannot claim provenance.source=frootai-greenhouse."""
    harvested_example["provenance"]["source"] = "frootai-greenhouse"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert any(e.keyword == "const" and "/provenance/source" in e.path for e in result.errors)


def test_gold_iac_true_without_reason_fails(accelerator_schema, cultivated_example):
    """Rule 2: gold_iac=true requires non-empty gold_iac_reason (doctrine line 9 escape valve)."""
    cultivated_example["gold_iac"] = True
    cultivated_example["gold_iac_reason"] = None  # null fails the conditional minLength
    result = validate(accelerator_schema, cultivated_example)
    assert not result.ok
    # Conditional firing: gold_iac_reason becomes required and must be a string with minLength 1
    assert any(
        ("gold_iac_reason" in e.message) or ("/gold_iac_reason" in e.path)
        for e in result.errors
    )


def test_cultivated_with_all_fields_passes(accelerator_schema, cultivated_example):
    """Positive case: the known-good cultivated example #4 must still pass after deep-copy."""
    result = validate(accelerator_schema, cultivated_example)
    assert result.ok, f"cultivated example should pass; got errors: {[e.to_dict() for e in result.errors]}"
