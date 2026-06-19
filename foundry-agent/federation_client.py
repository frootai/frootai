# [M8.2] CANONICAL: frootai-core/foundry-agent/federation_client.py
#        MIRROR:    frootai/foundry-agent/federation_client.py
# This file is kept byte-identical at both locations via
# scripts/foundry/sync-agent-copy.mjs (M8.3). Edit the canonical copy
# under frootai-core/ ONLY.

"""[M8.4] Foundry runtime federation client — thin wrapper.

Wraps `frootai.federation.FederationClient` for use from the Foundry
agent runtime. Reads `FROOTAI_PREATTACH` / `FROOTAI_TRUST_FILE` /
`FROOTAI_ACTIVE_PLAY` env vars and exposes a small synchronous-feeling
API (each method is `async`, but the agent runs them via asyncio).

Why a wrapper instead of using FederationClient directly:
- Foundry agent runtime starts in a hosted environment where the
  env var contract is the only configuration channel (no SDK opts).
- This module owns the env var → constructor option mapping, so the
  agent module stays focused on the Foundry session loop.
- Provides graceful fallbacks (warn-and-skip) when federation isn't
  configured, instead of raising — Foundry sessions must keep running
  even when MCP areas are unavailable.

Usage from agent.py:

    from federation_client import FoundryFederationClient

    fc = FoundryFederationClient()
    attached = await fc.attach_all_from_env()
    tools = await fc.list_all_tools(attached)
    # ... build_system_prompt(plays, attached, tools)
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping, Sequence


_PREATTACH_ENV_KEY = "FROOTAI_PREATTACH"
_TRUST_FILE_ENV_KEY = "FROOTAI_TRUST_FILE"
_ACTIVE_PLAY_ENV_KEY = "FROOTAI_ACTIVE_PLAY"
_FEDERATION_DISABLE_ENV_KEY = "FROOTAI_FEDERATION"
_PLAYS_ROOT_ENV_KEY = "FROOTAI_PLAYS_ROOT"
_SESSION_RESULT_PATH_ENV_KEY = "FROOTAI_SESSION_RESULT_PATH"  # [M8.19]
_FEDERATION_DISABLE_VALUE = "off"


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [s.strip() for s in value.split(",") if s.strip()]


def federation_is_disabled() -> bool:
    """Return True when the kernel kill-switch (FROOTAI_FEDERATION=off) is set."""
    return os.environ.get(_FEDERATION_DISABLE_ENV_KEY, "").strip() == _FEDERATION_DISABLE_VALUE


def _plays_root() -> Path:
    """Resolve the solution-plays directory.

    Lookup order:
      1. FROOTAI_PLAYS_ROOT env var (if set)
      2. ./solution-plays relative to CWD
      3. ../solution-plays relative to CWD (for tests run from sub-dirs)
    """
    override = os.environ.get(_PLAYS_ROOT_ENV_KEY)
    if override:
        return Path(override)
    cwd = Path.cwd()
    for candidate in (cwd / "solution-plays", cwd.parent / "solution-plays"):
        if candidate.is_dir():
            return candidate
    return cwd / "solution-plays"


def get_play_mcp_scope(play_id: str) -> Mapping[str, Any] | None:
    """[M8.7] Load a play's `spec/mcp-scope.json` manifest.

    Returns the parsed JSON object (typically with `attached` array +
    `router_config.trust_overrides`) or None when the file is absent /
    malformed. Errors are logged + swallowed; the agent must keep
    running even when the manifest is missing.

    This is a thin wrapper that could be swapped for a python-sdk
    `get_play(play_id)` accessor in a future SDK ship.
    """
    if not play_id:
        return None
    scope_path = _plays_root() / play_id / "spec" / "mcp-scope.json"
    if not scope_path.is_file():
        return None
    try:
        with scope_path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[federation_client] mcp-scope.json read failed for {play_id}: {exc}")
        return None


def emit_session_event(
    event: str,
    *,
    active_play: str | None,
    attached_areas: Sequence[str],
    failed_areas: Sequence[str] = (),
    tool_count: int = 0,
) -> dict[str, Any]:
    """[M8.14] Emit a structured JSON telemetry event to stdout.

    The Foundry runtime captures stdout; emitting one JSON object per
    line (JSONL) makes the event stream easy to aggregate downstream
    (Application Insights ingestion, status.frootai.dev dashboards,
    Plays-attach correlation in `frootai evaluate`).

    Schema:
      {
        "event": "foundry_session_started",
        "active_play": "<play-id or null>",
        "attached_areas": ["azure", ...],
        "failed_areas": [...],
        "tool_count": <int>
      }

    Returns the emitted payload so callers (e.g. start_session) can
    archive it on the instance for M8.19 session-result aggregation.
    Never raises — telemetry must not break the session.
    """
    payload: dict[str, Any] = {
        "event": event,
        "active_play": active_play,
        "attached_areas": list(attached_areas),
        "failed_areas": list(failed_areas),
        "tool_count": int(tool_count),
    }
    try:
        print(json.dumps(payload, separators=(",", ":")))
    except Exception as exc:  # noqa: BLE001
        print(f"[federation_client] telemetry emit failed: {exc}")
    return payload


class FoundryFederationClient:
    """Thin wrapper over `frootai.federation.FederationClient`.

    Holds a lazy reference to the SDK client and exposes Foundry-specific
    convenience methods. Errors are logged + swallowed; the agent must
    remain operational even when no MCP areas attach successfully.
    """

    def __init__(self) -> None:
        self._sdk_client: Any = None  # lazily constructed
        self._handles: dict[str, Any] = {}  # area name → attach handle
        self._effective_trust_file: str | None = None  # [M8.9] merged path
        self._invocation_counts: dict[str, int] = {}  # [M8.15] tool → count
        self._failed_areas: list[str] = []  # [M8.16] last session's failures
        self._last_cold_start_ms: float = 0.0  # [M8.17] last start_session() duration
        self._events: list[dict[str, Any]] = []  # [M8.19] structured event log

    @property
    def active_play(self) -> str | None:
        return os.environ.get(_ACTIVE_PLAY_ENV_KEY) or None

    @property
    def preattach_areas(self) -> list[str]:
        return _split_csv(os.environ.get(_PREATTACH_ENV_KEY))

    @property
    def trust_file(self) -> str | None:
        # [M8.9] Return the merged path when prepare_trust_file() produced
        # one, otherwise fall back to the raw FROOTAI_TRUST_FILE env var.
        if self._effective_trust_file:
            return self._effective_trust_file
        return os.environ.get(_TRUST_FILE_ENV_KEY) or None

    def prepare_trust_file(self) -> str | None:
        """[M8.9] Merge play-level trust overrides with the env trust file.

        If the active play's `mcp-scope.json` declares non-empty
        `router_config.trust_overrides`, merge those into the workflow
        author's `FROOTAI_TRUST_FILE` (the latter wins on key conflicts,
        matching M7.15's precedence on the GitHub Action side).

        The merged trust JSON is written to a tempfile in $RUNNER_TEMP
        (or the OS tempdir), and `FROOTAI_TRUST_FILE` is updated to point
        at it so the SDK's `attach()` calls pick up the merged content.

        Returns the effective trust-file path (the merged tempfile if a
        merge happened, the original env value otherwise, or None).
        """
        env_path = os.environ.get(_TRUST_FILE_ENV_KEY) or None
        play_id = self.active_play
        if not play_id:
            self._effective_trust_file = env_path
            return env_path

        scope = get_play_mcp_scope(play_id)
        if not scope:
            self._effective_trust_file = env_path
            return env_path

        play_overrides = (scope.get("router_config") or {}).get("trust_overrides") or {}
        if not isinstance(play_overrides, dict) or not play_overrides:
            self._effective_trust_file = env_path
            return env_path

        # Load the workflow-level base trust content (if any)
        base_trust: dict[str, Any] = {}
        if env_path:
            try:
                env_full = Path(env_path)
                if env_full.is_file():
                    with env_full.open(encoding="utf-8") as fh:
                        loaded = json.load(fh)
                    if isinstance(loaded, dict):
                        base_trust = loaded
            except (OSError, json.JSONDecodeError) as exc:
                print(f"[federation_client] trust base read failed ({env_path}): {exc}")

        # Merge: play overrides first, workflow-level on top wins on conflicts
        merged: dict[str, Any] = {**play_overrides, **base_trust}

        # Write merged content to a tempfile
        tmp = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix="frootai-trust-merged-",
            delete=False,
            encoding="utf-8",
        )
        try:
            json.dump(merged, tmp, indent=2)
            merged_path = tmp.name
        finally:
            tmp.close()

        # Update env so downstream readers (SDK kernel) see the merged file
        os.environ[_TRUST_FILE_ENV_KEY] = merged_path
        self._effective_trust_file = merged_path
        print(
            f"[federation_client] merged trust written: {merged_path} "
            f"(play overrides: {len(play_overrides)}, base keys: {len(base_trust)})"
        )
        return merged_path

    def resolve_areas_to_attach(self) -> list[str]:
        """[M8.7] Resolve the final list of areas to pre-attach.

        Precedence:
          1. Explicit FROOTAI_PREATTACH env var (workflow author intent)
          2. Active play's mcp_scope.attached (declarative manifest)
          3. Empty list (no federation)

        This mirrors the M7.14 action's auto-attach-from-manifest behavior
        on the Foundry runtime side.
        """
        explicit = self.preattach_areas
        if explicit:
            return explicit

        play_id = self.active_play
        if not play_id:
            return []

        scope = get_play_mcp_scope(play_id)
        if not scope:
            return []

        attached = scope.get("attached") or []
        if not isinstance(attached, list):
            return []
        return [str(a) for a in attached if a]

    def _sdk(self) -> Any:
        """Lazy SDK client construction. Returns None when federation off."""
        if federation_is_disabled():
            return None
        if self._sdk_client is None:
            try:
                from frootai.federation import FederationClient  # noqa: PLC0415
                self._sdk_client = FederationClient()
            except ImportError:
                print("[federation_client] frootai.federation not installed; federation disabled")
                return None
        return self._sdk_client

    async def attach_all_from_env(self) -> list[str]:
        """Attach every area resolved via env + active play; return attached names.

        Failures are logged but do not raise — the agent session must
        proceed even with zero areas attached.
        """
        attached: list[str] = []
        client = self._sdk()
        if client is None:
            return attached

        for area in self.resolve_areas_to_attach():
            try:
                args: dict[str, Any] = {"area": area}
                if self.trust_file:
                    args["trust_file"] = self.trust_file
                handle = await client.attach(args)
                self._handles[area] = handle
                attached.append(area)
                print(f"[federation_client] attached: {area}")
            except Exception as exc:  # noqa: BLE001 — swallow per contract
                print(f"[federation_client] attach failed for {area}: {exc}")

        return attached

    async def start_session(self) -> tuple[list[str], list[Mapping[str, Any]]]:
        """[M8.8] Session-start entry point.

        Resolves the areas to attach (via env or active play's
        mcp-scope.json), pre-attaches each area via the SDK, and lists
        the merged tools. Logs a session-start summary line with the
        requested/attached/failed counts so operators can see federation
        health at a glance.

        Failures attaching individual areas do NOT abort the session —
        each area is tried independently and the partial result is
        returned. The contract is: as long as the agent itself can run,
        return whatever the federation kernel managed to provide.

        Returns:
            (attached_areas, tools) tuple. Both may be empty when
            federation is disabled, no areas are configured, or every
            attach failed.
        """
        import time  # local import: avoid top-level side effects

        t_start = time.perf_counter()
        requested = self.resolve_areas_to_attach()
        if not requested:
            print("[federation_client] session start: no areas to pre-attach")
            # [M8.14] Telemetry: emit the session-started event even
            # when no federation happens, so dashboards see the session.
            self._last_cold_start_ms = (time.perf_counter() - t_start) * 1000
            event = emit_session_event(
                "foundry_session_started",
                active_play=self.active_play,
                attached_areas=(),
            )
            self._events.append(event)
            return [], []

        # [M8.9] Resolve + merge trust BEFORE attaching so the SDK uses
        # the play-merged overrides when calling per-area attach.
        self.prepare_trust_file()

        print(
            f"[federation_client] session start: requesting attach for "
            f"{len(requested)} area(s): {','.join(requested)}"
        )
        attached = await self.attach_all_from_env()
        failed = [a for a in requested if a not in attached]
        # [M8.16] Stash on instance so the agent can pull it via the
        # `failed_areas` property when building the system prompt note.
        self._failed_areas = list(failed)

        if failed:
            print(
                f"[federation_client] session start: attached={len(attached)} "
                f"failed={len(failed)} (failed: {','.join(failed)})"
            )
        else:
            print(f"[federation_client] session start: all {len(attached)} area(s) attached")

        tools = await self.list_all_tools(attached)
        print(f"[federation_client] session start: {len(tools)} tool(s) registered")

        # [M8.17] Cold-start timing — total wall time from session entry
        # through attach + list_tools. Target: ≤ 20s on Foundry runtime.
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        self._last_cold_start_ms = elapsed_ms
        print(f"[federation_client] session start: cold-start {elapsed_ms:.1f}ms")

        # [M8.14] Telemetry: emit the foundry_session_started event with
        # the play + attached areas + tool count for aggregation.
        event = emit_session_event(
            "foundry_session_started",
            active_play=self.active_play,
            attached_areas=attached,
            failed_areas=failed,
            tool_count=len(tools),
        )
        self._events.append(event)

        return attached, tools

    async def list_all_tools(self, attached_areas: Sequence[str]) -> list[Mapping[str, Any]]:
        """Return the merged tools list across all attached areas."""
        tools: list[Mapping[str, Any]] = []
        client = self._sdk()
        if client is None:
            return tools

        for area in attached_areas:
            handle = self._handles.get(area)
            if handle is None:
                continue
            try:
                area_tools = await client.list_tools(handle)
                tools.extend(area_tools)
            except Exception as exc:  # noqa: BLE001
                print(f"[federation_client] list_tools failed for {area}: {exc}")
        return tools

    async def detach_all(self) -> None:
        """Detach every previously attached area. Called at session end."""
        client = self._sdk()
        if client is None:
            return

        for area, handle in list(self._handles.items()):
            try:
                await client.detach(handle)
                del self._handles[area]
            except Exception as exc:  # noqa: BLE001
                print(f"[federation_client] detach failed for {area}: {exc}")

    async def invoke(self, tool_name: str, args: Mapping[str, Any] | None = None) -> Any:
        """[M8.15] Invoke a federated tool; track per-tool invocation count.

        Wraps the SDK's invoke() so every call increments the session's
        invocation counter. The count flows into the `foundry_session_completed`
        telemetry event emitted by `end_session()`, which Foundry uses
        for per-session cost attribution.

        Returns the SDK's response. Failures are propagated so the agent
        can decide how to recover.
        """
        client = self._sdk()
        if client is None:
            raise RuntimeError("federation disabled or SDK unavailable")
        self._invocation_counts[tool_name] = self._invocation_counts.get(tool_name, 0) + 1
        return await client.invoke(tool_name, args or {})

    @property
    def invocation_counts(self) -> dict[str, int]:
        """Read-only snapshot of per-tool invocation counts for this session."""
        return dict(self._invocation_counts)

    @property
    def total_invocations(self) -> int:
        """Sum of all federated-tool invocations during this session."""
        return sum(self._invocation_counts.values())

    @property
    def failed_areas(self) -> list[str]:
        """[M8.16] Areas that were requested but failed to attach last session."""
        return list(self._failed_areas)

    @property
    def last_cold_start_ms(self) -> float:
        """[M8.17] Wall-clock duration of the most recent start_session() call (ms)."""
        return self._last_cold_start_ms

    async def end_session(self) -> dict[str, Any]:
        """[M8.15/M8.19] Close the session: detach + emit completion + write result.

        Emits `foundry_session_completed` and (when
        FROOTAI_SESSION_RESULT_PATH is set) writes a schema-conforming
        JSON file at that path for `frootai evaluate` to consume. The
        schema is documented at schemas/foundry-session-result.schema.json.

        Returns:
            The in-memory session result mapping (same shape as the
            written file). M8.19 surfaces this in `frootai evaluate`
            reports.
        """
        attached = list(self._handles.keys())

        event = emit_session_event(
            "foundry_session_completed",
            active_play=self.active_play,
            attached_areas=attached,
            failed_areas=(),
            tool_count=self.total_invocations,
        )
        self._events.append(event)

        # [M8.19] Schema-conforming session result for `frootai evaluate`.
        result: dict[str, Any] = {
            "schemaVersion": "1",
            "activePlay": self.active_play,
            "attachedAreas": attached,
            "failedAreas": list(self._failed_areas),
            "totalInvocations": self.total_invocations,
            "invocationsByTool": dict(self._invocation_counts),
            "events": list(self._events),
            "coldStartMs": self._last_cold_start_ms,
        }

        # Write the result file if the consumer asked for it.
        result_path = os.environ.get(_SESSION_RESULT_PATH_ENV_KEY)
        if result_path:
            try:
                from pathlib import Path as _P  # noqa: PLC0415
                _P(result_path).parent.mkdir(parents=True, exist_ok=True)
                with open(result_path, "w", encoding="utf-8") as fh:
                    json.dump(result, fh, indent=2)
                print(f"[federation_client] session result written: {result_path}")
            except OSError as exc:
                print(f"[federation_client] session result write failed ({result_path}): {exc}")

        await self.detach_all()
        print(
            f"[federation_client] session end: "
            f"{result['totalInvocations']} tool invocation(s) across "
            f"{len(attached)} area(s)"
        )
        return result
