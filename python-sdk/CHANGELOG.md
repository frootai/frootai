# Changelog

## [5.1.0] — 2026-04-14

### Added
- **BM25 search engine** — 358 documents × 8,627 terms with Robertson IDF (k1=1.5, b=0.75)
- **FAI Protocol methods** — `wire_play()`, `validate_manifest()`, `inspect_wiring()`
- **Scaffold methods** — `scaffold_play()`, `list_templates()`, dry-run preview
- **WAF guidance** — `get_waf_guidance()` for 6 pillars, `check_play_compatibility()`
- **Learning paths** — `get_learning_path()` with 5 curated topics (rag, agents, security, mlops, cost)
- **CLI commands** — 8 new: scaffold, wire, validate, evaluate, waf, primitives, learning-path
- **JSON serialization** — `to_dict()` / `to_json()` on SolutionPlay, EvalResult
- **SolutionPlay.search()** — keyword search across play names, descriptions, infra
- **py.typed marker** — enables downstream type checking
- **pytest suite** — 44 tests across 9 test classes
- **search-index.json** — bundled BM25 index for offline search

### Changed
- Search upgraded from substring matching to BM25 with keyword fallback
- CLI expanded from 5 → 13 commands
- Version synced to 5.1.0 across `__init__.py` and `pyproject.toml`
- README overhauled with feature table, testing section, new CLI commands
- `__init__.py` docstring updated with new API examples

### Removed
- Stale `dist/` (v3.3.0 builds)
- Stale `frootai.egg-info/`
- `reality_check.py` (superseded by pytest suite)

### Fixed
- Version mismatch: `__init__.py` (3.3.0) vs `pyproject.toml` (5.0.1) → both 5.1.0
- Test assertions: `len(plays)==20` → `101` (was testing stale data)
- Docstrings: "25 MCP tools" → "45 MCP tools"

## [3.3.0] — 2026-03-24
- Initial SDK with knowledge search, solution plays, evaluation, A/B testing, agentic loop
