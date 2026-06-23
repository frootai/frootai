# [M8.2] CANONICAL: frootai-core/foundry-agent/agent.py
#        MIRROR:    frootai/foundry-agent/agent.py
# This file is kept byte-identical at both locations via
# scripts/foundry/sync-agent-copy.mjs (M8.3). Edit the canonical copy
# under frootai-core/ ONLY; CI fails the byte-identity assertion if the
# two diverge. The mirror under frootai/ is a build artifact.

"""FrootAI Enterprise RAG Agent — Azure AI Foundry Hosted Agent.

This agent uses Azure AI Agent Service (prompt agent) to answer
enterprise AI architecture questions using the FrootAI knowledge base.
"""

import asyncio
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from federation_client import FoundryFederationClient, federation_is_disabled
from prompt_builder import build_system_prompt

ENDPOINT = os.environ.get(
    "AZURE_AI_PROJECT_ENDPOINT",
    "https://frootai-rag-agent.swedencentral.api.azureml.ms",
)


def lean_mode_enabled() -> bool:
    """[Z8.7] True when Lean Mode is requested via FROOTAI_LEAN=true.

    Matches the env var the [Z8.6] GitHub Action exports, so a workflow
    that passes `lean: true` flows straight through to the agent's system
    prompt. Any value other than the exact string "true" is treated as
    off (parity with the action's true|false enum).
    """
    return os.environ.get("FROOTAI_LEAN", "").strip().lower() == "true"



# [M8.6] Hard-coded fallback prompt — used when no active Play AND
# federation is disabled OR no areas attached. This is the SAME string
# that build_system_prompt() returns when called with empty arguments
# (M8.5 fallback contract), preserved here for the explicit-fallback
# path in build_session_prompt() below.
LEGACY_SYSTEM_PROMPT = build_system_prompt()


def build_session_prompt() -> str:
    """[M8.6] Build the per-session system prompt.

    When FROOTAI_ACTIVE_PLAY is set, the federation client attaches the
    play's MCP areas and the dynamic prompt is built with live areas +
    tools. Otherwise the legacy fallback prompt is used (preserving v5
    behavior for sessions without federation).

    Returns the prompt string. Errors during federation attach are
    swallowed by FoundryFederationClient and the prompt degrades to
    the fallback shape.
    """
    if federation_is_disabled():
        return LEGACY_SYSTEM_PROMPT if not lean_mode_enabled() else build_system_prompt(lean=True)

    fc = FoundryFederationClient()
    if not fc.resolve_areas_to_attach():
        return LEGACY_SYSTEM_PROMPT if not lean_mode_enabled() else build_system_prompt(lean=True)

    async def _build() -> str:
        # [M8.8] Pre-attach at session start via the explicit
        # start_session() entry point — does the per-area attach,
        # logs failures, and returns (attached, tools).
        attached, tools = await fc.start_session()
        # plays list stays empty in this ship — a later M8 step wires
        # play discovery (FROOTAI_ACTIVE_PLAY → SDK lookup → plays list).
        # [M8.16] Pass failed_areas so the prompt injects
        # "tool area X unavailable" notes for partial attach failures.
        # [Z8.7] Pass lean so FROOTAI_LEAN=true injects the Lean Mode directive.
        return build_system_prompt(
            plays=(),
            attached_areas=attached,
            tools=tools,
            failed_areas=fc.failed_areas,
            lean=lean_mode_enabled(),
        )

    try:
        return asyncio.run(_build())
    except Exception as exc:  # noqa: BLE001 — agent must keep running
        print(f"[agent] federation init failed; using fallback prompt: {exc}")
        return LEGACY_SYSTEM_PROMPT


def create_agent():
    """Create a prompt agent on Azure AI Foundry."""
    client = AIProjectClient(
        endpoint=ENDPOINT,
        credential=DefaultAzureCredential(),
    )

    oai = client.get_openai_client()
    agent = oai.beta.assistants.create(
        model="gpt-4o-mini",
        name="frootai-enterprise-rag",
        instructions=build_session_prompt(),
        temperature=0.2,
        top_p=0.95,
    )

    print(f"Agent created: {agent.id}")
    print(f"Name: {agent.name}")
    print(f"Model: {agent.model}")
    return agent


def chat_with_agent(agent_id: str, message: str):
    """Send a message to the agent and get a response."""
    client = AIProjectClient(
        endpoint=ENDPOINT,
        credential=DefaultAzureCredential(),
    )

    oai = client.get_openai_client()
    thread = oai.beta.threads.create()
    oai.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=message,
    )

    run = oai.beta.threads.runs.create_and_poll(
        thread_id=thread.id,
        assistant_id=agent_id,
    )

    if run.status == "failed":
        print(f"Run failed: {run.last_error}")
        return None

    messages = oai.beta.threads.messages.list(thread_id=thread.id)
    for msg in messages.data:
        if msg.role == "assistant":
            for block in msg.content:
                if block.type == "text":
                    return block.text.value
    return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "create":
        agent = create_agent()
    elif len(sys.argv) > 2 and sys.argv[1] == "chat":
        agent_id = sys.argv[2]
        query = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else "What is RAG architecture?"
        response = chat_with_agent(agent_id, query)
        print(f"\nAgent Response:\n{response}")
    else:
        print("Usage:")
        print("  python agent.py create              # Create the agent")
        print("  python agent.py chat <agent_id> <query>  # Chat with agent")
