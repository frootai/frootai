# Python Validator Tests

**Status**: ✅ Phase `[A0.5]` shipped 2026-05-24. **43 tests · 100% pass · ~5s wall time.**

## Test breakdown (actual after parametrization)

| File | Tests | What's tested |
|---|---:|---|
| `test_required_fields.py` | **18** | 17 top-level required fields + 3 nested `provenance.*` fields (parametrized) |
| `test_round_trip.py` | **7** | 5 fixtures from `fai-accelerator.example.json` + 2 matrix invariants (3 origins covered, 3 varieties covered) |
| `test_enums.py` | **5** | `variety` · `ripeness` · `categories` · `origin` · `trust_badges` boundary tests |
| `test_types.py` | **5** | `id` string · `categories` array · `ripeness_signals.stars` int · `fai_compatible` string · `composed_from` array |
| `test_conditional.py` | **5** | All 5 `allOf` / `if`-`then` rules (Greenhouse + doctrine line 9) |
| `test_formats.py` | **3** | `id` regex · `repo_url` GitHub pattern · `integrity_sha256` 64-hex |
| **Total** | **43** | |

## Convention

```python
def test_<group>_<scenario>(accelerator_schema, harvested_example):
    harvested_example["variety"] = "atari"
    result = validate(accelerator_schema, harvested_example)
    assert not result.ok
    assert any(e.keyword == "enum" and "/variety" in e.path for e in result.errors)
```

Fixtures (`accelerator_schema`, `manifest_schema`, `all_examples`, `harvested_example`, `cultivated_example`, `first_party_example`) are session-scoped where possible and deep-copied where the test needs to mutate.

## Run

```bash
cd frootai/orchard/validators/python
pytest tests/ -v
```
