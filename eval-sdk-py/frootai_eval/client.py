"""FrootAI Eval API client — stdlib-only (urllib).

Mirrors @frootai/eval-sdk. See https://frootai.dev/methodology/eval
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional

__all__ = [
    "EvalClient",
    "EvalApiError",
    "MetricResult",
    "RegressionDetail",
    "EvalRun",
    "DatasetCase",
    "Dataset",
    "Schedule",
    "CiToken",
    "Health",
]

DEFAULT_BASE_URL = "https://eval.api.frootai.cloud"


# ── Types ────────────────────────────────────────────────────────────────


@dataclass
class MetricResult:
    metric: str
    score: float
    type: str  # "deterministic" | "non-deterministic"
    passed: bool
    confidence: Optional[float] = None
    threshold: Optional[float] = None


@dataclass
class RegressionDetail:
    metric: str
    previousScore: float
    currentScore: float
    delta: float
    deltaPercent: float
    regressed: bool
    reason: str


@dataclass
class EvalRun:
    id: str
    tenantId: str
    manifestSlug: str
    suiteName: str
    status: str
    regressed: bool
    createdAt: str
    completedAt: Optional[str] = None
    results: list[MetricResult] = field(default_factory=list)
    regressionDetails: list[RegressionDetail] = field(default_factory=list)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "EvalRun":
        return EvalRun(
            id=d.get("id", ""),
            tenantId=d.get("tenantId", ""),
            manifestSlug=d.get("manifestSlug", ""),
            suiteName=d.get("suiteName", ""),
            status=d.get("status", ""),
            regressed=bool(d.get("regressed", False)),
            createdAt=d.get("createdAt", ""),
            completedAt=d.get("completedAt"),
            results=[MetricResult(**r) for r in d.get("results", [])],
            regressionDetails=[
                RegressionDetail(**r) for r in d.get("regressionDetails", [])
            ],
        )


@dataclass
class DatasetCase:
    id: str
    input: dict[str, Any]
    expected: str
    judge: str
    maintainer: str


@dataclass
class Dataset:
    slug: str
    totalCases: int
    cases: list[DatasetCase] = field(default_factory=list)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Dataset":
        return Dataset(
            slug=d.get("slug", ""),
            totalCases=int(d.get("totalCases", 0)),
            cases=[DatasetCase(**c) for c in d.get("cases", [])],
        )


@dataclass
class Schedule:
    id: str
    tenantId: str
    manifestSlug: str
    suite: str
    cron: str
    createdAt: str


@dataclass
class CiToken:
    token: str
    expiresAt: str
    label: Optional[str] = None


@dataclass
class Health:
    status: str
    service: str
    version: str


# ── Errors ───────────────────────────────────────────────────────────────


class EvalApiError(Exception):
    def __init__(self, status: int, message: str, body: Any = None) -> None:
        super().__init__(f"[{status}] {message}")
        self.status = status
        self.body = body


# ── Client ───────────────────────────────────────────────────────────────


class EvalClient:
    """Client for the FrootAI Eval-as-Service API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.token = token or os.environ.get("FROOTAI_EVAL_TOKEN")
        self.timeout = timeout

    # ── HTTP core ──────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if data is not None:
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8") if e.fp else ""
            parsed: Any = None
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = raw
            message = (
                parsed.get("error")
                if isinstance(parsed, dict) and parsed.get("error")
                else (e.reason or f"HTTP {e.code}")
            )
            raise EvalApiError(e.code, str(message), parsed) from None
        except urllib.error.URLError as e:
            raise EvalApiError(0, f"Network error: {e.reason}", None) from None

    # ── Eval runs ──────────────────────────────────────────────────────────

    def create_run(
        self,
        manifest_slug: str,
        suite: str,
        output: str,
        *,
        manifest_version: Optional[str] = None,
        manifest: Optional[dict[str, Any]] = None,
        input_data: Optional[dict[str, Any]] = None,
        context: Optional[str] = None,
        thresholds: Optional[dict[str, float]] = None,
    ) -> EvalRun:
        """Trigger an eval suite against a manifest + output."""
        payload: dict[str, Any] = {
            "manifestSlug": manifest_slug,
            "suite": suite,
            "output": output,
        }
        if manifest_version is not None:
            payload["manifestVersion"] = manifest_version
        if manifest is not None:
            payload["manifest"] = manifest
        if input_data is not None:
            payload["input"] = input_data
        if context is not None:
            payload["context"] = context
        if thresholds is not None:
            payload["thresholds"] = thresholds
        return EvalRun.from_dict(self._request("POST", "/v1/eval/runs", payload))

    def get_run(self, run_id: str) -> EvalRun:
        """Get eval run results by id."""
        return EvalRun.from_dict(self._request("GET", f"/v1/eval/runs/{run_id}"))

    # ── Datasets ───────────────────────────────────────────────────────────

    def get_dataset(self, slug: str) -> Dataset:
        """Get the eval dataset for a play slug."""
        return Dataset.from_dict(self._request("GET", f"/v1/eval/datasets/{slug}"))

    # ── Schedules ──────────────────────────────────────────────────────────

    def create_schedule(self, manifest_slug: str, suite: str, cron: str) -> Schedule:
        """Create a scheduled eval run."""
        payload = {"manifestSlug": manifest_slug, "suite": suite, "cron": cron}
        return Schedule(**self._request("POST", "/v1/eval/schedules", payload))

    def list_schedules(self) -> list[Schedule]:
        """List the tenant's eval schedules."""
        out = self._request("GET", "/v1/eval/schedules") or {}
        return [Schedule(**s) for s in out.get("schedules", [])]

    def delete_schedule(self, schedule_id: str) -> None:
        """Delete a schedule by id."""
        self._request("DELETE", f"/v1/eval/schedules/{schedule_id}")

    # ── CI token ───────────────────────────────────────────────────────────

    def mint_ci_token(
        self, label: Optional[str] = None, expires_in_days: int = 90
    ) -> CiToken:
        """Mint a tenant-scoped, eval-only CI token (default 90-day expiry)."""
        payload: dict[str, Any] = {"expiresInDays": expires_in_days}
        if label is not None:
            payload["label"] = label
        return CiToken(**self._request("POST", "/v1/eval/api/ci-token", payload))

    # ── Health ─────────────────────────────────────────────────────────────

    def health(self) -> Health:
        """Liveness probe."""
        return Health(**self._request("GET", "/health"))
