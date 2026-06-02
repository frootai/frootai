"""Round-trip tests. Each of the 5 fixtures in fai-accelerator.example.json
must validate cleanly against fai-accelerator.schema.json v1.0.0. This is the
contract between A0.2 (schema) and A0.3 (examples) — same contract the JS
smoke test enforces.

If any of these fails, EITHER the schema is too tight OR the example is wrong.
"""
from __future__ import annotations

import pytest

from frootai_orchard import validate


@pytest.fixture(params=range(5), ids=[
    "01-azure-search-openai-demo",
    "02-googlecloudplatform-generative-ai",
    "03-aws-samples-amazon-bedrock-samples",
    "04-frootai-ai-foundry-rag-production-cultivated",
    "05-frootai-solution-play-21-baseline-infra-first_party",
])
def one_example(all_examples, request):
    return all_examples[request.param]


def test_example_validates(accelerator_schema, one_example):
    """Every example file must pass against the schema, no warnings, no errors."""
    result = validate(accelerator_schema, one_example)
    if not result.ok:
        details = "\n".join(
            f"  {e.path}  {e.keyword}  {e.message}" for e in result.errors
        )
        pytest.fail(f"example {one_example.get('id')!r} failed validation:\n{details}")


def test_examples_cover_all_three_origins(all_examples):
    """The 5 examples MUST exercise all 3 origin values (harvested / cultivated / first_party)."""
    origins = {ex["origin"] for ex in all_examples}
    assert origins == {"harvested", "cultivated", "first_party"}, (
        f"expected {{harvested, cultivated, first_party}} got {origins}"
    )


def test_examples_cover_three_varieties(all_examples):
    """The 5 examples MUST exercise at least 3 cloud varieties (azure / gcp / aws)."""
    varieties = {ex["variety"] for ex in all_examples}
    assert {"azure", "gcp", "aws"} <= varieties, (
        f"expected at least azure+gcp+aws, got {varieties}"
    )
