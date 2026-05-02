from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from statistics import mean, pstdev

import numpy as np


@dataclass
class PreprocessConfig:
    outlier_method: str = "iqr"  # iqr | zscore
    zscore_threshold: float = 3.0
    iqr_factor: float = 1.5
    aggregate: str = "daily"  # daily | weekly


def _to_utc(dt: datetime | None) -> datetime:
    if not dt:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _cap_outliers(values: list[float], cfg: PreprocessConfig) -> list[float]:
    if len(values) < 4:
        return values
    arr = np.array(values, dtype=float)
    if cfg.outlier_method == "zscore":
        mu = float(arr.mean())
        sigma = float(arr.std())
        if sigma == 0:
            return values
        lower = mu - cfg.zscore_threshold * sigma
        upper = mu + cfg.zscore_threshold * sigma
        return np.clip(arr, lower, upper).tolist()
    q1 = np.percentile(arr, 25)
    q3 = np.percentile(arr, 75)
    iqr = q3 - q1
    lower = q1 - cfg.iqr_factor * iqr
    upper = q3 + cfg.iqr_factor * iqr
    return np.clip(arr, lower, upper).tolist()


def _fill_missing(series: dict[date, float], start: date, end: date, aggregate: str) -> dict[date, float]:
    current = start
    out: dict[date, float] = {}
    step = timedelta(days=7 if aggregate == "weekly" else 1)
    while current <= end:
        out[current] = float(series.get(current, 0.0))
        current += step
    return out


def normalize(values: list[float]) -> tuple[list[float], dict]:
    if not values:
        return [], {"mean": 0.0, "std": 1.0}
    mu = mean(values)
    sigma = pstdev(values) or 1.0
    scaled = [float((v - mu) / sigma) for v in values]
    return scaled, {"mean": float(mu), "std": float(sigma)}


def aggregate_sales(rows: list[dict], cfg: PreprocessConfig | None = None) -> dict:
    cfg = cfg or PreprocessConfig()
    if not rows:
        return {"series": [], "meta": {"aggregate": cfg.aggregate, "removed_outliers": 0}}

    grouped: dict[date, float] = {}
    for row in rows:
        dt = _to_utc(row.get("created_at"))
        key = dt.date()
        if cfg.aggregate == "weekly":
            key = key - timedelta(days=key.weekday())
        grouped[key] = grouped.get(key, 0.0) + float(row.get("quantity") or 0.0)

    start = min(grouped.keys())
    end = max(grouped.keys())
    complete = _fill_missing(grouped, start, end, cfg.aggregate)
    ordered_dates = sorted(complete.keys())
    raw_values = [complete[d] for d in ordered_dates]
    capped = _cap_outliers(raw_values, cfg)
    normalized, scaler = normalize(capped)

    series = [
        {
            "date": ordered_dates[i].isoformat(),
            "quantity": float(capped[i]),
            "quantity_normalized": float(normalized[i]),
            "time_index": i,
            "day_of_week": datetime.fromisoformat(f"{ordered_dates[i].isoformat()}T00:00:00").weekday(),
            "month": ordered_dates[i].month,
        }
        for i in range(len(ordered_dates))
    ]
    removed_outliers = sum(1 for i, v in enumerate(raw_values) if abs(v - capped[i]) > 1e-6)
    return {
        "series": series,
        "meta": {
            "aggregate": cfg.aggregate,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "removed_outliers": removed_outliers,
            "scaler": scaler,
        },
    }

