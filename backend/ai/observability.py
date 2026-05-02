from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager

logger = logging.getLogger("ai-engine")

_metrics = {
    "latency_ms": {},
    "errors": {},
    "prediction_count": 0,
}


def _inc(counter: dict[str, int], key: str, value: int = 1) -> None:
    counter[key] = counter.get(key, 0) + value


def log_event(event: str, **payload) -> None:
    message = {"event": event, **payload}
    logger.info(json.dumps(message, default=str))


def log_error(event: str, **payload) -> None:
    _inc(_metrics["errors"], event)
    message = {"event": event, **payload}
    logger.error(json.dumps(message, default=str))


def record_prediction(model_name: str) -> None:
    _metrics["prediction_count"] += 1
    _inc(_metrics["latency_ms"], f"prediction:{model_name}", 0)


@contextmanager
def track_latency(name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        _inc(_metrics["latency_ms"], name, elapsed_ms)
        log_event("latency", operation=name, elapsed_ms=elapsed_ms)


def get_metrics_snapshot() -> dict:
    return {
        "latency_ms": dict(_metrics["latency_ms"]),
        "errors": dict(_metrics["errors"]),
        "prediction_count": int(_metrics["prediction_count"]),
    }

