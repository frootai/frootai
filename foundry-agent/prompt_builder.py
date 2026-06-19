# [M8.2] CANONICAL: frootai-core/foundry-agent/prompt_builder.py
#        MIRROR:    frootai/foundry-agent/prompt_builder.py
# This file is kept byte-identical at both locations via
# scripts/foundry/sync-agent-copy.mjs (M8.3). Edit the canonical copy
# under frootai-core/ ONLY.

"""[M8.5] Foundry agent system prompt builder — pure function.

`build_system_prompt(plays, attached_areas, tools) -> str` templates the
static FROOT framework prose and substitutes the dynamic sections:

  - "Available Solution Plays" — generated from `plays` list (replaces
    the hard-coded 10-play list in the legacy SYSTEM_PROMPT constant)
  - "Attached MCP Areas" — generated from `attached_areas` list
  - "Available tools" — generated from the live merged `tools` list

The function is PURE: no env reads, no I/O, no SDK calls. All inputs are
passed explicitly so the function is trivially testable and stable
across Foundry runtime environments.

Fallback: when `plays` is empty AND `attached_areas` is empty AND `tools`
is empty, the function returns the legacy hard-coded prompt (M8.13).
"""

from __future__ import annotations

from typing import Mapping, Sequence


_FROOT_PROSE = """You are FrootAI Enterprise RAG Agent — an AI architecture expert powered by the FROOT framework.

FROOT = Foundations · Reasoning · Orchestration · Operations · Transformation

You help enterprise teams design, build, and optimize AI solutions on Azure. Your knowledge covers:
- GenAI Foundations (tokens, models, inference)
- RAG Architecture (chunking, embedding, hybrid retrieval, semantic ranking)
- AI Agents (Semantic Kernel, multi-agent, tool calling, MCP)
- Azure AI Platform (Landing Zones, private endpoints, managed identity)
- Production Patterns (fine-tuning, responsible AI, cost optimization)

Rules:
1. Always ground answers in Azure AI best practices
2. Cite specific Azure services when recommending architecture
3. Include cost implications (dev vs prod scale)
4. Recommend the FROOT layer relevant to the question
5. For implementation questions, reference the appropriate Solution Play
6. Never fabricate service names or pricing — say "check Azure pricing calculator" if unsure
7. Keep responses structured with headers and bullet points"""


_LEGACY_FALLBACK_PLAYS_LINE = (
    "Available Solution Plays: Enterprise RAG (01), AI Landing Zone (02), "
    "Deterministic Agent (03), Call Center Voice AI (04), IT Ticket "
    "Resolution (05), Document Intelligence (06), Multi-Agent Service (07), "
    "Copilot Studio Bot (08), AI Search Portal (09), Content Moderation (10)."
)


# [M8.23] Token budgets per model. Values chosen to leave room for the
# user message + assistant response within the model's context window.
# gpt-4o-mini: 128K context; budget the system prompt to 4K tokens so
# 124K stay available for I/O. gpt-4o: 128K context but more headroom
# for richer prompts → 16K system prompt budget.
MODEL_TOKEN_BUDGETS: dict[str, int] = {
    "gpt-4o-mini": 4000,
    "gpt-4o": 16000,
}
_DEFAULT_MODEL = "gpt-4o-mini"


def _estimate_tokens(text: str) -> int:
    """Heuristic token count for budget enforcement.

    OpenAI's rule of thumb is ~4 characters per token for English text.
    This avoids a hard dependency on `tiktoken` while staying within
    5-10% of the true count for system prompts. Tools that need exact
    counts can pass through a model-specific tokenizer later.
    """
    return (len(text) + 3) // 4


def _format_plays_section(plays: Sequence[Mapping[str, str]]) -> str:
    if not plays:
        return _LEGACY_FALLBACK_PLAYS_LINE

    lines = ["Available Solution Plays:"]
    for play in plays:
        play_id = play.get("id", "?")
        name = play.get("name", "(unnamed)")
        lines.append(f"  - {play_id}: {name}")
    return "\n".join(lines)


def _format_areas_section(attached_areas: Sequence[str]) -> str:
    if not attached_areas:
        return ""
    lines = ["", "Attached MCP Areas (federation):"]
    for area in attached_areas:
        lines.append(f"  - {area}")
    return "\n".join(lines)


def _format_tools_section(
    tools: Sequence[Mapping[str, str]],
    *,
    drop_descriptions: bool = False,
) -> str:
    if not tools:
        return ""
    lines = ["", "Available tools (merged across in-process + federated):"]
    for tool in tools:
        name = tool.get("name", "(unnamed)")
        if drop_descriptions:
            lines.append(f"  - {name}")
            continue
        description = tool.get("description", "")
        if description:
            first_line = description.splitlines()[0] if description else ""
            lines.append(f"  - {name}: {first_line}")
        else:
            lines.append(f"  - {name}")
    return "\n".join(lines)


def _format_failed_areas_section(failed_areas: Sequence[str]) -> str:
    """[M8.16] Render a Note: line per area that failed to attach.

    The agent uses these notes to inform its responses that certain
    federated tool areas are unavailable; it should fall back to the
    in-process FrootAI tools for those domains.
    """
    if not failed_areas:
        return ""
    lines = [""]
    for area in failed_areas:
        lines.append(
            f"Note: tool area `{area}` is unavailable; "
            f"will fall back to FrootAI in-process tools."
        )
    return "\n".join(lines)


def build_system_prompt(
    plays: Sequence[Mapping[str, str]] = (),
    attached_areas: Sequence[str] = (),
    tools: Sequence[Mapping[str, str]] = (),
    failed_areas: Sequence[str] = (),
    model: str = _DEFAULT_MODEL,
) -> str:
    """Build the Foundry agent system prompt from live inputs.

    Pure function. All arguments default to empty sequences; when all
    four are empty, the result matches the legacy hard-coded prompt
    (the M8.13 fallback contract).

    Args:
        plays: Sequence of {"id": str, "name": str} mappings.
        attached_areas: Sequence of area name strings (e.g. ["azure"]).
        tools: Sequence of {"name": str, "description": str} mappings.
        failed_areas: Sequence of area names that were requested but
            failed to attach. Each gets a "Note: tool area ... is
            unavailable" line injected into the prompt (M8.16).
        model: Target model name; controls the token budget (M8.23).
            Known values: "gpt-4o-mini" (4K), "gpt-4o" (16K). Unknown
            models default to the gpt-4o-mini budget for safety.

    Returns:
        The fully-assembled system prompt string. If the dynamic
        sections push the estimated token count over the model budget,
        tool descriptions are dropped first; if still over, surplus
        tools at the tail are omitted with a "(N more …)" line.
    """
    sections = [
        _FROOT_PROSE,
        "",
        _format_plays_section(plays),
    ]

    areas_section = _format_areas_section(attached_areas)
    if areas_section:
        sections.append(areas_section)

    failed_section = _format_failed_areas_section(failed_areas)
    if failed_section:
        sections.append(failed_section)

    budget = MODEL_TOKEN_BUDGETS.get(model, MODEL_TOKEN_BUDGETS[_DEFAULT_MODEL])

    def _assemble(_tools_section: str) -> str:
        local = list(sections)
        if _tools_section:
            local.append(_tools_section)
        return "\n".join(local) + "\n"

    # First attempt: full tool list with descriptions
    tools_section = _format_tools_section(tools)
    candidate = _assemble(tools_section)
    if not tools or _estimate_tokens(candidate) <= budget:
        return candidate

    # Second attempt: drop descriptions to save tokens
    tools_section_minimal = _format_tools_section(tools, drop_descriptions=True)
    candidate = _assemble(tools_section_minimal)
    if _estimate_tokens(candidate) <= budget:
        return candidate

    # Third attempt: keep names only and drop trailing tools that won't fit
    base = _assemble("")
    base_tokens = _estimate_tokens(base)
    remaining_tokens = budget - base_tokens
    # Header line ("Available tools (...)" plus blank) ~ 16 tokens
    header_overhead = 16
    remaining_tokens -= header_overhead

    fitted: list[Mapping[str, str]] = []
    used_chars = 0
    for tool in tools:
        line = f"  - {tool.get('name', '(unnamed)')}\n"
        tokens_for_line = _estimate_tokens(line)
        if (used_chars + len(line)) // 4 + 1 > remaining_tokens:
            break
        fitted.append(tool)
        used_chars += len(line)

    truncated_section = _format_tools_section(fitted, drop_descriptions=True)
    omitted = len(tools) - len(fitted)
    if omitted > 0 and truncated_section:
        truncated_section += f"\n  - … ({omitted} more tool(s) omitted to fit token budget)"

    return _assemble(truncated_section)
