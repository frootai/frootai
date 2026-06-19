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


def _format_tools_section(tools: Sequence[Mapping[str, str]]) -> str:
    if not tools:
        return ""
    lines = ["", "Available tools (merged across in-process + federated):"]
    for tool in tools:
        name = tool.get("name", "(unnamed)")
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

    Returns:
        The fully-assembled system prompt string.
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

    tools_section = _format_tools_section(tools)
    if tools_section:
        sections.append(tools_section)

    return "\n".join(sections) + "\n"
