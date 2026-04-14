"""FrootAI SDK — Programmatic access to the FrootAI ecosystem.

From the Roots to the Fruits. It's simply Frootful.

Usage:
    from frootai import FrootAI, SolutionPlay, Evaluator

    client = FrootAI()
    results = client.search("RAG architecture")   # BM25 search
    module = client.get_module("R2")
    manifest = client.wire_play("01")              # FAI Protocol
    scaffold = client.scaffold_play("01")          # DevKit bootstrap
    waf = client.get_waf_guidance("security")      # WAF guidance

    plays = SolutionPlay.all()                     # 101 plays
    play = SolutionPlay.get("03")

    evaluator = Evaluator()
    evaluator.check_thresholds({"groundedness": 4.2, "relevance": 3.8})

    # Copilot SDK patterns (async)
    from frootai.copilot import CopilotSession
    async with CopilotSession(system_prompt="RAG expert") as session:
        response = await session.send("Explain hybrid search")

    # Agentic loop (async)
    from frootai.agentic_loop import AgenticLoop, Task, run_plan
"""

__version__ = "5.1.0"
__author__ = "Pavleen Bali"

from frootai.client import FrootAI
from frootai.plays import SolutionPlay
from frootai.evaluation import Evaluator

__all__ = [
    "FrootAI",
    "SolutionPlay",
    "Evaluator",
    "__version__",
    # Copilot SDK patterns (import separately for async usage)
    # from frootai.copilot import CopilotSession, CopilotError, RetryConfig
    # from frootai.agentic_loop import AgenticLoop, Task, run_plan
]
