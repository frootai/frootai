"""FrootAI Eval-as-Service SDK (Python).

Typed, standard-library-only client for the FrootAI Cloud eval API. Mirrors
`@frootai/eval-sdk` (npm) and `frootai-cloud/eval/openapi.yaml` (v0.1.0).

See https://frootai.dev/methodology/eval

Tracker: P2.4.008
"""

from .client import (
    EvalClient,
    EvalApiError,
    EvalRun,
    MetricResult,
    RegressionDetail,
    Dataset,
    DatasetCase,
    Schedule,
    CiToken,
    Health,
)

__version__ = "0.1.0"

__all__ = [
    "EvalClient",
    "EvalApiError",
    "EvalRun",
    "MetricResult",
    "RegressionDetail",
    "Dataset",
    "DatasetCase",
    "Schedule",
    "CiToken",
    "Health",
    "__version__",
]
